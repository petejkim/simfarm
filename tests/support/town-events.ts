import assert from 'node:assert/strict';
import type { GameSimulation } from '../../src/simulation/game';

/** Long-running gameplay tests make a real player decision rather than silently
 * disabling calendar events. One boundary can show a result and a new entry. */
export function declineTownEvents(game: GameSimulation): void {
  for (let dialog = 0; dialog < 2 && game.getSnapshot().townEvent.pending; dialog++)
    game.dispatch({ type: 'resolve-town-event', accept: false });
  assert.equal(game.getSnapshot().townEvent.pending, null, 'event acknowledgement must complete its continuation');
}
