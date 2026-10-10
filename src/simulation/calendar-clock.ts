/** Calendar gate0xc8a9..0xc8b5 reads animation word13a0, subtracting last-day
 * timestamp1f8e;0xd175..0xd179 stores13a0 after a day. Machinery uses139e.
 * Native dayTicks represents the unsigned elapsed phase. Carry the retained
 * timestamp when a load/reset replaces animationTicks, without advancing time. */
export function transferCalendarPhase(animationTicks: number, dayTicks: number, replacementAnimationTicks: number): number {
  if (![animationTicks, dayTicks, replacementAnimationTicks].every(n => Number.isInteger(n) && n >= 0 && n <= 65535))
    throw new Error('Invalid calendar clock word');
  const lastDayTick = (animationTicks - dayTicks) & 65535;
  return (replacementAnimationTicks - lastDayTick) & 65535;
}

/** c8b1/c8b5 uses unsigned JA, not JAE. Caller supplies canonical u16 words. */
export function calendarDayDue(elapsed: number, delay: number): boolean { return elapsed > delay; }

/** A fresh source day needs delay+1 ticks. FFFF can never pass the word gate. */
export function calendarDayPeriod(delay: number): number | null {
  if (!Number.isInteger(delay) || delay < 0 || delay > 65535) throw new Error('Invalid calendar delay word');
  return delay === 65535 ? null : delay + 1;
}

/** Native Next day is a bounded fast-forward to the next successful gate.
 * The next tick wraps FFFF to0 before comparison; at most65536 ticks suffice
 * for any advancing delay. An already-large phase is checked on the next tick. */
export function ticksUntilCalendarDay(phase: number, delay: number): number | null {
  if (!Number.isInteger(phase) || phase < 0 || phase > 65535) throw new Error('Invalid calendar phase word');
  const period = calendarDayPeriod(delay);
  return period === null ? null : phase === 65535 ? period + 1 : Math.max(1, period - phase);
}
