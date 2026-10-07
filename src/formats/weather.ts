import { Binary } from './binary';

export const WEATHER_TABLE_OFFSET = 0x206c4;
export interface ClimateTables { wind: number[]; precipitation: number[]; temperature: number[] }
/** Loader 0x45801..0x4585d: 240 interleaved signed byte triples, five 48-week years. */
export function readClimateTables(bytes: Uint8Array): ClimateTables {
  const raw = new Binary(bytes).slice(WEATHER_TABLE_OFFSET, 240 * 3);
  const channel = (offset: number) => Array.from({ length: 240 }, (_, i) => raw[i * 3 + offset] << 24 >> 24);
  const tables = { wind: channel(0), precipitation: channel(1), temperature: channel(2) };
  // Negative precipitation is clamped by the original. Values above seven index beyond its stack table.
  if (tables.precipitation.some(n => n > 7)) throw new Error('Invalid climate precipitation count');
  return tables;
}
