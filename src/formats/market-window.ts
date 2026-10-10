import { readBitmap,type Palette,type Raster } from './graphics';

export const MARKET_TEXT_MASKS=[
  {x:26,y:8,width:120,height:11}, {x:160,y:146,width:34,height:11}, {x:160,y:159,width:34,height:11},
  {x:12,y:180,width:100,height:12}, {x:262,y:179,width:41,height:12},
] as const;
export function readMarketArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==320||r.height!==208)throw new Error('Invalid Market artwork');
  for(const b of MARKET_TEXT_MASKS)for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)
    r.rgba.set([...palette[12],255],(y*r.width+x)*4);
  return r;
}
