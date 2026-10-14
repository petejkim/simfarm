import { readRodeoInvitation } from '../formats/town-event';
import type {EventMessages} from '../formats/event-messages';
import type { TownEventState } from '../simulation/town-events';

/** Initialized DS6190 strings, file base846f0. The source uses seven-byte
 * species/name records at22a0/22bc, not a player-editable animal name. */
export const TOWN_EVENT_TEXT = {
  announcement: 'The town fair is starting!',
  entry: 'The Town Fair is starting! Would you like to enter %s the %s in the %s judging contest? Entry fee is %d dollars',
  fairWin: '%s WON FIRST PRIZE!!! You Win 1000 Dollars!',
  fairLoss: '%s LOST! Well, maybe next year.',
  rodeoWin: 'Your cousin Jed WON!! You made 500 dollars!!!',
  rodeoLoss: 'Your cousin Jed LOST. You lost your 500 bucks.',
} as const;
export const FAIR_ANIMALS = [
  { species: 'Horse', name: 'Rascal' }, { species: 'Cow', name: 'Missy' },
  { species: 'Pig', name: 'Stella' }, { species: 'Sheep', name: 'Bogie' },
] as const;

export interface TownEventMessage {
  text: string;
  portrait: number;
  buttons: readonly { caption: 'YES' | 'NO' | 'OK' | 'RATS'; accept: boolean }[];
}

/** Presentation only: never draw an outcome, debit an entry or clear pending.
 * Dialog callbacks must dispatch to the canonical simulation owner. */
export function townEventMessage(state: Pick<TownEventState, 'pending' | 'animalType'>,
  eventText: EventMessages): TownEventMessage | null {
  const dialog = state.pending;
  if (!dialog) return null;
  const ok = [{ caption: 'OK', accept: true }] as const;
  const choice = [{ caption: 'YES', accept: true }, { caption: 'NO', accept: false }] as const;
  if (dialog.kind === 'fair-announcement') return { text: TOWN_EVENT_TEXT.announcement, portrait: 74, buttons: ok };
  if (dialog.kind === 'rodeo-entry') return { text: readRodeoInvitation(eventText), portrait: 74, buttons: choice };
  if (dialog.kind === 'rodeo-result') return {
    text: dialog.won ? TOWN_EVENT_TEXT.rodeoWin : TOWN_EVENT_TEXT.rodeoLoss,
    portrait: dialog.won ? 75 : 76,
    // dc52 uses button18: the eighteenth buttons.til image reads RATS.
    buttons: dialog.won ? ok : [{ caption: 'RATS', accept: true }],
  };
  const type = dialog.kind === 'fair-result' ? dialog.animalType : state.animalType;
  if (!Number.isInteger(type) || type < 0 || type >= FAIR_ANIMALS.length) throw new Error('Invalid fair message animal');
  const animal = FAIR_ANIMALS[type];
  if (dialog.kind === 'fair-entry') {
    const args = [animal.name, animal.species, animal.species, '200'];
    return { text: TOWN_EVENT_TEXT.entry.replace(/%[sd]/g, () => args.shift()!), portrait: 74, buttons: choice };
  }
  if (dialog.kind === 'fair-result') return {
    text: (dialog.won ? TOWN_EVENT_TEXT.fairWin : TOWN_EVENT_TEXT.fairLoss).replace('%s', animal.name),
    portrait: dialog.won ? 70 + type : 74, buttons: ok,
  };
  throw new Error('Unsupported town event message');
}
