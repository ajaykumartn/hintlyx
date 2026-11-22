import { concatFloat32, rms, toWav16k } from '@shared/audio'

/** How long each clip sent to Whisper is. ~4.5s balances latency against cut-off words. */
const CHUNK_MS = 4500
/** Carry this much audio into the next clip so words at the boundary are not lost. */
const OVERLAP_MS = 400
/** Skip clips quieter than this (silence), to avoid spending quota on nothing. */
const SILENCE_RMS = 0.004
const SCRIPT_BUFFER = 4096

export interface CaptureCallbacks {
  onText(text: string): void
  onError(message: string): void
  /** Reports which sources were actually captured. */
  onReady(sources: { system: boolean; mic: boolean }): void
}

/**
 * Captures system audio (the other person in a call) and the microphone, mixes them, and
 * emits ~4.5s WAV clips to the transcriber. Runs entirely in the renderer except the
 * network call, which goes through the main process so the API key stays there.
 */
export class AudioCapture {
  private ctx: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private streams: MediaStream[] = []
  private buffer: Float32Array[] = []
  private overlap: Float32Array = new Float32Array(0)
  private timer: ReturnType<typeof setInterval> | null = null
  private stopped = false
  private flushing = false

  constructor(private readonly cb: CaptureCallbacks) {}

  async start(): Promise<void> {
    this.stopped = false
    const ctx = new AudioContext()
    this.ctx = ctx
    const mix = ctx.createGain()

    let system = false
    let mic = false

    // System audio via loopback (main supplies the source, so no picker appears).
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      display.getVideoTracks().forEach((t) => t.stop()) // we only want the audio
      const audioTracks = display.getAudioTracks()
      if (audioTracks.length > 0) {
        ctx.createMediaStreamSource(new MediaStream(audioTracks)).connect(mix)
        system = true
        this.streams.push(display)
      }
    } catch {
      /* loopback not available; fall back to mic only */
    }

    // Microphone (the user's own voice).
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      })
      ctx.createMediaStreamSource(micStream).connect(mix)
      mic = true
      this.streams.push(micStream)
    } catch {
      /* mic denied or missing */
    }

    if (!system && !mic) {
      this.cb.onError('No audio source available. Allow microphone access or share system audio.')
      await this.stop()
      return
    }

    const processor = ctx.createScriptProcessor(SCRIPT_BUFFER, 1, 1)
    processor.onaudioprocess = (e) => {
      if (this.stopped) return
      this.buffer.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }
    mix.connect(processor)
    // ScriptProcessor only runs when connected to the destination; a zero gain keeps it silent.
    const mute = ctx.createGain()
    mute.gain.value = 0
    processor.connect(mute)
    mute.connect(ctx.destination)
    this.processor = processor

    this.timer = setInterval(() => void this.flush(), CHUNK_MS)
    this.cb.onReady({ system, mic })
  }

  private async flush(): Promise<void> {
    if (this.stopped || this.flushing || !this.ctx) return
    const chunks = this.buffer
    this.buffer = []
    if (chunks.length === 0) return

    const fresh = concatFloat32(chunks)
    const clip = this.overlap.length ? concatFloat32([this.overlap, fresh]) : fresh
    const rate = this.ctx.sampleRate
    const overlapSamples = Math.floor((OVERLAP_MS / 1000) * rate)
    this.overlap = fresh.length > overlapSamples ? fresh.slice(fresh.length - overlapSamples) : fresh

    if (rms(clip) < SILENCE_RMS) return

    this.flushing = true
    try {
      const wav = toWav16k(clip, rate)
      const result = await window.hintlyx.transcribe(wav)
      if (this.stopped) return
      if (result.error) this.cb.onError(result.error)
      else if (result.text) this.cb.onText(result.text)
    } catch (err) {
      this.cb.onError(err instanceof Error ? err.message : String(err))
    } finally {
      this.flushing = false
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.processor?.disconnect()
    this.processor = null
    for (const s of this.streams) s.getTracks().forEach((t) => t.stop())
    this.streams = []
    this.buffer = []
    this.overlap = new Float32Array(0)
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close()
    this.ctx = null
  }
}
