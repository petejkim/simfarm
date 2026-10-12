import { miniTileAtlas, readBitmap, type Palette, type Raster } from './graphics';

export interface MapMiniature extends Raster { inverted: Raster }
/** Decode XOR colors from the original indices: palette7 and11 share RGB,
 * so reversing RGBA back into indices loses information. */
export function readMapMiniature(bytes: Uint8Array, palette: Palette): MapMiniature {
  return { ...miniTileAtlas(bytes,palette), inverted:miniTileAtlas(bytes,palette.map((_,i)=>palette[i^15])) };
}

// EXE50359: nine20-byte strings; descriptor DS68ce and controls DS68b8.
export const MAP_MODES = ['Overhead', 'Property', 'Soil Toxicity', 'Soil Nutrients', 'Disease', 'Pests', 'Weeds', 'Groundwater', 'Field Profit'] as const;
export type MapMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const MAP_BUTTONS = [
  { mode:1,x:10,y:3 }, { mode:6,x:40,y:3 }, { mode:2,x:10,y:33 }, { mode:7,x:40,y:33 },
  { mode:3,x:10,y:63 }, { mode:8,x:40,y:63 }, { mode:4,x:10,y:93 }, { mode:5,x:40,y:93 },
] as const;
export const MAP_TEXT_MASKS = [
  { x:31,y:127,width:16,height:19,color:12 }, { x:20,y:161,width:36,height:18,color:12 },
  { x:227,y:209,width:42,height:11,color:12 },
] as const;
export function readMapArtwork(bytes: Uint8Array, palette: Palette): Raster {
  const raster = readBitmap(bytes, palette);
  if (raster.width !== 288 || raster.height !== 240) throw new Error('Invalid Map artwork dimensions');
  for (const r of MAP_TEXT_MASKS) for (let y=r.y;y<r.y+r.height;y++) for(let x=r.x;x<r.x+r.width;x++)
    raster.rgba.set([...palette[r.color],255],(y*288+x)*4);
  return raster;
}
