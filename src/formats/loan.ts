import { Binary } from './binary';

export interface LoanState {
  principal: number; // 6190:b3ae
  scheduledPayment: number; // 6190:b3b2
  availableCredit: number; // 6190:b394
  selectedAmount: number; // 6190:b398, original dialog selection
}
export function validateLoan(state: LoanState): void {
  for (const key of ['principal', 'scheduledPayment', 'availableCredit', 'selectedAmount'] as const) {
    const n = state[key];
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error(`Invalid loan ${key}`);
  }
}
/** Transfers 0x45eb6..0x45ecb and 0x46006..0x4604b. */
export function readLoan(bytes: Uint8Array): LoanState {
  const b = new Binary(bytes);
  return { scheduledPayment: b.u32(0x216dc), availableCredit: b.u32(0x216fb), selectedAmount: b.u32(0x216ff), principal: b.u32(0x21703) };
}
