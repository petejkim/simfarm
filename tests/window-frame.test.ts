import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readArchive } from '../src/formats/archive';
import { readBitmap, readPalette, type Raster } from '../src/formats/graphics';
import { readWindowFrame, WINDOW_FRAME } from '../src/formats/window-frame';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const palette = readPalette(archive.find(e => e.name === 'simfarm.pal')!.bytes);
const bitmap = (name: string) => readBitmap(archive.find(e => e.name === name)!.bytes, palette);
const run = (r: Raster, x: number, y: number, n: number) => Array.from({ length: n }, (_, i) => [...r.rgba.subarray((y * r.width + x + i) * 4, (y * r.width + x + i) * 4 + 4)].join()).join('|');
const frame = readWindowFrame(bitmap('sellwndo.bmp')), E = WINDOW_FRAME.edge;
/** True when every row of `rows` equals slice row (i + phase) % 8 for one phase. */
const periodic = (rows: string[], slice: string[]) => [...Array(E).keys()].some(phase => rows.every((row, i) => row === slice[(i + phase) % E]));

test('window frame 9-slice is cut from Sell and tiles every window\'s wooden sides and bottom', () => {
  expect([frame.width, frame.height]).toEqual([24, 16]);
  const leftSlice = [...Array(E).keys()].map(y => run(frame, 0, y, E)), rightSlice = [...Array(E).keys()].map(y => run(frame, 2 * E, y, E));
  // The sides repeat on an 8-row grain period in every window (the phase differs per window).
  for (const name of ['sellwndo.bmp', 'examine.bmp', 'bankterm.bmp', 'buywndo.bmp', 'futures.bmp', 'cashflow.bmp', 'fdstatus.bmp']) {
    const w = bitmap(name), rows = [...Array(w.height - 16 - 9).keys()].map(i => i + 16);
    expect(periodic(rows.map(y => run(w, 0, y, E)), leftSlice), `${name} left`).toBe(true);
    expect(periodic(rows.map(y => run(w, w.width - E, y, E)), rightSlice), `${name} right`).toBe(true);
  }
  // Bottom corners: exact for Sell, Market and Evaluation; elsewhere the side grain's phase changes at most 6 of the 128 corner pixels.
  const cornerMismatches = (w: Raster) => { let n = 0;
    for (let y = 0; y < E; y++) for (let x = 0; x < E; x++) {
      if (run(w, x, w.height - E + y, 1) !== run(frame, x, E + y, 1)) n++;
      if (run(w, w.width - E + x, w.height - E + y, 1) !== run(frame, 2 * E + x, E + y, 1)) n++;
    }
    return n; };
  for (const name of ['sellwndo.bmp', 'futures.bmp', 'evaluate.bmp']) expect(cornerMismatches(bitmap(name)), `${name} corners`).toBe(0);
  for (const name of ['buywndo.bmp', 'cashflow.bmp', 'bankterm.bmp', 'examine.bmp', 'fdstatus.bmp', 'airpwndo.bmp', 'mapwndo.bmp', 'weather.bmp'])
    expect(cornerMismatches(bitmap(name)), `${name} corners`).toBeLessThanOrEqual(6);
  // Bottom middle repeats every 8 columns in windows with the common 8-row bottom.
  for (const name of ['sellwndo.bmp', 'futures.bmp', 'buywndo.bmp', 'cashflow.bmp']) {
    const w = bitmap(name);
    const columns = (r: Raster, x0: number, n: number) => [...Array(n).keys()].map(i => [...Array(E).keys()].map(y => run(r, x0 + i, r.height - E + y, 1)).join('/'));
    const sliceColumns = [...Array(E).keys()].map(i => [...Array(E).keys()].map(y => run(frame, E + i, E + y, 1)).join('/'));
    expect(periodic(columns(w, E, w.width - 2 * E), sliceColumns), `${name} bottom middle`).toBe(true);
  }
});
