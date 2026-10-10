import { readBitmap, type Palette, type Raster } from './graphics';

/** DS6576 control chain; coordinates here exclude the sixteen-pixel title. */
export const AIRCRAFT_CONTROLS = [
  {id:1,x:21,y:3,width:38,height:38}, {id:2,x:197,y:5,width:38,height:38},
  {id:7,x:21,y:58,width:38,height:38}, {id:4,x:197,y:45,width:38,height:38},
  {id:8,x:21,y:113,width:38,height:38}, {id:3,x:197,y:85,width:38,height:38},
  {id:5,x:197,y:125,width:44,height:20}, {id:6,x:197,y:146,width:44,height:20},
] as const;
export const AIRCRAFT_TEXT_MASKS = [
  {x:110,y:41,width:30,height:10}, {x:102,y:89,width:44,height:10}, {x:98,y:137,width:54,height:10},
  {x:200,y:130,width:38,height:10}, {x:199,y:151,width:40,height:10},
] as const;
export function readAircraftArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==256||r.height!==176)throw new Error('Invalid Aircraft artwork');
  for(const b of AIRCRAFT_TEXT_MASKS)for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)
    r.rgba.set([...palette[12],255],(y*r.width+x)*4);
  return r;
}
