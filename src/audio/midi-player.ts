import {AdlMidi,AdlMidiCore} from 'libadlmidi-js/light';
import processorUrl from 'libadlmidi-js/dist/libadlmidi.light.processor.js?url';
import wasmUrl from 'libadlmidi-js/dist/libadlmidi.light.core.wasm?url';
import coreUrl from 'libadlmidi-js/dist/libadlmidi.light.core.js?url';
import {unlockAudioContext} from './user-activation';
import {MUSIC_BANK} from './music-bank';

export const DEFAULT_MUSIC_VOLUME=1;
/** Main-thread fallback buffer: large enough to ride out a busy frame on a phone. */
const FALLBACK_FRAMES=4096;

type Core=Awaited<ReturnType<typeof AdlMidiCore.create>>;
/** Where synthesis runs: the AudioWorklet when available, otherwise the WASM core on the main thread, feeding a
 * ScriptProcessorNode. AudioWorklet exists only in secure contexts (HTTPS or localhost), so a phone opening the dev
 * server over a LAN http:// address, or an older browser, uses the fallback. */
type Backend={kind:'worklet';synth:AdlMidi}|{kind:'core';core:Core;node:ScriptProcessorNode};

/** User-selected light FM synthesizer; simulation never depends on audio. */
export class MidiPlayer {
  private context?: AudioContext;
  private master?: GainNode;
  private backend?: Backend;
  private initialization?: Promise<void>;
  private pending: Promise<void> = Promise.resolve();
  private generation=0;
  private unsubscribe?:()=>void;
  private volume=DEFAULT_MUSIC_VOLUME;
  private active=false;
  /** Fallback playback state, read by the ScriptProcessorNode callback. */
  private corePlayback:{loop:boolean;onEnded?:()=>void}|null=null;
  get playing():boolean{return this.active;}
  get running():boolean{return this.context?.state==='running';}
  get backendKind():Backend['kind']|null{return this.backend?.kind??null;}
  /** Must be called synchronously inside a user-activation event (pointerup/touchend/click/keydown). Mobile browsers
   * only start or resume audio from such an event; a touch pointerdown does not count. Safe to repeat. */
  unlock():void{
    if(!this.context){
      const context=this.context=new AudioContext();
      const master=this.master=context.createGain();master.gain.value=this.volume;master.connect(context.destination);
    }
    unlockAudioContext(this.context);
  }
  async enable():Promise<void>{
    if(!this.context)this.unlock();
    const context=this.context!,master=this.master!;
    this.initialization??=('audioWorklet' in context&&context.audioWorklet?this.initWorklet(context,master):this.initCore(context,master))
      .catch(error=>{this.initialization=undefined;throw error;}); // a later gesture may retry
    await this.initialization;
    if(context.state!=='running')await context.resume();
  }
  private async initWorklet(context:AudioContext,master:GainNode):Promise<void>{
    const synth=new AdlMidi(context);
    await synth.init(processorUrl,wasmUrl);
    synth.node!.disconnect();synth.node!.connect(master);
    await synth.setBank(MUSIC_BANK);
    this.backend={kind:'worklet',synth};
  }
  private async initCore(context:AudioContext,master:GainNode):Promise<void>{
    const wasmBinary=await (await fetch(wasmUrl)).arrayBuffer();
    const core=await AdlMidiCore.create({corePath:new URL(coreUrl,location.href).href,wasmBinary});
    if(!core.init(context.sampleRate)||!core.setBank(MUSIC_BANK))throw new Error(`FM synthesizer: ${core.getErrorString()}`);
    const node=context.createScriptProcessor(FALLBACK_FRAMES,0,2);
    node.onaudioprocess=event=>{
      const left=event.outputBuffer.getChannelData(0),right=event.outputBuffer.getChannelData(1),playback=this.corePlayback;
      if(!playback){left.fill(0);right.fill(0);return;}
      const samples=core.play(left.length);
      for(let i=0;i<left.length;i++){left[i]=samples[i*2]??0;right[i]=samples[i*2+1]??0;}
      if(!playback.loop&&core.atEnd){
        this.corePlayback=null;const ended=playback.onEnded;
        // Leave the audio callback before changing tracks.
        if(ended)setTimeout(ended,0);
      }
    };
    node.connect(master);
    this.backend={kind:'core',core,node};
  }
  async play(midi:ArrayBuffer,onEnded?:()=>void):Promise<void>{
    this.stop();const generation=this.generation;
    await this.enable();
    // libadlmidi's load replies are uncorrelated; serialize loads to prevent a
    // superseded track's response from satisfying the next track's request.
    const load=this.pending.catch(()=>{}).then(async()=>{
      if(generation!==this.generation)return;
      const backend=this.backend!;
      if(backend.kind==='worklet'){
        const synth=backend.synth;
        await synth.loadMidi(midi);
        if(generation!==this.generation)return;
        synth.setLoopEnabled(!onEnded);
        if(onEnded)this.unsubscribe=synth.onPlaybackEnded(()=>{
          if(generation!==this.generation)return;
          this.stop();onEnded();
        });
        synth.play();
      }else{
        if(!backend.core.loadMidi(midi))throw new Error(`FM synthesizer: ${backend.core.getErrorString()}`);
        backend.core.setLoopEnabled(!onEnded);
        this.corePlayback={loop:!onEnded,onEnded:onEnded&&(()=>{if(generation!==this.generation)return;this.stop();onEnded();})};
      }
      this.active=true;
    });
    this.pending=load;await load;
  }
  setVolume(value:number):void{
    this.volume=Math.max(0,Math.min(1,value));
    if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,0.02);
  }
  stop():void{
    this.generation++;this.unsubscribe?.();this.unsubscribe=undefined;
    if(this.backend?.kind==='worklet')this.backend.synth.stop();
    else if(this.backend?.kind==='core'){this.corePlayback=null;this.backend.core.panic();}
    this.active=false;
  }
  dispose():void{
    this.stop();
    if(this.backend?.kind==='worklet')this.backend.synth.close();
    else if(this.backend?.kind==='core'){this.backend.node.onaudioprocess=null;this.backend.node.disconnect();this.backend.core.close();}
    this.master?.disconnect();
    if(this.context)void this.context.close();
    this.context=undefined;this.master=undefined;this.backend=undefined;this.initialization=undefined;
  }
}
