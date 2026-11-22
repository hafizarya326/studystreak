import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AudioTrackItem, NowPlaying } from '../types'
import { useAuth } from './AuthContext'
import { useSettings } from './SettingsContext'
import { useTimer } from './TimerContext'
import { useToast } from './ToastContext'
import {
  deleteTrackItem,
  deleteUserTracks,
  getTrackItem,
  putTrackItem,
} from '../lib/audio-library'
import {
  ambientTitle,
  cycleAmbient,
  fetchSpotifyTitle,
  musicEngine,
  parseSpotifyLink,
  spotifyFallbackTitle,
  titleFromAudioUrl,
  titleFromFilename,
  wrapIndex,
  type SpotifyRef,
} from '../lib/music'
import { soundEngine } from '../lib/sound'
import { uid } from '../lib/id'
import { LIMITS, sanitizeHttpsUrl, validateAudioFile } from '../lib/security'

export type SpotifySlotKind = 'card' | 'fullscreen'

export interface AudioContextValue {
  /** Active background audio metadata for SoundCard and Fullscreen Focus Mode, or null when silent. */
  nowPlaying: NowPlaying | null
  queue: AudioTrackItem[]
  currentIndex: number
  audioError: string | null
  skipNext: () => void
  skipPrev: () => void
  selectTrack: (index: number) => void
  addFileTracks: (files: FileList | File[]) => Promise<void>
  addUrlTrack: (rawUrl: string) => boolean
  removeTrack: (trackId: string) => Promise<void>
  clearQueue: () => Promise<void>
  spotifyRef: SpotifyRef | null
  spotifyTitle: string | null
  /** True while TimerPanel's Fullscreen Focus Mode overlay is open. */
  focusMode: boolean
  setFocusMode: (active: boolean) => void
  /** Persistent Spotify mini player collapse/expand state (persisted via Repository). */
  spotifyMiniCollapsed: boolean
  toggleSpotifyMini: () => void
  /** One-time "Press play in the Spotify player" hint dismissal (persisted via Repository). */
  spotifyPlayHintDismissed: boolean
  dismissSpotifyPlayHint: () => void
  /** Register placeholder slot elements so the single persistent Spotify iframe repositions via CSS without reloading. */
  spotifyCardSlot: HTMLDivElement | null
  spotifyFullscreenSlot: HTMLDivElement | null
  registerSpotifySlot: (kind: SpotifySlotKind, el: HTMLDivElement | null) => void
}

const AudioContext = createContext<AudioContextValue | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { settings, update } = useSettings()
  const timer = useTimer()
  const { push } = useToast()

  const queue = settings.customAudioQueue
  const currentIndex =
    queue.length > 0 ? Math.min(queue.length - 1, Math.max(0, settings.customAudioIndex)) : 0
  const activeTrack = queue[currentIndex] ?? null

  const focusRunning = timer.status === 'running' && timer.type === 'focus'
  const spotifyRef = useMemo(() => parseSpotifyLink(settings.spotifyUrl), [settings.spotifyUrl])

  const [resolvedSrc, setResolvedSrc] = useState('')
  const [audioError, setAudioError] = useState<string | null>(null)
  const [spotifyTitle, setSpotifyTitle] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [spotifyCardSlot, setSpotifyCardSlot] = useState<HTMLDivElement | null>(null)
  const [spotifyFullscreenSlot, setSpotifyFullscreenSlot] = useState<HTMLDivElement | null>(null)

  const registerSpotifySlot = useCallback((kind: SpotifySlotKind, el: HTMLDivElement | null) => {
    if (kind === 'card') setSpotifyCardSlot(el)
    else setSpotifyFullscreenSlot(el)
  }, [])

  const toggleSpotifyMini = useCallback(() => {
    update({ spotifyMiniCollapsed: !settings.spotifyMiniCollapsed })
  }, [settings.spotifyMiniCollapsed, update])

  const dismissSpotifyPlayHint = useCallback(() => {
    update({ spotifyPlayHintDismissed: true })
  }, [update])

  const stateRef = useRef({
    musicSource: settings.musicSource,
    ambient: settings.ambient,
    queueLength: queue.length,
    currentIndex,
  })
  useEffect(() => {
    stateRef.current = {
      musicSource: settings.musicSource,
      ambient: settings.ambient,
      queueLength: queue.length,
      currentIndex,
    }
  })

  /* -------------------- resolve active custom track source -------------------- */

  const activeTrackId = activeTrack?.id ?? ''
  const activeTrackKind = activeTrack?.kind ?? ''
  const activeTrackUrl = activeTrack?.url ?? ''

  useEffect(() => {
    let alive = true
    let objectUrl = ''
    setAudioError(null)

    if (!user || settings.musicSource !== 'custom' || !activeTrackId) {
      setResolvedSrc('')
      return
    }

    if (activeTrackKind === 'url') {
      const valid = sanitizeHttpsUrl(activeTrackUrl)
      if (!valid) {
        setResolvedSrc('')
        setAudioError('Invalid audio URL.')
        return
      }
      setResolvedSrc(valid)
      return
    }

    setResolvedSrc('')
    void (async () => {
      const blob = await getTrackItem(user.id, activeTrackId)
      if (!alive) return
      if (!blob) {
        setAudioError('Audio file missing — try uploading it again.')
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setResolvedSrc(objectUrl)
    })()

    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user, settings.musicSource, activeTrackId, activeTrackKind, activeTrackUrl])

  /* -------------------- Spotify public oEmbed title fetch -------------------- */

  const spotifyType = spotifyRef?.type ?? ''
  const spotifyId = spotifyRef?.id ?? ''

  useEffect(() => {
    if (!spotifyType || !spotifyId) {
      setSpotifyTitle(null)
      return
    }
    const controller = new AbortController()
    const ref: SpotifyRef = { type: spotifyType as SpotifyRef['type'], id: spotifyId }
    setSpotifyTitle(null)
    void (async () => {
      const title = await fetchSpotifyTitle(ref, controller.signal)
      if (!controller.signal.aborted) setSpotifyTitle(title)
    })()
    return () => controller.abort()
  }, [spotifyType, spotifyId])

  /* -------------------- playback sync with timer + volume -------------------- */

  useEffect(() => {
    const ambientShouldPlay =
      focusRunning && settings.musicSource === 'ambient' && settings.ambient !== 'none'
    if (ambientShouldPlay) soundEngine.startAmbient(settings.ambient, settings.ambientVolume)
    else soundEngine.stopAmbient()

    const customShouldPlay =
      focusRunning && settings.musicSource === 'custom' && Boolean(resolvedSrc)
    if (customShouldPlay) {
      musicEngine.play(resolvedSrc, settings.ambientVolume, { loop: queue.length <= 1 })
    } else {
      musicEngine.stop()
    }
    // Intentionally excludes ambientVolume so dragging the volume slider never
    // restarts ambient noise or custom tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRunning, settings.musicSource, settings.ambient, resolvedSrc, queue.length])

  useEffect(() => {
    musicEngine.setLoop(queue.length <= 1)
  }, [queue.length])

  useEffect(() => {
    soundEngine.setAmbientVolume(settings.ambientVolume)
    musicEngine.setVolume(settings.ambientVolume)
  }, [settings.ambientVolume])

  /* -------------------- queue navigation & engine callbacks -------------------- */

  const skipStep = useCallback(
    (step: 1 | -1) => {
      const cur = stateRef.current
      if (cur.musicSource === 'ambient') {
        if (cur.ambient === 'none') return
        update({ ambient: cycleAmbient(cur.ambient, step) })
        return
      }
      if (cur.musicSource === 'custom') {
        if (cur.queueLength <= 1) return
        setAudioError(null)
        update({ customAudioIndex: wrapIndex(cur.currentIndex, cur.queueLength, step) })
      }
      // Spotify embed iframe does not expose next/previous track control (see music.ts).
    },
    [update],
  )

  const skipNext = useCallback(() => skipStep(1), [skipStep])
  const skipPrev = useCallback(() => skipStep(-1), [skipStep])

  useEffect(() => {
    musicEngine.setListeners({
      onEnded: () => {
        if (stateRef.current.musicSource === 'custom' && stateRef.current.queueLength > 1) {
          skipNext()
        }
      },
      onError: (reason) => {
        setAudioError(reason)
        push({
          title: 'Track failed to load',
          description: reason,
          variant: 'error',
        })
      },
    })
    return () => musicEngine.setListeners({})
  }, [skipNext, push])

  /* -------------------- queue mutations -------------------- */

  const selectTrack = useCallback(
    (index: number) => {
      if (queue.length === 0) return
      const clamped = Math.min(queue.length - 1, Math.max(0, Math.trunc(index)))
      setAudioError(null)
      update({ musicSource: 'custom', customAudioIndex: clamped })
    },
    [queue.length, update],
  )

  const addFileTracks = useCallback(
    async (fileInput: FileList | File[]) => {
      if (!user) return
      const files = Array.from(fileInput)
      if (files.length === 0) return

      const remainingSlots = Math.max(0, LIMITS.audioQueueMax - queue.length)
      if (remainingSlots === 0) {
        push({
          title: 'Playlist full',
          description: `You can queue up to ${LIMITS.audioQueueMax} tracks.`,
          variant: 'error',
        })
        return
      }

      const added: AudioTrackItem[] = []
      const errors: string[] = []

      for (const file of files.slice(0, remainingSlots)) {
        const result = await validateAudioFile(file)
        if (!result.ok) {
          errors.push(`${file.name}: ${result.error}`)
          continue
        }
        const id = uid('t_')
        await putTrackItem(user.id, id, result.blob)
        added.push({
          id,
          kind: 'file',
          title: titleFromFilename(result.safeName),
        })
      }

      if (added.length > 0) {
        const nextQueue = [...queue, ...added]
        const nextIndex = queue.length === 0 ? 0 : currentIndex
        setAudioError(null)
        update({
          musicSource: 'custom',
          customAudioQueue: nextQueue,
          customAudioIndex: nextIndex,
          customAudioUrl: '',
          customAudioName: '',
        })
        push({
          title: added.length === 1 ? 'Track added to queue' : `${added.length} tracks added`,
          description: 'Plays automatically during focus sessions.',
          variant: 'success',
        })
      }

      if (errors.length > 0) {
        push({
          title: added.length > 0 ? 'Some files skipped' : 'Invalid audio file',
          description: errors[0],
          variant: 'error',
        })
      }
    },
    [user, queue, currentIndex, update, push],
  )

  const addUrlTrack = useCallback(
    (rawUrl: string): boolean => {
      const valid = sanitizeHttpsUrl(rawUrl)
      if (!valid) return false
      if (queue.length >= LIMITS.audioQueueMax) {
        push({
          title: 'Playlist full',
          description: `You can queue up to ${LIMITS.audioQueueMax} tracks.`,
          variant: 'error',
        })
        return false
      }

      const item: AudioTrackItem = {
        id: uid('t_'),
        kind: 'url',
        title: titleFromAudioUrl(valid),
        url: valid,
      }
      const nextQueue = [...queue, item]
      const nextIndex = queue.length === 0 ? 0 : currentIndex
      setAudioError(null)
      update({
        musicSource: 'custom',
        customAudioQueue: nextQueue,
        customAudioIndex: nextIndex,
        customAudioUrl: '',
        customAudioName: '',
      })
      push({
        title: 'Audio URL added',
        description: item.title,
        variant: 'success',
      })
      return true
    },
    [queue, currentIndex, update, push],
  )

  const removeTrack = useCallback(
    async (trackId: string) => {
      const idx = queue.findIndex((t) => t.id === trackId)
      if (idx < 0) return
      const target = queue[idx]
      if (user && target.kind === 'file') {
        await deleteTrackItem(user.id, target.id)
      }
      const nextQueue = queue.filter((t) => t.id !== trackId)
      let nextIndex = currentIndex
      if (nextQueue.length === 0) {
        nextIndex = 0
        musicEngine.resetSource()
      } else if (idx < currentIndex) {
        nextIndex = currentIndex - 1
      } else if (currentIndex >= nextQueue.length) {
        nextIndex = nextQueue.length - 1
      }
      setAudioError(null)
      update({
        customAudioQueue: nextQueue,
        customAudioIndex: nextIndex,
        customAudioUrl: '',
        customAudioName: '',
      })
    },
    [queue, currentIndex, user, update],
  )

  const clearQueue = useCallback(async () => {
    if (user) await deleteUserTracks(user.id)
    musicEngine.resetSource()
    setAudioError(null)
    update({
      customAudioQueue: [],
      customAudioIndex: 0,
      customAudioUrl: '',
      customAudioName: '',
    })
  }, [user, update])

  /* -------------------- derived NowPlaying metadata -------------------- */

  const nowPlaying = useMemo<NowPlaying | null>(() => {
    if (settings.musicSource === 'ambient') {
      const title = ambientTitle(settings.ambient)
      if (!title) return null
      return {
        title,
        source: 'ambient',
        canSkip: true,
        canPrev: true,
        isPlaying: focusRunning,
      }
    }

    if (settings.musicSource === 'custom') {
      if (!activeTrack) return null
      const multi = queue.length > 1
      return {
        title: activeTrack.title,
        source: 'my-audio',
        canSkip: multi,
        canPrev: multi,
        positionLabel: multi ? `${currentIndex + 1} / ${queue.length}` : undefined,
        isPlaying: focusRunning && !audioError && Boolean(resolvedSrc),
        error: audioError ?? undefined,
      }
    }

    if (settings.musicSource === 'spotify') {
      if (!spotifyRef) return null
      // Spotify's cross-origin embed iframe and Embed IFrame API do not expose
      // individual track titles or next/previous track controls — those are only
      // available inside the embedded Spotify player UI itself. We show the
      // oEmbed playlist/album/track title as the collapsed pill label and keep
      // `canSkip`/`canPrev` false so keyboard skip shortcuts stay disabled.
      return {
        title: spotifyTitle ?? spotifyFallbackTitle(spotifyRef),
        source: 'spotify',
        canSkip: false,
        canPrev: false,
        isPlaying: false,
      }
    }

    return null
  }, [
    settings.musicSource,
    settings.ambient,
    focusRunning,
    activeTrack,
    queue.length,
    currentIndex,
    audioError,
    resolvedSrc,
    spotifyRef,
    spotifyTitle,
  ])

  const value = useMemo<AudioContextValue>(
    () => ({
      nowPlaying,
      queue,
      currentIndex,
      audioError,
      skipNext,
      skipPrev,
      selectTrack,
      addFileTracks,
      addUrlTrack,
      removeTrack,
      clearQueue,
      spotifyRef,
      spotifyTitle,
      focusMode,
      setFocusMode,
      spotifyMiniCollapsed: settings.spotifyMiniCollapsed,
      toggleSpotifyMini,
      spotifyPlayHintDismissed: settings.spotifyPlayHintDismissed,
      dismissSpotifyPlayHint,
      spotifyCardSlot,
      spotifyFullscreenSlot,
      registerSpotifySlot,
    }),
    [
      nowPlaying,
      queue,
      currentIndex,
      audioError,
      skipNext,
      skipPrev,
      selectTrack,
      addFileTracks,
      addUrlTrack,
      removeTrack,
      clearQueue,
      spotifyRef,
      spotifyTitle,
      focusMode,
      spotifyCardSlot,
      spotifyFullscreenSlot,
      registerSpotifySlot,
      settings.spotifyMiniCollapsed,
      toggleSpotifyMini,
      settings.spotifyPlayHintDismissed,
      dismissSpotifyPlayHint,
    ],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider')
  return ctx
}
