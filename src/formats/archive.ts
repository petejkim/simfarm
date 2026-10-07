import { Binary } from './binary';
export interface ArchiveEntry { name: string; offset: number; bytes: Uint8Array }
/** IDX consists of 16-byte names + uint32 offsets; final record is an EOF sentinel. */
export function readArchive(index: Uint8Array, data: Uint8Array): ArchiveEntry[] {
  if (index.length < 40 || index.length % 20) throw new Error('Invalid archive index size');
  const input = new Binary(index);
  const result: ArchiveEntry[] = [];
  const names = new Set<string>();
  if (input.u32(16) !== 0 || input.u32(index.length - 4) !== data.length) throw new Error('Archive boundary mismatch');
  for (let i = 0; i < index.length - 20; i += 20) {
    const name = input.text(i, 16);
    const offset = input.u32(i + 16), end = input.u32(i + 36);
    if (!/^[a-zA-Z0-9_]+\.[a-zA-Z0-9]+$/.test(name) || names.has(name.toLowerCase())) throw new Error('Unsafe or duplicate archive name');
    if (offset >= end || end > data.length) throw new Error('Invalid archive member bounds');
    names.add(name.toLowerCase());
    result.push({ name, offset, bytes: data.subarray(offset, end) });
  }
  return result;
}
