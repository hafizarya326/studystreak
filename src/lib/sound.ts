/**
 * Asset-free audio engine (Web Audio API).
 * Generates the session chime and ambient noise beds on the fly so the app
 * ships with zero audio downloads.
 */
import type { AmbientSoundId } from '../types'

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: { source: AudioBufferSourceNode; gain: GainNode; lfo?: OscillatorNode } | null =
    null

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!this.ctx) {
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 1
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** Short, warm completion chime. */
  playChime(volume = 0.5): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    const notes = [659.25, 830.61, 987.77] // E5, G#5, B5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const start = now + i * 0.11
      const peak = Math.max(0.0001, volume * 0.5)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.85)
      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(start)
      osc.stop(start + 0.9)
    })
  }

  /** A softer tick/click used for UI feedback (start, pause). */
  playClick(volume = 0.35): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12)
    gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.4), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.18)
  }

  private noiseBuffer(ctx: AudioContext, kind: 'white' | 'brown'): AudioBuffer {
    const seconds = 4
    const length = ctx.sampleRate * seconds
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    if (kind === 'white') {
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    } else {
      let last = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    }
    return buffer
  }

  startAmbient(id: AmbientSoundId, volume = 0.35): void {
    this.stopAmbient()
    if (id === 'none') return
    const ctx = this.ensure()
    if (!ctx || !this.master) return

    const kind = id === 'white' ? 'white' : 'brown'
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer(ctx, kind)
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = id === 'waves' ? 620 : id === 'cafe' ? 1100 : 900
    filter.Q.value = 0.6

    const gain = ctx.createGain()
    gain.gain.value = 0.0001

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)

    // Gentle swell so it doesn't start abruptly.
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), ctx.currentTime + 1.2)

    let lfo: OscillatorNode | undefined
    if (id === 'waves') {
      lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = 0.08
      lfoGain.gain.value = 260
      lfo.connect(lfoGain)
      lfoGain.connect(filter.frequency)
      lfo.start()
    }

    source.start()
    this.ambient = { source, gain, lfo }
  }

  setAmbientVolume(volume: number): void {
    if (this.ambient && this.ctx) {
      this.ambient.gain.gain.setTargetAtTime(
        Math.max(0.001, volume),
        this.ctx.currentTime,
        0.2,
      )
    }
  }

  stopAmbient(): void {
    if (!this.ambient || !this.ctx) return
    const { source, gain, lfo } = this.ambient
    try {
      gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15)
      source.stop(this.ctx.currentTime + 0.7)
      lfo?.stop(this.ctx.currentTime + 0.7)
    } catch {
      /* already stopped */
    }
    this.ambient = null
  }

  get isAmbientPlaying(): boolean {
    return this.ambient !== null
  }

  /** Called after a user gesture so browsers allow audio. */
  unlock(): void {
    this.ensure()
  }
}

export const soundEngine = new SoundEngine()
