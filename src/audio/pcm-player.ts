import type { PcmSound } from '../formats/voc';
import { unlockAudioContext } from './user-activation';

/** Short original PCM effects, independent of MIDI and simulation state. */
export class PcmPlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private master?: GainNode;
  get playing(): boolean { return Boolean(this.source); }
  get running(): boolean { return this.context?.state === 'running'; }
  /** Synchronous unlock from inside an activation event (see user-activation.ts). */
  unlock(): void { this.context ??= new AudioContext(); unlockAudioContext(this.context); }
  async enable(): Promise<void> {
    this.context ??= new AudioContext();
    await this.context.resume();
  }
  play(sound: PcmSound): void {
    this.stop();
    if (!this.context) return;
    if(!this.master){
      this.master=this.context.createGain();this.master.gain.value=0.75;this.master.connect(this.context.destination);
    }
    const buffer = this.context.createBuffer(1, sound.samples.length, sound.sampleRate);
    buffer.copyToChannel(sound.samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.connect(this.master);
    source.onended = () => { source.disconnect(); if (this.source === source) this.source = undefined; };
    this.source = source; source.start();
  }
  stop(): void {
    if (this.source) { this.source.stop(); this.source.disconnect(); this.source = undefined; }
  }
  dispose(): void { this.stop(); this.master?.disconnect(); this.master=undefined; if (this.context) void this.context.close(); this.context = undefined; }
}
