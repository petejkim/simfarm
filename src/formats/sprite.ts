import { Binary } from './binary';
import { decodePlanar, type Palette, type Raster } from './graphics';

/** Flight sprites loaded0x4936e..0x493da; tornado/swarm0x36899/0x36be4.
 * Header parsed0xb95c..0xb9be.
 * A frame is one VGA write-mask plane followed by four colour planes. */
export function readSprite(bytes: Uint8Array, palette: Palette): { frames: Raster[]; edgeMask: number; flags: number } {
  if (bytes.length < 10) throw new Error('Invalid sprite header');
  const b = new Binary(bytes), count = b.u16(0), height = b.u16(2), stride = b.u16(4), planeBytes = b.u16(6);
  if (!count || count > 256 || !height || height > 255 || !stride || stride > 255 ||
    planeBytes !== stride * height || bytes.length !== 10 + count * planeBytes * 5) throw new Error('Invalid sprite layout');
  // Only the complete-byte, five-plane source resources are reconstructed here.
  if (bytes[8] !== 255 || bytes[9] !== 1) throw new Error('Unsupported sprite flags');
  const frames: Raster[] = [];
  for (let frame = 0; frame < count; frame++) {
    const start = 10 + frame * planeBytes * 5, mask = bytes.subarray(start, start + planeBytes);
    const raster = decodePlanar(bytes.subarray(start + planeBytes, start + planeBytes * 5), stride * 8, height, palette);
    // EGA bit-mask register8 receives this plane0x7b0a..0x7b10: set bits write colour, clear bits retain background.
    for (let y = 0; y < height; y++) for (let x = 0; x < stride * 8; x++)
      raster.rgba[(y * stride * 8 + x) * 4 + 3] = mask[y * stride + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0;
    frames.push(raster);
  }
  return { frames, edgeMask: bytes[8], flags: bytes[9] };
}

export function spriteAtlas(bytes: Uint8Array, palette: Palette): Raster {
  const { frames } = readSprite(bytes, palette), width = frames[0].width * frames.length, height = frames[0].height;
  const rgba = new Uint8Array(width * height * 4);
  frames.forEach((f, i) => {
    for (let y = 0; y < height; y++) rgba.set(f.rgba.subarray(y * f.width * 4, (y + 1) * f.width * 4), (y * width + i * f.width) * 4);
  });
  return { width, height, rgba };
}
