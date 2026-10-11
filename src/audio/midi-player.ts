import {midiLoopWindow} from './midi-loop';
import type { MidiSequence } from '../formats/xmidi';
interface Voice { voiceKey?:string; node: AudioScheduledSourceNode; envelope: GainNode; channel: number; note: number; released: boolean }
/** Native MIDI event player. Simple non-FM timbres are temporary pending a GM sample bank. */
export class MidiPlayer {
  private context?: AudioContext;
  private master?: GainNode;
  private channels: { program: number; gain: GainNode; pan: StereoPannerNode }[] = [];
  private voices = new Set<Voice>();
  private timer?: ReturnType<typeof setInterval>;
  private noise?: AudioBuffer;
  private generation = 0;
  private index = 0;
  private scheduledTick = 0;
  private origin = 0;
  private sequence?: MidiSequence;
  private volume = 0.25;
  private onEnded?: () => void;
  get playing(): boolean { return this.timer !== undefined; }
  async enable():Promise<void>{
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.channels = Array.from({ length: 16 }, () => {
        const gain = this.context!.createGain(), pan = this.context!.createStereoPanner();
        gain.connect(pan).connect(this.master!);
        return { program: 0, gain, pan };
      });
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    await this.context.resume();
  }
  async play(sequence: MidiSequence, onEnded?: () => void): Promise<void> {
    this.stop();
    const generation = this.generation;
    await this.enable();
    if (generation !== this.generation) return;
    this.sequence = sequence;
    this.onEnded = onEnded;
    this.resetChannels();
    this.origin = this.context!.currentTime + 0.06;
    this.index = 0;
    this.scheduledTick = 0;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
  }
  stop(): void {
    this.generation++;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    for (const voice of this.voices) { try { voice.node.stop(); } catch { /* Already ended. */ } voice.envelope.disconnect(); }
    this.voices.clear();
    this.sequence = undefined;
    this.onEnded = undefined;
  }
  dispose(): void {
    this.stop();
    if (this.context) void this.context.close();
    this.context = undefined; this.master = undefined; this.noise = undefined; this.channels = [];
  }
  private resetChannels(): void {
    for (const c of this.channels) {
      c.program = 0;
      c.gain.gain.cancelScheduledValues(0); c.gain.gain.value = 100 / 127;
      c.pan.pan.cancelScheduledValues(0); c.pan.pan.value = 0;
    }
  }
  private schedule(): void {
    const context = this.context!, sequence = this.sequence;
    if (!sequence) return;
    if(sequence.loop){
      const now=Math.max(0,(context.currentTime-this.origin)*120),horizon=Math.max(0,(context.currentTime+0.12-this.origin)*120);
      if(now-this.scheduledTick>24){
        // Skip missed notes after throttling, retaining the source loop phase.
        for(const voice of this.voices){try{voice.node.stop();}catch{/* Ended. */}voice.envelope.disconnect();}
        this.voices.clear();this.scheduledTick=now;
      }
      for(const event of midiLoopWindow(sequence.loop,this.scheduledTick,horizon))
        this.send(event.data,Math.max(context.currentTime,this.origin+event.tick/120),event.voiceKey);
      this.scheduledTick=horizon;
      return;
    }
    // One-shot completion also applies after background-tab throttling.
    if (this.onEnded && context.currentTime >= this.origin + sequence.endTick / 120 + 0.2) {
      const done = this.onEnded; this.stop(); done(); return;
    }
    // Avoid bursts of stale notes after background-tab timer throttling.
    if (context.currentTime - this.origin > sequence.endTick / 120 + 0.2) {
      for (const v of this.voices) { try { v.node.stop(); } catch { /* Ended. */ } }
      this.voices.clear(); this.index = 0; this.origin = context.currentTime + 0.06; this.resetChannels();
    }
    const horizon = context.currentTime + 0.12;
    while (this.index < sequence.events.length) {
      const event = sequence.events[this.index], time = this.origin + event.tick / 120;
      if (time > horizon) break;
      this.send(event.data, Math.max(time, context.currentTime),event.voice===undefined?undefined:`0:${event.voice}`);
      this.index++;
    }
    if (this.index === sequence.events.length && context.currentTime >= this.origin + sequence.endTick / 120 + 0.2) {
      this.index = 0; this.origin = context.currentTime + 0.06; this.resetChannels();
    }
  }
  private send(data: number[], time: number,voiceKey?:string): void {
    const [status, key, value = 0] = data, kind = status >> 4, channel = status & 15;
    const c = this.channels[channel], context = this.context!;
    if (kind === 12) { c.program = key; return; }
    if (kind === 11) {
      if (key === 7) c.gain.gain.setValueAtTime(value / 127, time);
      if (key === 10) c.pan.pan.setValueAtTime((value - 64) / 64, time);
      return;
    }
    if (kind === 8 || (kind === 9 && !value)) {
      for (const voice of this.voices) if (!voice.released && voice.channel === channel && voice.note === key && (voiceKey===undefined||voice.voiceKey===voiceKey)) {
        voice.envelope.gain.setTargetAtTime(0, time, 0.03);
        voice.node.stop(time + 0.18);
        // Keep released voices tracked so Stop also silences their release tails.
        voice.released = true;
      }
      return;
    }
    if (kind !== 9) return;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(value / 127 * 0.11, time + 0.008);
    envelope.connect(c.gain);
    let node: AudioScheduledSourceNode;
    if (channel === 9) {
      if (key === 35 || key === 36) {
        const oscillator = context.createOscillator(); oscillator.frequency.setValueAtTime(140, time);
        oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.12); node = oscillator;
      } else {
        const noise = context.createBufferSource(); noise.buffer = this.noise!;
        const filter = context.createBiquadFilter(); filter.type = key >= 42 ? 'highpass' : 'bandpass';
        filter.frequency.value = key >= 42 ? 6500 : 1600;
        noise.connect(filter).connect(envelope); node = noise;
      }
      if (key === 35 || key === 36) node.connect(envelope);
      envelope.gain.setTargetAtTime(0, time + 0.01, 0.035);
    } else {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 440 * 2 ** ((key - 69) / 12);
      const family = Math.floor(c.program / 8);
      oscillator.type = family === 2 || family === 7 ? 'sine' : family === 5 || family === 6 ? 'sawtooth' : 'triangle';
      oscillator.connect(envelope); node = oscillator;
    }
    const voice = { node, envelope, channel, note: key, released: false,voiceKey };
    this.voices.add(voice);
    node.onended = () => { this.voices.delete(voice); node.disconnect(); envelope.disconnect(); };
    node.start(time);
    if (channel === 9) node.stop(time + 0.25);
  }
}
