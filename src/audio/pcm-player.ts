import type { PcmSound } from '../formats/voc';
import { unlockAudioContext } from './user-activation';

/** Full-scale effect gain; the volume slider scales it (100% keeps the original mix level). */
const EFFECT_GAIN=0.75;
/** Overlap cap: rapid repeats (e.g. dragging a road) would otherwise stack without bound; the oldest voice yields. */
const MAX_VOICES=8;

/** Short original PCM effects, independent of MIDI and simulation state. Native enhancement (user request):
 * effects overlap instead of replacing each other on the original's single Sound Blaster voice. */
export class PcmPlayer {
  private context?: AudioContext;
  private master?: GainNode;
  private voices: { source: AudioBufferSourceNode; sound: PcmSound }[] = [];
  private volume=1;
  get playing(): boolean { return this.voices.length > 0; }
  get running(): boolean { return this.context?.state === 'running'; }
  isPlaying(sound: PcmSound): boolean { return this.voices.some(voice => voice.sound === sound); }
  /** Synchronous unlock from inside an activation event (see user-activation.ts). */
  unlock(): void { unlockAudioContext(this.ensureContext()); }
  async enable(): Promise<void> { await this.ensureContext().resume(); }
  private ensureContext(): AudioContext {
    if(!this.context){
      this.context=new AudioContext();
      this.master=this.context.createGain();this.master.gain.value=EFFECT_GAIN*this.volume;this.master.connect(this.context.destination);
    }
    return this.context;
  }
  play(sound: PcmSound): void {
    if (!this.context||!this.master) return;
    while (this.voices.length >= MAX_VOICES) this.end(this.voices[0]);
    const buffer = this.context.createBuffer(1, sound.samples.length, sound.sampleRate);
    buffer.copyToChannel(sound.samples, 0);
    const source = this.context.createBufferSource(), voice = { source, sound };
    source.buffer = buffer; source.connect(this.master);
    source.onended = () => { source.disconnect(); this.voices = this.voices.filter(v => v !== voice); };
    this.voices.push(voice); source.start();
  }
  setVolume(value: number): void {
    this.volume=Math.max(0,Math.min(1,value));
    // Set directly: a scheduled ramp only advances while the context runs, and effects are short.
    if(this.master)this.master.gain.value=EFFECT_GAIN*this.volume;
  }
  /** Stops every voice, or only those playing the given sound. */
  stop(sound?: PcmSound): void {
    for (const voice of this.voices.filter(v => !sound || v.sound === sound)) this.end(voice);
  }
  private end(voice: { source: AudioBufferSourceNode }): void {
    this.voices = this.voices.filter(v => v !== voice);
    try { voice.source.stop(); } catch { /* not started */ }
    voice.source.disconnect();
  }
  dispose(): void { this.stop(); this.master?.disconnect(); this.master=undefined; if (this.context) void this.context.close(); this.context = undefined; }
}
