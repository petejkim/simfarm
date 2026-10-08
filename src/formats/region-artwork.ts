import { readInterleavedScreen, type Palette } from './graphics';

export interface RegionArtwork { indices: Uint8Array; palette: Palette }

/** Keep palette indices: the source selection XORs all four planes, which is
 * different from inverting RGB. Reuse the verified INT scanline decoder. */
export function readRegionArtwork(bytes: Uint8Array, palette: Palette): RegionArtwork {
  const indexed = readInterleavedScreen(bytes, Array.from({ length: 16 }, (_, i) => [i, i, i]));
  return { indices: Uint8Array.from({ length: 640 * 480 }, (_, i) => indexed.rgba[i * 4]), palette };
}
