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
// Source4c673 and4b968: four 32px condition badges, assembled from tile539+4*(27-quality).
// They share one red segmented ring; only the grade letter (inside the ring) and the word
// (rows 22..29, overlapping the ring's lower edge) differ. Native shows one clean badge with
// HTML text, rebuilding the ring under the words from the badges that leave each pixel uncovered.
export const SELL_CONDITION_LETTER = {x:10,y:8,width:12,height:11} as const;
export const SELL_CONDITION_WORD_ROWS = {y:22,height:8} as const;
/** The four source badges as 32×32 rasters, in quality order 0..3. */
export function readSellConditionBadges(bytes: Uint8Array, palette: Palette): Raster[] {
  const b=new Binary(bytes);
  return [0,1,2,3].map(quality=>{
    const rgba=new Uint8Array(32*32*4);
    for(let tile=0;tile<4;tile++){
      const raster=decodePlanar(b.slice((539+4*(27-quality)+tile)*128,128),16,16,palette);
      for(let y=0;y<16;y++)rgba.set(raster.rgba.subarray(y*64,(y+1)*64),((Math.floor(tile/2)*16+y)*32+(tile%2)*16)*4);
    }
    return {width:32,height:32,rgba};
  });
}
/** Lettering pixels of a source badge: the letter box, and word pixels (palette14) in the word rows. */
export function isConditionLettering(badge: Raster, x: number, y: number, palette: Palette): boolean {
  const l=SELL_CONDITION_LETTER,w=SELL_CONDITION_WORD_ROWS;
  if(x>=l.x&&x<l.x+l.width&&y>=l.y&&y<l.y+l.height)return true;
  const o=(y*32+x)*4;
  return y>=w.y&&y<w.y+w.height&&palette[14].every((c,i)=>badge.rgba[o+i]===c);
}
/** One text-free badge. Each pixel takes the strict majority of the badges whose lettering leaves it
 * uncovered; ties and pixels covered in all four follow the ring's drop shadow (palette13 one pixel
 * below-right of a red palette3 pixel), otherwise face palette12. The letter box is ring interior. */
export function readSellCondition(bytes: Uint8Array, palette: Palette): Raster {
  const badges=readSellConditionBadges(bytes,palette),rgba=new Uint8Array(32*32*4),key=(c:ArrayLike<number>)=>`${c[0]},${c[1]},${c[2]}`;
  const red=key(palette[3]),l=SELL_CONDITION_LETTER;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const o=(y*32+x)*4;let value:number[]|null=null;
    if(!(x>=l.x&&x<l.x+l.width&&y>=l.y&&y<l.y+l.height)){
      const counts=new Map<string,{n:number;c:number[]}>();
      for(const badge of badges)if(!isConditionLettering(badge,x,y,palette)){
        const c=[...badge.rgba.subarray(o,o+3)],k=key(c),e=counts.get(k)??{n:0,c};e.n++;counts.set(k,e);
      }
      const ranked=[...counts.values()].sort((a,b)=>b.n-a.n);
      if(ranked.length&&(ranked.length===1||ranked[0].n>ranked[1].n))value=ranked[0].c;
      else value=x>0&&y>0&&key(rgba.subarray(((y-1)*32+x-1)*4,((y-1)*32+x-1)*4+3))===red?[...palette[13]]:[...palette[12]];
    }else value=[...palette[12]];
    rgba.set([...value,255],o);
  }
  return {width:32,height:32,rgba};
}
