import {AdlMidi} from 'libadlmidi-js/light';
import processorUrl from 'libadlmidi-js/dist/libadlmidi.light.processor.js?url';
import wasmUrl from 'libadlmidi-js/dist/libadlmidi.light.core.wasm?url';

export const DEFAULT_MUSIC_VOLUME=1;

/** User-selected light FM synthesizer; simulation never depends on audio. */
export class MidiPlayer {
  private context?: AudioContext;
  private master?: GainNode;
  private synth?: AdlMidi;
  private initialization?: Promise<void>;
  private pending: Promise<void> = Promise.resolve();
  private generation=0;
  private unsubscribe?:()=>void;
  private volume=DEFAULT_MUSIC_VOLUME;
  private active=false;
  get playing():boolean{return this.active;}
  async enable():Promise<void>{
    if(!this.context){
      const context=this.context=new AudioContext();
      const master=this.master=context.createGain();master.gain.value=this.volume;master.connect(context.destination);
      const synth=this.synth=new AdlMidi(context);
      // Unlock synchronously in the initiating user gesture.
      void context.resume();
      this.initialization=synth.init(processorUrl,wasmUrl).then(async()=>{
        synth.node!.disconnect();synth.node!.connect(master);
        await synth.setBank(39);
      });
    }
    await this.context.resume();await this.initialization;
  }
  async play(midi:ArrayBuffer,onEnded?:()=>void):Promise<void>{
    this.stop();const generation=this.generation;
    await this.enable();
    // libadlmidi's load replies are uncorrelated; serialize loads to prevent a
    // superseded track's response from satisfying the next track's request.
    const load=this.pending.catch(()=>{}).then(async()=>{
      if(generation!==this.generation)return;
      const synth=this.synth!;
      await synth.loadMidi(midi);
      if(generation!==this.generation)return;
      synth.setLoopEnabled(!onEnded);
      if(onEnded)this.unsubscribe=synth.onPlaybackEnded(()=>{
        if(generation!==this.generation)return;
        this.stop();onEnded();
      });
      synth.play();this.active=true;
    });
    this.pending=load;await load;
  }
  setVolume(value:number):void{
    this.volume=Math.max(0,Math.min(1,value));
    if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,0.02);
  }
  stop():void{
    this.generation++;this.unsubscribe?.();this.unsubscribe=undefined;
    this.synth?.stop();this.active=false;
  }
  dispose():void{
    this.stop();this.synth?.close();this.master?.disconnect();
    if(this.context)void this.context.close();
    this.context=undefined;this.master=undefined;this.synth=undefined;this.initialization=undefined;
  }
}
