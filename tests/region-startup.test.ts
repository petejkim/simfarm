import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { readScenarioChooser, climateForSetup, readSetupMap } from '../src/formats/new-farm';
import { readArchive } from '../src/formats/archive';
import { readCrop } from '../src/formats/crop';
import { finalizeRegionFarm } from '../src/simulation/starting-environment';
import { GameSimulation } from '../src/simulation/game';
import { newFarmAssets } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const exe = source('SIMFARM.EXE');
const locations = readSetupMap(readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(e => e.name === 'scenario.odt')!.bytes).locations;
const layouts = newFarmAssets.townLayouts;

test('chooser caller follows loaded result2 through climate, cash and town before skipping new-farm calendar/history', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, hex: string) => assert.equal(exe.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x32302, 'c606c46602'); exact(0x32589, 'a0c466985e5fc9cb');
  exact(0x40ec6, '9a0812e6248846b0fec8740f807eb0007409807eb0037403e95101');
  exact(0x41050, '9aa213e624'); exact(0x4107e, '8a46b0985fc9cb');
  exact(0x3f8ae, '9a7a13e6248846f6');
  exact(0x3f91b, '26c706483e409c26c7064a3e0000');
  exact(0x3fab0, '9a7013e6246a026a00'); exact(0x3facb, '9a2c11e624');
  exact(0x3fadc, '26a3dbfe'); exact(0x3faec, '26a3dcfe');
  exact(0x2347, '26803ec466027444'); exact(0x2397, '26803ec466027503e91901');
  exact(0x269e, '803e940102750d9a600fe624c746d80000e991fc');
  // Overlay manager resolves the actual callees rather than confusing equal offsets.
  exact(0x27060 + 0x1208 + 3, 'ea0000ce270600');
  exact(0x27060 + 0x13a2 + 3, 'ead81cce271900');
  exact(0x27060 + 0xf60 + 3, 'eac80bce271300');
});

test('all eight preset finalizers use selected climate, repaint one town, retain dates and leave unrelated records intact', () => {
  for (const marker of readScenarioChooser(exe).farms) {
    const bytes = source(`SCEN${marker.id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
    const climate = climateForSetup(newFarmAssets.climate, locations[marker.y * 18 + marker.x]);
    const old = readScenario(bytes), beforeTown = structuredClone(finances.town);
    world.farm.cash = 123; finances.town.activeSite = { regionX: 0, regionY: 0 };
    finalizeRegionFarm(world, finances, layouts, climate);
    assert.equal(world.farm.cash, 40000); assert.deepEqual(world.farm.calendar, old.farm.calendar);
    assert.deepEqual(world.climate, climate); assert.notEqual(world.climate.precipitation, climate.precipitation);
    assert.deepEqual(world.sourceBytes, Uint8Array.from(bytes)); assert.deepEqual(world.fields.map(f => f.bytes), old.fields.map(f => f.bytes));
    const x = old.farm.townRegionX * 8, y = old.farm.townRegionY * 8;
    assert.deepEqual(finances.town, { ...beforeTown, activeSite: { regionX: x / 8, regionY: y / 8 } });
    const r = (x / 8 * 12 + y / 8) * 7;
    assert.equal(world.regionalConditions[r], 0xa0); assert.equal(world.regionalConditions[r + 1], 2);
    for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) {
      const cell = world.cells[worldIndex(x + dx, y + dy)];
      assert.ok(cell.overlay & 0x4000);
      const tile = layouts.tile(0, dx, dy), previous = old.cells[worldIndex(x + dx, y + dy)].terrain & 0x7ff;
      if (![71,72,111,112].includes(previous) && !(tile >= 161 && tile <= 172)) assert.equal(cell.terrain, 15 + (cell.attribute & 15));
    }
    if (marker.id >= 6) assert.notDeepEqual(world.climate.precipitation, old.climate.precipitation);
  }
});

test('geographic startup is detached and restores without repeating town/climate initialization', () => {
  for (const marker of readScenarioChooser(exe).farms) {
    const original = readScenario(source(`SCEN${marker.id}.SSM`));
    const crops = original.cropFiles.map(file => readCrop(file.slice(0,-4), source(`CROPS/${file.toUpperCase()}`)));
    const climate = climateForSetup(newFarmAssets.climate, locations[marker.y * 18 + marker.x]);
    const old = JSON.stringify(original), game = GameSimulation.openRegion(original, crops, layouts, climate);
    assert.equal(JSON.stringify(original), old);
    for (let day = 0; day < 7; day++) game.dispatch({ type: 'advance-day' });
    const saved = game.save(marker.id), restored = GameSimulation.load(saved, crops, layouts).simulation;
    assert.deepEqual(JSON.parse(restored.save(marker.id)), JSON.parse(saved));
    for (let day = 0; day < 7; day++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
    assert.deepEqual(JSON.parse(restored.save(marker.id)), JSON.parse(game.save(marker.id)));
    assert.deepEqual(new GameSimulation(original, crops, layouts).getSnapshot().scenario.climate, original.climate);
  }
});

test('invalid region climate or town rejects before mutating the supplied state', () => {
  const bytes = source('SCEN0.SSM'), world = readScenario(bytes), finances = readFinancialState(bytes);
  const climate = climateForSetup(newFarmAssets.climate, locations[8 * 18]);
  for (const edit of [(c: typeof climate) => c.wind.pop(), (c: typeof climate) => c.precipitation[0] = 8,
    (c: typeof climate) => c.temperature[0] = -129, (c: typeof climate) => c.wind[0] = 2.5]) {
    const bad = structuredClone(climate); edit(bad); const before = JSON.stringify({ world, finances });
    assert.throws(() => finalizeRegionFarm(world, finances, layouts, bad), /climate/);
    assert.equal(JSON.stringify({ world, finances }), before);
  }
  world.farm.townRegionX = 12; const before = JSON.stringify({ world, finances });
  assert.throws(() => finalizeRegionFarm(world, finances, layouts, climate), /town/);
  assert.equal(JSON.stringify({ world, finances }), before);
});
