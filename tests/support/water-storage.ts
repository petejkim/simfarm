import { Binary } from '../../src/formats/binary';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { worldIndex } from '../../src/formats/scenario';
import { GameSimulation } from './game';
import { shopFixture } from './livestock';

/** A player-built pump/ditch supply and an exhausted original trough. Water
 * storage is deliberately absent so tests buy it through the normal controls. */
export function waterStorageFixture() {
  const f = shopFixture(); f.state.scenario.cells[worldIndex(9, 10)].terrain = 0x200f;
  const initial = f.load();
  initial.dispatch({ type: 'build', buildingType: 70, x: 10, y: 10 });
  for (let x = 11; x <= 13; x++) initial.dispatch({ type: 'irrigation', tool: 'ditch', x, y: 10 });
  initial.dispatch({ type: 'buy-livestock', productType: 299, x: 30, y: 30 });
  const { state } = readNativeSave(initial.save(4));
  new Binary(state.scenario.inventory[1].bytes).view.setUint16(2, 0, true);
  state.scenario.cells[worldIndex(30, 30)].terrain = 175;
  return { state, crops: f.crops, load: () => GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation };
}
