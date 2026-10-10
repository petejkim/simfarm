import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { purchaseAnimal } from '../../src/simulation/animal-purchase';
import { FarmRandom } from '../../src/simulation/random';
import { GameSimulation } from './game';

const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
/** A source-backed animal with a visible full trough. Field/equipment records
 * are inactive so movement/consumption assertions have no unrelated traffic.
 * The synthetic period is in ticks, not the source delay word. The default
 * gives one logical tick per4ms; short periods align weekly work with animal frames. */
export function livestockFixture(ticksPerDay = 1000) {
  const world = readScenario(source('SCEN4.SSM'));
  const crops = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  for (const c of world.cells) { c.terrain = 15; c.overlay = 0x800; c.attribute = 0; }
  for (const a of world.animals) a.flags = 0;
  for (const b of world.buildings) b.flags = 0;
  for (const f of world.fields) f.bytes[7] &= ~1;
  for (const e of world.equipment) e.flags = 0;
  for (const i of world.inventory) i.bytes[10] &= ~32;
  world.schedule.bytes.fill(0); world.irrigation.sourceCount = 0; world.irrigation.sources.fill(0);
  Object.assign(world.farm, { dayDelayTicks: ticksPerDay - 1, animationTicks: 0, timerTicks: 0, cash: 100000 });
  Object.assign(world.farm.calendar, { day: 0, week: 0, month: 0 });
  const { state } = readNativeSave(new GameSimulation(world, crops).save(4));
  for (const d of state.finances.accounts.assets.animalDefinitions) d.count = 0;
  purchaseAnimal(state.scenario, state.finances, new FarmRandom({ visual: 0x1234, simulation: 2, bounded: 99 }), 161, 10, 10, 0);
  const a = state.scenario.animals[1]; a.bytes[5] = 0; a.bytes[14] = 4;
  const item = state.scenario.inventory[1], v = new DataView(item.bytes.buffer, item.bytes.byteOffset, item.bytes.byteLength);
  v.setUint16(0, 299, true); v.setUint16(2, 512, true); item.bytes[8] = 12; item.bytes[9] = 10; item.bytes[10] = 32;
  state.scenario.cells[worldIndex(12, 10)].terrain = 176; state.finances.accounts.otherDefinitions[11].count = 1;
  state.random = { visual: 0x1234, simulation: 2, bounded: 99 }; state.weather.displayTemperature = 50;
  const load = () => GameSimulation.load(writeNativeSave(state, 4), crops).simulation;
  return { state, crops, load };
}

export function shopFixture() {
  const f = livestockFixture(16);
  f.state.scenario.animals[1].flags = 0;
  f.state.scenario.inventory[1].bytes[10] = 0;
  for (const c of f.state.scenario.cells) { c.terrain = 15; c.overlay = 0x800; }
  for (const d of f.state.finances.accounts.assets.animalDefinitions) d.count = 0;
  for (const d of f.state.finances.accounts.otherDefinitions) d.count = 0;
  f.state.scenario.farm.cash = 100000;
  f.state.scenario.farm.autoClear = false;
  return f;
}
