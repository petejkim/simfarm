import { decodePlanar, readBitmap, type Palette, type Raster } from './graphics';

export const SCHEDULE_TEXT_MASKS = [
  {x:30,y:42,width:36,height:12}, {x:272,y:42,width:32,height:12},
  {x:276,y:64,width:42,height:11}, {x:280,y:80,width:34,height:11}, {x:276,y:104,width:42,height:11},
  {x:11,y:130,width:91,height:12}, {x:42,y:145,width:60,height:12},
  {x:216,y:130,width:36,height:12}, {x:204,y:145,width:58,height:12},
  {x:18,y:200,width:50,height:12}, {x:78,y:200,width:42,height:12}, {x:132,y:200,width:44,height:12},
  {x:218,y:200,width:40,height:12}, {x:276,y:200,width:32,height:12},
] as const;
export function readScheduleArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==336||r.height!==224)throw new Error('Invalid Schedule artwork');
  for(const b of SCHEDULE_TEXT_MASKS)for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)r.rgba.set([...palette[12],255],(y*r.width+x)*4);
  return r;
}
/**4a196 seeks signed index*576 in fldgrph.til; each frame48×24. */
export function readFieldGauges(bytes:Uint8Array,palette:Palette):Raster {
  if(bytes.length!==11520)throw new Error('Invalid field gauge library');
  const rgba=new Uint8Array(960*24*4);
  for(let i=0;i<20;i++){
    const frame=decodePlanar(bytes.subarray(i*576,(i+1)*576),48,24,palette);
    for(let y=0;y<24;y++)rgba.set(frame.rgba.subarray(y*192,(y+1)*192),(y*960+i*48)*4);
  }
  return {width:960,height:24,rgba};
}
export const SCHEDULE_ACTIONS = [
  {kind:'harvest',label:'Harvest',tile:440,badge:30}, {kind:'contract',label:'Contract',tile:198,badge:29},
  {kind:'fertilizer',label:'Fertilize',tile:915,badge:23}, {kind:'pesticide',label:'Pesticide',tile:914,badge:16},
  {kind:'herbicide',label:'Herbicide',tile:913,badge:20}, {kind:'fungicide',label:'Fungicide',tile:912,badge:21},
] as const;
