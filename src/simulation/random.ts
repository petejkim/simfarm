export interface RandomState { visual: number; simulation: number; bounded: number }
const word = (n: number) => {
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error('Invalid random state');
  return n;
};
/** Three separate original generators, file 0x824d, 0x8273 and 0x82a0. No host randomness. */
export class FarmRandom {
  private state: RandomState;
  constructor(state: RandomState) {
    this.state = { visual: word(state.visual), simulation: word(state.simulation), bounded: word(state.bounded) };
  }
  snapshot(): RandomState { return { ...this.state }; }
  nextVisual(): number {
    let value = this.state.visual;
    for (let i = 0; i < 8; i++) value = (value >>> 1) | ((((value >>> 1) ^ (value >>> 2)) & 1) << 15);
    return this.state.visual = value;
  }
  nextSimulation(): number {
    const value = this.state.simulation;
    return this.state.simulation = (value >>> 1) ^ ((value & 1) ? 0x3500 : 0);
  }
  below(limit: number): number {
    if (!Number.isInteger(limit) || limit < 1 || limit > 32767) throw new Error('Invalid random bound');
    const step = (n: number) => (n >>> 1) ^ ((n & 1) ? 0xb8 : 0);
    let value = step(this.state.bounded);
    // Original stores only the first step, not the subsequent rejection steps.
    this.state.bounded = value;
    while (value > limit) value = step(value);
    return value === limit ? 0 : value;
  }
  /** Monthly perturbation at 0xcc20..0xcc39, called with the pre-wrap month (1..12). */
  mixMonth(month: number): void {
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid random month');
    const value = (this.state.simulation + month * 4) & 0xffff;
    this.state.simulation = (value << 16 >> 16) > 0x1fff ? 1234 : value;
  }
}
