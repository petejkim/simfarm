import { Binary } from './binary';

/** Runtime DS offsets without verified SSM transfers. Keep raw dword bits;
 * unexplained accounts intentionally retain address-based names. */
export interface RuntimeAnnualLedger {
  priorTaxExpenses: number; // 6190:3e40
  ds3e70: number;
  ds3e8c: number;
  ds3e90: number;
  ds3e94: number;
  ds3e9c: number;
}
export interface AnnualLedgerState extends RuntimeAnnualLedger {
  livestockExpenses: number; // 3e98
  otherExpenses: number; // 3eac, debit category -1
  reportIncome: number; // 3ebc
  reportExpenses: number; // 3ec0
  reportNet: number; // 2d9f:fa18
}
export function validateAnnualLedger(state: AnnualLedgerState): void {
  for (const key of ['priorTaxExpenses', 'ds3e70', 'ds3e8c', 'ds3e90', 'ds3e94', 'ds3e9c',
    'livestockExpenses', 'otherExpenses', 'reportIncome', 'reportExpenses', 'reportNet'] as const) {
    const n = state[key];
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error(`Invalid annual ledger ${key}`);
  }
}
/** Loader 0x45dde..0x45eb3. Unknown runtime accounts are explicit inputs,
 * not guessed adjacent save offsets or silently reconstructed totals. */
export function readAnnualLedger(bytes: Uint8Array, runtime: RuntimeAnnualLedger): AnnualLedgerState {
  const b = new Binary(bytes), state = { ...runtime, livestockExpenses: b.u32(0x216b8), otherExpenses: b.u32(0x216cc),
    reportExpenses: b.u32(0x216d0), reportIncome: b.u32(0x216d4), reportNet: b.u32(0x216d8) };
  validateAnnualLedger(state);
  return state;
}
