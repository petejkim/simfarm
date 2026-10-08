import { Binary } from './binary';
export interface PcmSound { sampleRate: number; samples: Float32Array<ArrayBuffer> }

/** The supplied homestead and livestock resources contain one type-1 uncompressed mono
 * U8 block, then a terminator. Other VOC encodings are explicitly unsupported. */
export function decodeVoc(bytes: Uint8Array): PcmSound {
  const b = new Binary(bytes);
  if (b.text(0, 19) !== 'Creative Voice File' || b.slice(19, 1)[0] !== 26) throw new Error('Invalid VOC signature');
  const offset = b.u16(20), version = b.u16(22);
  if (offset < 26 || ![0x10a, 0x114].includes(version) || b.u16(24) !== ((~version + 0x1234) & 65535)) throw new Error('Invalid VOC header');
  const header = b.slice(offset, 6);
  if (header[0] !== 1 || header[5] !== 0) throw new Error('Unsupported VOC encoding');
  const size = header[1] | header[2] << 8 | header[3] << 16;
  if (size < 3) throw new Error('Empty VOC sound');
  const block = b.slice(offset + 4, size), end = offset + 4 + size;
  if (b.slice(end, 1)[0] !== 0 || end + 1 !== bytes.length) throw new Error('Unsupported VOC block sequence');
  const sampleRate = 1000000 / (256 - block[0]);
  if (sampleRate > 384000) throw new Error('Unsupported VOC sample rate');
  return { sampleRate, samples: Float32Array.from(block.subarray(2), value => (value - 128) / 128) };
}
