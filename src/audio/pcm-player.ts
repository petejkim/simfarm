import type { PcmSound } from '../formats/voc';

/** Short original PCM effects, independent of MIDI and simulation state. */
export class PcmPlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  get playing(): boolean { return Boolean(this.source); }
  async enable(): Promise<void> {
    this.context ??= new AudioContext();
    await this.context.resume();
  }
  play(sound: PcmSound): void {
    this.stop();
    if (!this.context) return;
    const buffer = this.context.createBuffer(1, sound.samples.length, sound.sampleRate);
    buffer.copyToChannel(sound.samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.connect(this.context.destination);
    source.onended = () => { source.disconnect(); if (this.source === source) this.source = undefined; };
    this.source = source; source.start();
  }
  stop(): void {
    if (this.source) { this.source.stop(); this.source.disconnect(); this.source = undefined; }
  }
  dispose(): void { this.stop(); if (this.context) void this.context.close(); this.context = undefined; }
}
