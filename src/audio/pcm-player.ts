import type { PcmSound } from '../formats/voc';
import { unlockAudioContext } from './user-activation';

/** Full-scale effect gain; the volume slider scales it (100% keeps the original mix level). */
const EFFECT_GAIN=0.75;

/** Short original PCM effects, independent of MIDI and simulation state. */
export class PcmPlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private master?: GainNode;
  private volume=1;
  get playing(): boolean { return Boolean(this.source); }
  get running(): boolean { return this.context?.state === 'running'; }
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
    this.stop();
    if (!this.context||!this.master) return;
    const buffer = this.context.createBuffer(1, sound.samples.length, sound.sampleRate);
    buffer.copyToChannel(sound.samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.connect(this.master);
    source.onended = () => { source.disconnect(); if (this.source === source) this.source = undefined; };
    this.source = source; source.start();
  }
  setVolume(value: number): void {
    this.volume=Math.max(0,Math.min(1,value));
    // Set directly: a scheduled ramp only advances while the context runs, and effects are short.
    if(this.master)this.master.gain.value=EFFECT_GAIN*this.volume;
  }
  stop(): void {
    if (this.source) { this.source.stop(); this.source.disconnect(); this.source = undefined; }
  }
  dispose(): void { this.stop(); this.master?.disconnect(); this.master=undefined; if (this.context) void this.context.close(); this.context = undefined; }
}
