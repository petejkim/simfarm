import { Binary } from '../../src/formats/binary';
import { worldIndex } from '../../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { purchaseBuilding } from '../../src/simulation/building-placement';
import { storeMovingAnimal } from '../../src/simulation/animal-world';
import { GameSimulation } from './game';
import { livestockFixture, shopFixture } from './livestock';

export function breedingFixture() {
  const f = livestockFixture(16), s = f.state.scenario, a = s.animals[1];
  const result = purchaseBuilding(s, f.state.finances, 68, 20, 20, 0);
  if (!result.ok || !storeMovingAnimal(s, f.state.finances, a, s.buildings[result.slot])) throw new Error('Invalid breeding fixture');
  // Block the three recovered storage exits, keeping the parent in source storage care.
  for (let y = 20; y < 23; y++) s.cells[worldIndex(19, y)].terrain = 500;
  new Binary(a.bytes).view.setUint16(10, 80, true); a.flags |= 2;
  s.farm.calendar.day = 6; s.farm.calendar.week = 3;
  return f;
}

export function replacementBirthFixture() {
  const f = shopFixture(), game = f.load();
  game.dispatch({ type: 'buy-livestock', productType: 160, x: 10, y: 10 });
  game.dispatch({ type: 'buy-livestock', productType: 161, x: 20, y: 20 });
  const { state } = readNativeSave(game.save(4));
  const horse = state.scenario.animals[1], cow = state.scenario.animals[2];
  new Binary(horse.bytes).view.setUint16(10, 960, true);
  new Binary(cow.bytes).view.setUint16(10, 81, true); cow.flags |= 3; cow.bytes[28] = 40;
  state.scenario.farm.calendar.day = 6;
  return { state, crops: f.crops, load: () => GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation };
}
