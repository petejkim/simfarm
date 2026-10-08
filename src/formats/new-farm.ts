import { Binary } from './binary';
import type { ClimateTables } from './weather';

export interface ClimateSelection { precipitation: number; temperature: number; wind: number }
export interface SetupLocation extends ClimateSelection { x: number; y: number; selectable: boolean }
export interface SetupMap { locations: SetupLocation[]; trailingBytes: Uint8Array }
export interface ClimatePresets { precipitation: number[][]; temperature: number[][]; wind: number[][] }
export interface ScenarioChooser {
  farms: { id: number; x: number; y: number }[];
  initialLocation: { x: number; y: number };
}

/** Validate the generated chooser metadata before exposing browser controls. */
export function readScenarioChooserData(value: unknown): ScenarioChooser {
  const object = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid region metadata');
    return v as Record<string, unknown>;
  };
  const coordinate = (v: unknown): number => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= 18) throw new Error('Invalid region coordinate');
    return v;
  };
  const data = object(value), initial = object(data.initialLocation);
  if (!Array.isArray(data.farms) || data.farms.length !== 8) throw new Error('Invalid region farms');
  return { farms: data.farms.map((value, id) => {
    const f = object(value); if (f.id !== id) throw new Error('Invalid region farm ID');
    return { id, x: coordinate(f.x), y: coordinate(f.y) };
  }), initialLocation: { x: coordinate(initial.x), y: coordinate(initial.y) } };
}

/** DS66ae/66b6: eight X/Y marker bytes, selected in0x32342..0x32380.
 * DS66c0/66c2: initial grid selection. No mission/objective identifier. */
export function readScenarioChooser(executable: Uint8Array): ScenarioChooser {
  const b = new Binary(executable), ds = 0x846f0;
  if (executable.length !== 0x917b9 || b.u16(0) !== 0x5a4d) throw new Error('Unsupported chooser executable');
  const valid = (n: number) => { if (n < 0 || n >= 18) throw new Error('Invalid chooser coordinate'); return n; };
  const xs = b.slice(ds + 0x66ae, 8), ys = b.slice(ds + 0x66b6, 8);
  return { farms: Array.from({ length: 8 }, (_, id) => ({ id, x: valid(xs[id]), y: valid(ys[id]) })),
    initialLocation: { x: valid(b.u16(ds + 0x66c0)), y: valid(b.u16(ds + 0x66c2)) } };
}

/** Four 324-byte planes with CRLF separators; chooser 0x31e7f..0x31f3d. */
export function readSetupMap(bytes: Uint8Array): SetupMap {
  const prefix = new Binary(bytes).slice(0, 4 * 326);
  const planes = Array.from({ length: 4 }, (_, plane) => {
    const start = plane * 326;
    if (prefix[start + 324] !== 13 || prefix[start + 325] !== 10) throw new Error('Invalid setup map separator');
    const data = prefix.subarray(start, start + 324);
    if (data.some(n => n < 97 || n > (plane === 3 ? 98 : 100))) throw new Error('Invalid setup map category');
    return data;
  });
  // Source: ((ASCII - 1) << 5), byte assignment, then signed >> 5 at 0x32559.
  const level = (n: number) => (((n - 1) << 5) << 24 >> 24) >> 5;
  return {
    locations: Array.from({ length: 324 }, (_, i) => ({
      x: i % 18, y: Math.floor(i / 18), selectable: planes[3][i] === 98,
      precipitation: level(planes[0][i]), temperature: level(planes[1][i]), wind: level(planes[2][i]),
    })),
    // Source ignores the remaining notes; retain them without assigning gameplay meaning.
    trailingBytes: Uint8Array.from(bytes.subarray(4 * 326)),
  };
}

/** 0x4a398..0x4a55d scans 60 groups of four decimal words, storing each low byte. */
export function readClimatePreset(bytes: Uint8Array): number[] {
  if (bytes.some(n => n > 127 || n === 0)) throw new Error('Invalid climate preset text');
  const text = new TextDecoder().decode(bytes);
  const row = /\s*([+-]?\d+),\s*([+-]?\d+),\s*([+-]?\d+),\s*([+-]?\d+)/y;
  const values: number[] = [];
  let end = 0;
  for (let group = 0; group < 60; group++) {
    row.lastIndex = end;
    const match = row.exec(text);
    if (!match) throw new Error('Incomplete climate preset');
    end = row.lastIndex;
    for (const token of match.slice(1)) {
      const word = Number(token);
      if (!Number.isInteger(word) || word < -32768 || word > 32767) throw new Error('Invalid climate preset word');
      values.push(word << 24 >> 24);
    }
  }
  if (text.slice(end).trim()) throw new Error('Unexpected climate preset suffix');
  return values;
}

export function readClimatePresets(asset: (name: string) => Uint8Array): ClimatePresets {
  const channel = (prefix: string) => Array.from({ length: 4 }, (_, i) => readClimatePreset(asset(`${prefix}${i}.dat`)));
  const precipitation = channel('rain');
  // The original forecast has only eight patterns; keep the same native boundary as SSM loading.
  if (precipitation.some(table => table.some(n => n > 7))) throw new Error('Invalid climate precipitation count');
  return { precipitation, temperature: channel('temp'), wind: channel('wind') };
}

/** Source arguments: DS67b6 rain, DS67b7 temperature, DS67b8 wind; no RNG draws. */
export function climateForSetup(presets: ClimatePresets, selection: ClimateSelection): ClimateTables {
  const select = (channel: keyof ClimateSelection) => {
    const level = selection[channel];
    if (!Number.isInteger(level) || level < 0 || level > 3) throw new Error('Invalid climate setup level');
    return [...presets[channel][level]];
  };
  return { wind: select('wind'), precipitation: select('precipitation'), temperature: select('temperature') };
}
