import type { Scenario } from '../formats/scenario';
import type { TownConstructionState } from '../formats/town';
import type { TownEventMode } from '../formats/town-event-graphics';
import type { SavedTownEvent } from '../formats/town-event';
import type { FarmRandom } from './random';
import { changeTownEventMap, validateTownEventMap, type TownEventAnimation } from './town-event-map';

export type TownEventDialog = { kind: 'fair-announcement' | 'fair-entry' | 'rodeo-entry' }
  | { kind: 'fair-result' | 'rodeo-result'; won: boolean; animalType: number };
export interface TownEventState extends Omit<SavedTownEvent, 'mode'>, TownEventAnimation {
  pending: TownEventDialog | null;
}
export interface TownEventEffects { artworkMode?: TownEventMode; music?: 'carnival' | 'rodeo' }
type World = Pick<Scenario, 'cells' | 'animals' | 'farm'>;
type Recreation = Pick<TownConstructionState, 'recreationCount' | 'recreationCoordinates'>;
type Accounts = { otherExpenses: number };
function validWord(n: number, max: number): boolean { return Number.isInteger(n) && n >= 0 && n <= max; }
function validate(state: TownEventState, world: World, recreation: Recreation): void {
  validateTownEventMap(world, recreation, state);
  if (!validWord(state.participation, 65535) || !validWord(state.weeksRemaining, 255) ||
    !validWord(state.animalType, 255) || !validWord(world.farm.cash, 0xffffffff)) throw new Error('Invalid town event state');
}

/** Calendar c9b0..cbb3. Arguments are the original week increment BEFORE month
 * normalization (month0..11, week1..4). Caller resolves existing weekly outcomes first. */
export function beginTownCalendarEvent(world: World, recreation: Recreation, state: TownEventState,
  month: number, week: number, messages: boolean, random: Pick<FarmRandom, 'below'>): TownEventEffects {
  validate(state, world, recreation);
  if (!validWord(month, 11) || !Number.isInteger(week) || week < 1 || week > 4) throw new Error('Invalid pre-rollover calendar');
  if (state.pending || !messages) return {};
  const mode = (month - 9) * 4 + week === 0 ? 2 : (month - 6) * 4 + week === 0 ? 1 : 0;
  if (!mode) return {};
  // Bound the source1359a count-controlled scan before terrain or random changes.
  const animals = world.animals.filter(a => a.slot !== 0 && a.active);
  if (mode === 2 && world.farm.cash >= 200 && animals.some(a => a.type < 160 || a.type > 163))
    throw new Error('Unsupported fair animal type');
  if (!changeTownEventMap(world, recreation, state, mode)) return {};
  if (mode === 1) {
    if (world.farm.cash < 1000) {
      state.mode = 0; // cbae: source leaves uploaded rodeo artwork in place (SF-174).
      return { artworkMode: 1 };
    }
    state.pending = { kind: 'rodeo-entry' };
    return { artworkMode: 1, music: 'rodeo' };
  }
  if (!animals.length || world.farm.cash < 200) {
    state.animalType = 255;
    state.pending = { kind: 'fair-announcement' };
  } else {
    state.animalType = animals[random.below(animals.length)].type - 160;
    state.pending = { kind: 'fair-entry' };
  }
  return { artworkMode: 2, music: 'carnival' };
}

/** dbe4..dd3d. Suspend before result credit/cleanup while its source dialog is open. */
export function advanceTownEventWeek(world: World, recreation: Recreation, state: TownEventState,
  random: Pick<FarmRandom, 'nextSimulation'>): TownEventEffects {
  validate(state, world, recreation);
  if (state.pending || !state.weeksRemaining) return {};
  if (state.weeksRemaining === 1 && state.participation && state.mode === 2 &&
    state.animalType !== 255 && state.animalType > 3) throw new Error('Unsupported fair animal type');
  if (--state.weeksRemaining) return {};
  if (state.participation && state.mode === 1) {
    state.pending = { kind: 'rodeo-result', won: (random.nextSimulation() & 3) === 2, animalType: state.animalType };
  } else if (state.participation && state.mode === 2 && state.animalType !== 255) {
    state.pending = { kind: 'fair-result', won: Boolean(random.nextSimulation() & 1), animalType: state.animalType };
  } else if (changeTownEventMap(world, recreation, state, 0)) return { artworkMode: 0 };
  return {};
}

/** Return from0636:10f4. Entry accepts source result0; React sends an explicit
 * boolean. Result dialogs credit category0 (cash only), then restore the district. */
export function resolveTownEventDialog(world: World, recreation: Recreation, state: TownEventState,
  accounts: Accounts, accept: boolean): TownEventEffects {
  validate(state, world, recreation);
  if (!validWord(accounts.otherExpenses, 0xffffffff)) throw new Error('Invalid event expense account');
  const dialog = state.pending;
  if (!dialog) return {};
  if (dialog.kind === 'fair-entry' || dialog.kind === 'rodeo-entry') {
    const cost = dialog.kind === 'fair-entry' ? 200 : 500;
    if (!accept) state.participation = 0;
    else if (world.farm.cash >= cost) {
      world.farm.cash -= cost;
      accounts.otherExpenses = (accounts.otherExpenses + cost) >>> 0;
      state.participation = dialog.kind === 'fair-entry' ? 1 : 1000;
    } // A failed debit retains the prior participation word in the source.
    state.weeksRemaining = dialog.kind === 'fair-entry' ? 3 : 2;
  } else if (dialog.kind === 'fair-announcement') state.weeksRemaining = 3;
  else if (dialog.kind === 'fair-result' || dialog.kind === 'rodeo-result') {
    if (dialog.won) world.farm.cash = Math.min(9_999_999, (world.farm.cash + 1000) >>> 0);
    if (dialog.kind === 'fair-result') state.animalType = 255;
    state.pending = null;
    return changeTownEventMap(world, recreation, state, 0) ? { artworkMode: 0 } : {};
  }
  state.pending = null;
  return {};
}
