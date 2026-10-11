import type {MidiEvent,MidiLoop} from '../formats/xmidi';
export interface LoopEvent extends MidiEvent { voiceKey?:string }
/** Events in a half-open audio-clock window. Arithmetic cycle selection avoids
 * traversing missed iterations after a background-tab suspension. */
export function midiLoopWindow(loop:MidiLoop,from:number,to:number):LoopEvent[]{
  const period=loop.endTick-loop.startTick;
  if(!Number.isFinite(period)||period<=0||!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<from||to-from>1200)
    throw new Error('Invalid MIDI loop scheduling window');
  const result:LoopEvent[]=[];
  const add=(event:MidiEvent,cycle:number)=>{
    result.push({...event,tick:event.tick+cycle*period,...(event.voice===undefined?{}:{voiceKey:`${cycle}:${event.voice}`})});
  };
  for(const event of loop.initialEvents)if(event.tick>=from&&event.tick<to)add(event,0);
  for(const event of loop.events){
    const first=Math.max(1,Math.ceil((from-event.tick)/period)),last=Math.ceil((to-event.tick)/period)-1;
    for(let cycle=first;cycle<=last;cycle++)add(event,cycle);
  }
  return result.sort((a,b)=>a.tick-b.tick);
}
