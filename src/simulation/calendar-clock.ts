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
