import { Binary } from './binary';

/** Sixteen8-byte entries at6190:1efc; byte1 remains unnamed and preserved. */
export class TrafficRecord {
  private readonly data: DataView;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= 16 || bytes.length !== 8) throw new Error('Invalid traffic record');
    this.data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  get active(): boolean { return Boolean(this.bytes[0] & 1); }
  get flags(): number { return this.bytes[0]; }
  get x(): number { return this.data.getUint16(2, true); }
  get y(): number { return this.data.getUint16(4, true); }
  get heading(): number { return this.bytes[6]; }
  get variant(): number { return this.bytes[7]; }
}
export interface TrafficDefaults { records: number[][]; activeCount: number; delay: number; lastTick: number }
export interface TrafficState { records: TrafficRecord[]; activeCount: number; delay: number; lastTick: number }

/** Cold initialized globals in data overlay29. These runtime records are not
 * recovered by reading the farm's SSM animal/equipment tables. */
export function readTrafficDefaults(executable: Uint8Array): TrafficDefaults {
  const b = new Binary(executable), ds = 0x846f0;
  if (executable.length !== 0x917b9 || b.u16(0) !== 0x5a4d) throw new Error('Unsupported traffic executable');
  return { records: Array.from({ length: 16 }, (_, i) => Array.from(b.slice(ds + 0x1efc + i * 8, 8))),
    activeCount: b.slice(ds + 0x1efa, 1)[0], delay: b.u16(ds + 0x2286), lastTick: b.u16(ds + 0x2090) };
}

export function validateTraffic(state: TrafficState): void {
  const word = (n: number) => Number.isInteger(n) && n >= 0 && n <= 65535;
  if (!Array.isArray(state.records) || state.records.length !== 16 || !Number.isInteger(state.activeCount) ||
    state.activeCount < 0 || state.activeCount > 16 || !word(state.delay) || !word(state.lastTick)) throw new Error('Invalid traffic state');
  for (const [slot, r] of state.records.entries()) {
    if (!(r instanceof TrafficRecord) || r.slot !== slot || r.bytes.length !== 8) throw new Error('Invalid traffic record');
    if (r.active && (r.x >= 96 || r.y >= 96 || r.heading > 7 || r.variant > 3)) throw new Error('Invalid active traffic record');
  }
  if (state.records.filter(r => r.active).length !== state.activeCount) throw new Error('Inconsistent traffic count');
}

export function createTrafficState(defaults: TrafficDefaults): TrafficState {
  if (!Array.isArray(defaults.records) || defaults.records.length !== 16) throw new Error('Invalid traffic records');
  const records = defaults.records.map((raw, slot) => {
    if (!Array.isArray(raw) || raw.length !== 8 || raw.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Invalid traffic bytes');
    return new TrafficRecord(slot, Uint8Array.from(raw));
  });
  const state = { ...defaults, records }; validateTraffic(state); return state;
}
