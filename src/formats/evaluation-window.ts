import {readBitmap,type Palette,type Raster} from './graphics';

export const EVALUATION_LABELS=[
  {x:184,y:82,width:28,height:12,text:'Low'},
  {x:246,y:82,width:34,height:12,text:'High'},
  {x:16,y:99,width:128,height:11,text:'Problems'},
  {x:152,y:99,width:128,height:11,text:'Suggested Crops'},
  {x:292,y:158,width:40,height:12,text:'CLOSE'},
] as const;
/** DS43f9 evaluate.bmp. Remove only black lettering; keep original bevels. */
export function readEvaluationArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==352||r.height!==192)throw new Error('Invalid Evaluation artwork');
  for(const m of EVALUATION_LABELS)for(let y=m.y;y<m.y+m.height;y++)for(let x=m.x;x<m.x+m.width;x++){
    const i=(y*r.width+x)*4;
    if(r.rgba[i]===0&&r.rgba[i+1]===0&&r.rgba[i+2]===0)r.rgba.set([...palette[12],255],i);
  }
  return r;
}
