import { Binary } from './binary';
import { readBitmap, type Palette } from './graphics';
/** Overlay12:38b4a uses these strings and the160-entry tile-span table. */
const STRINGS={wreck:0x6ad1,water:0x6b04,town:0x6b5a,damage:0x6b9f,residential:0x6bf4,townBuilding:0x6c05,empty:0x6c20,programmer:0x6c33,unknown:0x6c73} as const;
export interface ExamineData { tileCounts:number[]; strings:Record<keyof typeof STRINGS,string> }
export function readExamineData(exe:Uint8Array):ExamineData {
  const b=new Binary(exe);
  return {tileCounts:[...b.slice(0x4ec60+0x99e,160)],strings:Object.fromEntries(Object.entries(STRINGS).map(([key,offset])=>{
    const start=0x846f0+offset;let end=start;while(b.slice(end,1)[0]!==0)end++;
    return [key,b.text(start,end-start)];
  })) as ExamineData['strings']};
}
export function readExamineDataJson(value:unknown):ExamineData {
  const d=value as ExamineData;
  if(!d||!Array.isArray(d.tileCounts)||d.tileCounts.length!==160||d.tileCounts.some(n=>!Number.isInteger(n)||n<0||n>255)||
    Object.keys(STRINGS).some(k=>typeof d.strings?.[k as keyof typeof STRINGS]!=='string'||d.strings[k as keyof typeof STRINGS].length>128))throw new Error('Invalid Examine metadata');
  return {tileCounts:[...d.tileCounts],strings:{...d.strings}};
}
/** examine.bmp contains no lettering; preserve its entire source frame. */
export function readExamineArtwork(bytes:Uint8Array,palette:Palette){
  const image=readBitmap(bytes,palette);
  if(image.width!==208||image.height!==208)throw new Error('Invalid Examine artwork');
  return image;
}
/** Source398bc returns0 for residential ranges; its caller's1 branch is unreachable (SF-161). */
export function examineTownTile(tile:number):boolean {
  for(let row=8;row<11;row++)for(let col=0;col<30;col++)if(tile===row*40+col)return true;
  for(let row=6;row<8;row++)for(let col=0;col<12;col++)if(tile===row*40+col)return true;
  return false;
}
/** Name-only reader4801c stops at the first tilde or @; keep physical128-byte records. */
export function examineItemName(bytes:Uint8Array,graphic:number):string {
  if(!Number.isInteger(graphic)||graphic<0)throw new Error('Invalid item text index');
  const text=new Binary(bytes).text(graphic*128,128);
  return text.split(/[~@]/)[0].replace(/\r?\n/g,' ').replace(/ +/g,' ').trim();
}
