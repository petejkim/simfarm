import type {Scenario} from '../formats/scenario';
import type {CropDefinition} from '../formats/crop';
import type {MarketState} from './market';

/** Source4a640 uses base/8 (minimum1), then four pixels per step around16.
 * SF-164: clip extreme values without wrapping screen coordinates as words. */
export function marketBarTop(price:number,base:number):number {
  if(![price,base].every(n=>Number.isInteger(n)&&n>=0&&n<=65535))throw new Error('Invalid market graph value');
  const step=Math.max(1,base>>>3),level=16+(price>base?Math.floor((price-base)/step):-Math.floor((base-price)/step));
  const top=159-level*4;
  return top<20?22:top>158?156:top;
}
/** Read-only source4a750 projection. Trade price can differ from history[29]. */
export function marketWindowView(world:Scenario,market:MarketState,crops:readonly CropDefinition[],slot:number){
  if(!Number.isInteger(slot)||slot<0||slot>=world.cropFiles.length)throw new Error('Invalid market crop slot');
  const crop=crops.find(c=>`${c.id}.crp`===world.cropFiles[slot]);if(!crop)throw new Error('Missing market crop');
  const raw=crop.rawDefinition,base=raw[34]|raw[35]<<8,yieldWord=raw[32]|raw[33]<<8,definition=world.cropDefinitions[slot];
  return {slot,name:crop.name,price:(Math.floor(definition.price/10)*yieldWord)&65535,
    futuresOwned:definition.count<<16>>16,
    history:market.history[slot].map(price=>({price,top:price===null?null:marketBarTop(price,base)}))};
}
