import { decodePlanar, type Raster } from './graphics';

export interface PreviewMarkers { home: Raster; town: Raster }
/** Loader491d7 reads3008 bytes of egafont.fnt into2d9f:9424.
 *33d79/33db9 select glyph52(T)/40(H);6cc3 draws eight rows per plane
 * with set/reset color0. These two glyphs have identical masks in all planes. */
export function readPreviewMarkers(bytes: Uint8Array): PreviewMarkers {
  if (bytes.length < 3008) throw new Error('Truncated terrain preview font');
  const glyph = (index: number): Raster => {
    const mask = bytes.subarray(index * 32, index * 32 + 32);
    for (let plane = 1; plane < 4; plane++) for (let row = 0; row < 8; row++) {
      if (mask[plane * 8 + row] !== mask[row]) throw new Error('Unsupported preview marker mask');
    }
    return decodePlanar(mask, 8, 8, Array.from({ length: 16 }, () => [0, 0, 0]), 0);
  };
  return { home: glyph(40), town: glyph(52) };
}
