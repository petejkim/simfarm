import { Binary } from './binary';
import { decodePlanar, readBitmap, type Palette, type Raster } from './graphics';

export const SELL_TEXT_MASKS = [{ x:91,y:222,width:34,height:12 },{ x:131,y:222,width:42,height:12 }] as const;
export function readSellArtwork(bytes: Uint8Array, palette: Palette): Raster {
  const raster = readBitmap(bytes,palette);
  if (raster.width !== 192 || raster.height !== 256) throw new Error('Invalid Sell artwork dimensions');
  for (const r of SELL_TEXT_MASKS) for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)
    raster.rgba.set([...palette[12],255],(y*192+x)*4);
  return raster;
}
// Source4c673 and4b968: four32px condition badges, assembled from tile539+4*(27-quality).
// Replace both letter markers and words with HTML. Keep the surrounding rings/borders.
export const SELL_CONDITION_MASKS = [{x:10,y:8,width:12,height:11},{x:2,y:22,width:28,height:9}] as const;
export function readSellConditions(bytes: Uint8Array, palette: Palette): Raster {
  const b=new Binary(bytes), rgba=new Uint8Array(128*32*4);
  for(let quality=0;quality<4;quality++)for(let tile=0;tile<4;tile++) {
    const raster=decodePlanar(b.slice((539+4*(27-quality)+tile)*128,128),16,16,palette);
    for(let y=0;y<16;y++)rgba.set(raster.rgba.subarray(y*64,(y+1)*64),((Math.floor(tile/2)*16+y)*128+quality*32+(tile%2)*16)*4);
  }
  for(let q=0;q<4;q++)for(const r of SELL_CONDITION_MASKS)for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)
    rgba.set([...palette[12],255],(y*128+q*32+x)*4);
  return {width:128,height:32,rgba};
}
