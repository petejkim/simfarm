import { Binary } from './binary';
import { expertText } from './expert-cards';
export interface CropDefinition { id: string; name: string; description: string; expertDescription: string; rawDefinition: number[] }
export function readCrop(id: string, bytes: Uint8Array): CropDefinition {
  if (bytes.length !== 5890) throw new Error('Unsupported crop definition size');
  const b = new Binary(bytes);
  return {
    id, name: b.text(0x1500, 16).trim(),
    // Buy/Examine advice is the 128-byte block at 0x1580; the Expert block follows at 0x1600.
    description: b.text(0x1580, 0x80).replace(/\r?\n/g, ' ').replace(/@/g, '').replace(/~/g, '\n').replace(/ +/g, ' ').trim(),
    // Expert's46814 reads exactly256 bytes from0x1600, separately from Buy advice.
    expertDescription: expertText(b.text(0x1600, 256)),
    rawDefinition: Array.from(b.slice(0x1500, 128)),
  };
}
