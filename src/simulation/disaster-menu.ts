import type { MovingDisasterState } from './moving-disasters';

/** Source3e448 display order; general start modes1/4/2/3/5/6. */
export const DISASTER_MENU_KINDS = ['tornado', 'swarm', 'drought', 'flood', 'frost', 'wind'] as const;
export type DisasterMenuAction = typeof DISASTER_MENU_KINDS[number] | 'disable';
const masks = [1, 32, 2, 4, 16, 8] as const;
/** Check actual events, avoiding the source callback's phantom check (SF-171). */
export function disasterMenuChecks(state: Pick<MovingDisasterState, 'flags' | 'enabled'>): boolean[] {
  return [...masks.map(mask => Boolean(state.flags & mask)), !state.enabled];
}
