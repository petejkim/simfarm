import { Binary } from './binary';

export interface MonthlyDebtState {
  /** Runtime 2d9f:d5ba and 4d9f:fed6; no direct SSM transfer found. */
  balanceDue: number;
  balanceCountdown: number;
  unpaidTaxes: number;
  taxCountdown: number;
}

export function validateMonthlyDebt(state: MonthlyDebtState): void {
  for (const n of [state.balanceDue, state.unpaidTaxes]) if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Invalid monthly debt');
  for (const n of [state.balanceCountdown, state.taxCountdown]) if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error('Invalid debt countdown');
}

/** Tax debt/countdown loader 0x4622e..0x4625b. The other runtime balance
 * is supplied explicitly until its complete startup/load lifecycle is recovered. */
export function readMonthlyDebtState(bytes: Uint8Array, balanceDue: number, balanceCountdown: number): MonthlyDebtState {
  const b = new Binary(bytes), state = { balanceDue, balanceCountdown, unpaidTaxes: b.u32(0x21726), taxCountdown: b.slice(0x2172a, 1)[0] };
  validateMonthlyDebt(state);
  return state;
}
