import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, Music, Plus, Trash2, Upload, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { NowPlayingBar } from './NowPlayingBar'
import { useSettings } from '../../context/SettingsContext'
import { useAudio } from '../../context/AudioContext'
import { AMBIENT_PRESETS, spotifyEmbedHeight } from '../../lib/music'
import { LIMITS, sanitizeHttpsUrl } from '../../lib/security'
import type { AmbientSoundId, MusicSource } from '../../types'

export function SoundCard() {
  const { settings, update } = useSettings()
  const {
    nowPlaying,
    queue,
    currentIndex,
    audioError,
    selectTrack,
    addFileTracks,
    addUrlTrack,
    removeTrack,
    clearQueue,
    spotifyRef,
    registerSpotifySlot,
  } = useAudio()
  const fileRef = useRef<HTMLInputElement>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | undefined>(undefined)

  const spotifySlotRef = useCallback(
    (el: HTMLDivElement | null) => {
      registerSpotifySlot('card', el)
    },
    [registerSpotifySlot],
  )

  useEffect(() => {
    return () => registerSpotifySlot('card', null)
  }, [registerSpotifySlot])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    await addFileTracks(files)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleAddUrl = () => {
    const trimmed = urlDraft.trim()
    if (!trimmed) return
    if (!sanitizeHttpsUrl(trimmed)) {
      setUrlError(
        'Enter a valid public https:// URL (local network and non-HTTPS URLs are blocked).',
      )
      return
    }
    const ok = addUrlTrack(trimmed)
    if (ok) {
      setUrlDraft('')
      setUrlError(undefined)
    }
  }

  return (
    <Card className="card-pad">
      <CardHeader
        title="Sound"
        subtitle="Ambient noise, or music you own"
        icon={<Music className="h-[18px] w-[18px]" />}
      />

      <div className="mt-4">
        <Segmented
          value={settings.musicSource}
          onChange={(v) => update({ musicSource: v as MusicSource })}
          options={[
            { value: 'ambient', label: 'Ambient' },
            { value: 'custom', label: 'My audio' },
            { value: 'spotify', label: 'Spotify' },
          ]}
          size="sm"
        />
      </div>

      {nowPlaying && nowPlaying.source !== 'spotify' ? (
        <div className="mt-4">
          <NowPlayingBar variant="inline" />
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {settings.musicSource === 'ambient' ? (
          <>
            <Field label="Soundscape">
              <Select
                value={settings.ambient}
                onChange={(e) => update({ ambient: e.target.value as AmbientSoundId })}
              >
                <option value="none">None</option>
                {AMBIENT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </Field>
            <VolumeSlider
              value={settings.ambientVolume}
              onChange={(v) => update({ ambientVolume: v })}
            />
            <p className="text-[11px] leading-relaxed text-muted">
              Generated on the fly — no downloads. It fades in when a focus session starts and
              stops when you pause.
            </p>
          </>
        ) : null}

        {settings.musicSource === 'custom' ? (
          <>
            <Field
              label="Add audio URL"
              hint="A direct HTTPS link to an audio file (mp3, ogg, m4a…)."
              error={urlError}
            >
              <div className="flex gap-2">
                <TextInput
                  type="url"
                  maxLength={LIMITS.url}
                  value={urlDraft}
                  onChange={(e) => {
                    setUrlDraft(e.target.value)
                    if (urlError) setUrlError(undefined)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddUrl()
                    }
                  }}
                  placeholder="https://example.com/focus.mp3"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddUrl}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  aria-label="Add audio URL to queue"
                >
                  Add
                </Button>
              </div>
            </Field>

            <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4,audio/aac,audio/flac,.mp3,.ogg,.wav,.m4a,.aac,.flac,.webm"
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => fileRef.current?.click()}
              >
                Upload audio
              </Button>
              {queue.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void clearQueue()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted transition hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear queue
                </button>
              ) : (
                <span className="text-[11px] text-muted">No tracks yet</span>
              )}
            </div>

            {queue.length > 0 ? (
              <ul
                aria-label="Audio queue"
                className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line bg-subtle/40 p-1.5"
              >
                {queue.map((track, idx) => {
                  const isActive = idx === currentIndex
                  return (
                    <li
                      key={track.id}
                      className={clsx(
                        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition',
                        isActive
                          ? 'bg-card font-semibold text-ink shadow-soft'
                          : 'text-muted hover:bg-card/60 hover:text-ink',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectTrack(idx)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className="shrink-0 text-sage-700" aria-hidden>
                          {track.kind === 'url' ? (
                            <Link2 className="h-3.5 w-3.5" />
                          ) : (
                            <Music className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="truncate">{track.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeTrack(track.id)}
                        className="shrink-0 rounded-md p-1 text-muted transition hover:bg-subtle hover:text-ink"
                        aria-label={`Remove ${track.title}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {audioError ? (
              <p className="text-[11px] font-medium text-red-600" role="alert">
                {audioError}
              </p>
            ) : null}

            <VolumeSlider
              value={settings.ambientVolume}
              onChange={(v) => update({ ambientVolume: v })}
            />
            <p className="text-[11px] leading-relaxed text-muted">
              Plays automatically while a focus session runs and advances through your queue —
              press <kbd className="rounded bg-subtle px-1 font-mono text-[10px]">N</kbd> to skip
              tracks.
            </p>
          </>
        ) : null}

        {settings.musicSource === 'spotify' ? (
          <>
            <Field
              label="Spotify link"
              hint="Paste a playlist, album, or track link from open.spotify.com (Share → Copy link)."
            >
              <TextInput
                maxLength={LIMITS.url}
                value={settings.spotifyUrl}
                onChange={(e) => update({ spotifyUrl: e.target.value })}
                placeholder="https://open.spotify.com/playlist/…"
              />
            </Field>

            {spotifyRef ? (
              <div
                ref={spotifySlotRef}
                style={{ height: spotifyEmbedHeight(spotifyRef) }}
                className="w-full overflow-hidden rounded-2xl bg-subtle/40"
                aria-label="Spotify player container"
              />
            ) : settings.spotifyUrl.trim() ? (
              <p className="text-[11px] text-coral-600">
                That doesn’t look like a Spotify link yet.
              </p>
            ) : null}

            <p className="text-[11px] leading-relaxed text-muted">
              Spotify plays through their own player — press play inside it. Entering Focus Mode
              moves this same player into a compact mini bar without restarting your music.
            </p>
          </>
        ) : null}
      </div>
    </Card>
  )
}

function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Field label={`Volume — ${Math.round(value * 100)}%`}>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: 'rgb(var(--c-sage))' }}
        aria-label="Background audio volume"
      />
    </Field>
  )
}
