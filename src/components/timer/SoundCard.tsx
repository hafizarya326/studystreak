import { useRef } from 'react'
import { Music, Upload, X } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { useSettings } from '../../context/SettingsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { deleteTrack, putTrack } from '../../lib/audio-library'
import { parseSpotifyLink, spotifyEmbedHeight, spotifyEmbedUrl } from '../../lib/music'
import type { AmbientSoundId, MusicSource } from '../../types'

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024

export function SoundCard() {
  const { settings, update } = useSettings()
  const { user } = useAuth()
  const { push } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const spotify = parseSpotifyLink(settings.spotifyUrl)
  const hasTrack = Boolean(settings.customAudioUrl || settings.customAudioName)

  const onUpload = async (file: File | undefined) => {
    if (!file || !user) return
    if (!file.type.startsWith('audio/')) {
      push({ title: 'Unsupported file', description: 'Pick an audio file (mp3, ogg, wav…).', variant: 'error' })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      push({ title: 'File too large', description: 'Keep it under 40 MB.', variant: 'error' })
      return
    }
    await putTrack(user.id, file)
    update({ musicSource: 'custom', customAudioUrl: '', customAudioName: file.name })
    push({ title: 'Track ready', description: 'It loops during your focus sessions.', variant: 'success' })
    if (fileRef.current) fileRef.current.value = ''
  }

  const clearTrack = async () => {
    if (user) await deleteTrack(user.id)
    update({ customAudioName: '', customAudioUrl: '' })
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

      <div className="mt-4 space-y-4">
        {settings.musicSource === 'ambient' ? (
          <>
            <Field label="Soundscape">
              <Select
                value={settings.ambient}
                onChange={(e) => update({ ambient: e.target.value as AmbientSoundId })}
              >
                <option value="none">None</option>
                <option value="brown">Brown noise (warm)</option>
                <option value="white">White noise (crisp)</option>
                <option value="waves">Ocean waves</option>
                <option value="cafe">Soft café hum</option>
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
            <Field label="Audio file URL" hint="A direct link to your own audio file (mp3, ogg, m4a…).">
              <TextInput
                type="url"
                value={settings.customAudioUrl}
                onChange={(e) => update({ customAudioUrl: e.target.value })}
                placeholder="https://example.com/focus.mp3"
              />
            </Field>

            <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => void onUpload(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => fileRef.current?.click()}
              >
                Upload a file
              </Button>
              {hasTrack ? (
                <span className="chip !py-1.5 !text-ink">
                  <span className="max-w-[12rem] truncate">
                    {settings.customAudioUrl ? 'Linked file' : settings.customAudioName}
                  </span>
                  <button
                    type="button"
                    onClick={() => void clearTrack()}
                    className="ml-0.5 rounded-full p-0.5 text-muted transition hover:bg-card hover:text-ink"
                    aria-label="Remove track"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-muted">No track yet</span>
              )}
            </div>

            <VolumeSlider
              value={settings.ambientVolume}
              onChange={(v) => update({ ambientVolume: v })}
            />
            <p className="text-[11px] leading-relaxed text-muted">
              Plays automatically while a focus session runs and pauses when you stop — unlike a
              Spotify embed, this stays in sync with your timer.
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
                value={settings.spotifyUrl}
                onChange={(e) => update({ spotifyUrl: e.target.value })}
                placeholder="https://open.spotify.com/playlist/…"
              />
            </Field>

            {spotify ? (
              <iframe
                title="Spotify player"
                src={spotifyEmbedUrl(spotify)}
                width="100%"
                height={spotifyEmbedHeight(spotify)}
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                className="rounded-xl border border-line"
                style={{ border: 0 }}
              />
            ) : settings.spotifyUrl.trim() ? (
              <p className="text-[11px] text-coral-600">
                That doesn’t look like a Spotify link yet.
              </p>
            ) : null}

            <p className="text-[11px] leading-relaxed text-muted">
              Spotify plays through their own player — press play inside it. We can’t start, pause
              or mute it from the timer (that needs Spotify Premium + login).
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
