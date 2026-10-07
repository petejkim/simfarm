import { readFileSync } from 'node:fs';
import { readArchive } from '../../src/formats/archive';
import { TownLayouts } from '../../src/formats/town';
import { GameSimulation as NativeGame } from '../../src/simulation/game';
export * from '../../src/simulation/game';
const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
export const originalTownLayouts = new TownLayouts(readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(e => e.name === 'townly0.cmp')!.bytes);

/** Tests use the same original layout dependency as the browser, without fetch.
 * This adapter preserves existing fixture seed/restore arguments; no subsystem
 * is disabled or mocked. The production constructor always requires layouts. */
export class GameSimulation extends NativeGame {
  constructor(scenario: ConstructorParameters<typeof NativeGame>[0], crops: ConstructorParameters<typeof NativeGame>[1],
    seeds?: ConstructorParameters<typeof NativeGame>[3], restored?: ConstructorParameters<typeof NativeGame>[4]) {
    super(scenario, crops, originalTownLayouts, seeds, restored);
  }
  static override load(text: string, crops: ConstructorParameters<typeof NativeGame>[1]) {
    return NativeGame.load(text, crops, originalTownLayouts);
  }
}
