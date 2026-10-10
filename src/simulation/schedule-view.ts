import { Binary } from '../formats/binary';
import type { CropDefinition } from '../formats/crop';
import type { FieldRecord } from '../formats/field';
import type { Scenario } from '../formats/scenario';
import { cropMaturity, fieldHarvestValue, harvestLoss } from './harvest-value';

/** Original Schedule paint2d2b2..2d97a. Pure presentation projection: do not
 * reproduce its1c50a write to cached field+28 while merely opening a window. */
export function scheduleFieldView(world:Scenario,field:FieldRecord,crop:CropDefinition,month:number){
  if(!Number.isInteger(month)||month<0||month>57||!field.active||crop.rawDefinition.length!==128)throw new Error('Invalid Schedule field');
  const b=field.bytes,c=crop.rawDefinition,f=new Binary(b);
  const lower=Math.max(0,(c[40]-2*b[51])<<24>>24),upper=((c[42]+2*b[52])<<24>>24)&65535;
  const middle=(lower+(((upper-lower)&65535)>>>1))&65535,water=f.u16(24);
  const waterBand=water<lower?0:water<middle?1:water<upper?2:4;
  const week=world.farm.calendar.month*4+world.farm.calendar.week;
  const season=week>=45||week<10?0:week<=23?1:week<=34?2:3;
  return {value:fieldHarvestValue(field,c,world.cropDefinitions[field.cropSlot].price),
    maturityPixels:(cropMaturity(field,c)>>>12)*5,quality:3-(harvestLoss(field,c)>>>14),
    gauges:[Math.floor(b[22]/52),Math.floor(b[20]/52),Math.floor(b[21]/52),5+waterBand,10+Math.floor(b[29]/52)],
    season:['Winter','Spring','Summer','Fall'][season],year:(world.farm.calendar.year+Math.floor(month/12))&65535};
}
/**2da6f/2d99f: source annotations for crop water and heat requirements. */
export function scheduleCropHint(crop:CropDefinition,mode:'water'|'temperature'):number {
  const b=new Binary(Uint8Array.from(crop.rawDefinition));
  return mode==='water'?b.u16(40)>>>1:Math.floor(b.u16(30)/7)+50;
}
