import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from './support/game';
import { shopFixture } from './support/livestock';
import { newFarmAssets, newFarmOptions } from './support/new-farm';
import { readCrop } from '../src/formats/crop';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { allCropFiles, cropPlantTile, cropBadgeTile, cropHarvestTile, SHIPPED_CROP_IDS } from '../src/formats/crop-slots';
import { cropTilePatches, patchCropGraphics } from '../src/formats/crop-graphics';
import { readArchive } from '../src/formats/archive';
import { reserveHarvestStorage, deliverStoredHarvest } from '../src/simulation/harvest-storage';
import { sellStoredHarvest } from '../src/simulation/harvest-sale';
import { checkSupplyPickup, moveManualSupply } from '../src/simulation/manual-supply-move';
import { toggleBuildingInterior } from '../src/simulation/building-storage';
import { projectFieldScheduleYear } from '../src/simulation/field-projection';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
export const catalog = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops: catalog };

test('all eight farm catalogs expand without replacing existing slots, records, histories or random state', () => {
  assert.deepEqual(catalog.map(c => c.id).sort(), [...SHIPPED_CROP_IDS]);
  for (let id = 0; id < 8; id++) {
    const original = new GameSimulation(readScenario(source(`SCEN${id}.SSM`)), catalog), before = readNativeSave(original.save(id)).state;
    const expanded = original.withAllCrops(catalog), after = readNativeSave(expanded.save(id)).state;
    assert.equal(after.scenario.cropFiles.length, 24); assert.equal(new Set(after.scenario.cropFiles).size, 24);
    assert.deepEqual(after.scenario.cropFiles.slice(0, 16), before.scenario.cropFiles);
    assert.deepEqual(after.scenario.cropDefinitions.slice(24).map(d => [...d.bytes]), before.scenario.cropDefinitions.slice(16).map(d => [...d.bytes]));
    assert.deepEqual(after.scenario.fields, before.scenario.fields); assert.deepEqual(after.scenario.cells, before.scenario.cells);
    assert.deepEqual(after.scenario.schedule.bytes, before.scenario.schedule.bytes);
    assert.deepEqual(after.random, before.random); assert.deepEqual(after.market.history.slice(0, 16), before.market.history);
    assert.equal(expanded.withAllCrops(catalog), expanded);
    assert.equal(GameSimulation.load(expanded.save(id), catalog).simulation.save(id), expanded.save(id));
    for (let day = 0; day < 8; day++) { original.dispatch({ type: 'advance-day' }); expanded.dispatch({ type: 'advance-day' }); }
    const a = readNativeSave(original.save(id)).state, b = readNativeSave(expanded.save(id)).state;
    assert.deepEqual(b.random, a.random); assert.deepEqual(b.scenario.cells, a.scenario.cells);
    assert.deepEqual(b.market.history.slice(0, 16), a.market.history); assert.equal(b.market.mood, a.market.mood);
  }
}, 15000);

test('every appended crop buys and consumes seed, plants and grows, schedules and restores its own identity', () => {
  for (let slot = 16; slot < 24; slot++) {
    const fixture = shopFixture(); fixture.state.scenario.farm.autoBuySeeds = false; fixture.state.disasters.enabled = false;
    const game = fixture.load().withAllCrops(catalog);
    game.dispatch({ type: 'build', buildingType: 69, x: 10, y: 10 });
    game.dispatch({ type: 'build', buildingType: 65, x: 20, y: 20 });
    game.dispatch({ type: 'buy-crop-supply', productType: 192 + slot, x: 10, y: 10 });
    assert.ok(game.getSnapshot().lastCropSupplyPurchaseResult?.ok);
    game.dispatch({ type: 'create-field', x: 40, y: 40, cropSlot: slot });
    assert.ok(game.getSnapshot().lastNewFieldResult?.ok);
    let snapshot = game.getSnapshot();
    assert.equal(snapshot.scenario.fields[1].cropSlot, slot);
    assert.equal(snapshot.scenario.inventory.filter(i => i.active && i.type === 192 + slot).length, 0);
    assert.equal(terrainTile(snapshot.scenario.cells[worldIndex(40, 40)]), cropBadgeTile(slot));
    assert.equal(snapshot.scenario.schedule.get(0, 0), cropPlantTile(slot));
    const restored = GameSimulation.load(game.save(4), catalog).simulation;
    for (let day = 0; day < 8; day++) for (const g of [game, restored]) g.dispatch({ type: 'advance-day' });
    assert.equal(restored.save(4), game.save(4)); snapshot = game.getSnapshot();
    assert.equal(snapshot.scenario.fields[1].state, 4); assert.equal(snapshot.scenario.fields[1].cropSlot, slot);
    assert.equal(terrainTile(snapshot.scenario.cells[worldIndex(40, 40)]), cropBadgeTile(slot));
    const state = readNativeSave(game.save(4)).state;
    projectFieldScheduleYear(state.scenario, state.crops);
    assert.equal(readNativeSave(writeNativeSave(state, 4)).state.scenario.fields[1].cropSlot, slot);
    for (const g of [game, restored]) g.dispatch({ type: 'harvest-field', fieldSlot: 1 });
    assert.ok(game.getSnapshot().lastHarvestResult?.ok);
    for (let day = 0; day < 14 && !game.getSnapshot().scenario.inventory.some(i => i.active && i.type === 168 + slot); day++)
      for (const g of [game, restored]) g.dispatch({ type: 'advance-day' });
    const harvested = game.getSnapshot().scenario.inventory.find(i => i.active && i.type === 168 + slot);
    assert.ok(harvested, `Crop slot ${slot} did not reach storage`);
    for (const g of [game, restored]) g.dispatch({ type: 'sell-harvest', inventorySlot: harvested.slot });
    assert.ok(game.getSnapshot().lastSaleResult?.ok);
    assert.equal(restored.save(4), game.save(4));

  }
}, 15000);

test('all extra harvested goods retain graphics and identity through storage, movement, checkpoints and sale', () => {
  for (let slot = 16; slot < 24; slot++) {
    const game = shopFixture().load().withAllCrops(catalog);
    game.dispatch({ type: 'build', buildingType: 65, x: 10, y: 10 });
    const state = readNativeSave(game.save(4)).state, world = state.scenario;
    const reserved = reserveHarvestStorage(world, 10, 10); assert.ok(reserved);
    const item = deliverStoredHarvest(world, reserved.buildingSlot, slot, 300, 0); assert.ok(item);
    assert.equal(item.type, 168 + slot);
    const building = world.buildings[reserved.buildingSlot];
    if (!(building.flags & 1)) toggleBuildingInterior(building, world);
    assert.equal(terrainTile(world.cells[worldIndex(item.x, item.y)]), cropHarvestTile(slot));
    assert.equal(world.cells[worldIndex(item.x, item.y)].terrain & 0x800, 0);
    const picked = checkSupplyPickup(world, state.finances, item.x, item.y); assert.ok(picked.ok);
    assert.ok(moveManualSupply(world, state.finances, picked, 30, 30, state.weather.soilMoisture).ok);
    const restored = readNativeSave(writeNativeSave(state, 4)).state;
    const result = sellStoredHarvest(restored.scenario, item.slot, restored.weather.soilMoisture);
    assert.ok(result.ok); assert.ok(result.value > 0);
    assert.equal(restored.scenario.harvestDefinitions[slot].count, 0);
    assert.equal(restored.scenario.inventory[item.slot].active, false);
  }
});

test('expanded graphics retain every original tile and append exact source bytes for all extra crops', () => {
  const base = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(e => e.name === 'ega16til.til')!.bytes;
  const files = allCropFiles(readScenario(source('SCEN4.SSM')).cropFiles);
  const crops = files.map(file => source('CROPS/' + file.toUpperCase()));
  const atlas = patchCropGraphics(base, crops), old = patchCropGraphics(base, crops.slice(0, 16));
  assert.deepEqual(atlas.slice(0, old.length), old);
  for (let slot = 16; slot < 24; slot++) for (const { tile, sourceOffset } of cropTilePatches(slot, 24))
    assert.deepEqual(atlas.slice(tile * 128, (tile + 1) * 128), Uint8Array.from(crops[slot].subarray(sourceOffset, sourceOffset + 128)));
  assert.throws(() => cropTilePatches(24, 24)); assert.throws(() => allCropFiles(files.slice(1)));
  assert.throws(() => allCropFiles([...files.slice(0, 23), files[0]]));
});

test('v24 rejects mismatched catalogs, counts, market tables and field references; missing assets do not mutate the farm', () => {
  const game = new GameSimulation(readScenario(source('SCEN4.SSM')), catalog), old = game.save(4);
  assert.throws(() => game.withAllCrops(catalog.slice(0, 16)), /Missing simulation crop/); assert.equal(game.save(4), old);
  const expanded = game.withAllCrops(catalog), checkpoint = JSON.parse(expanded.save(4));
  for (const mutate of [
    (s: any) => s.scenario.cropFiles[23] = s.scenario.cropFiles[0],
    (s: any) => s.runtime.market.history.pop(), (s: any) => s.runtime.crops.pop(),
    (s: any) => s.runtime.cropMarketPrices.pop(), (s: any) => s.scenario.records.seedDefinitions = s.scenario.records.seedDefinitions.slice(0, -36),
    (s: any) => s.version = 23,
    (s: any) => { const bytes = Buffer.from(s.scenario.records.fields, 'hex'); bytes[68 + 14] = 24; s.scenario.records.fields = bytes.toString('hex'); },
    (s: any) => s.runtime.crops[23][0] ^= 1,
  ]) { const bad = structuredClone(checkpoint); mutate(bad); assert.throws(() => GameSimulation.load(JSON.stringify(bad), catalog)); }
  assert.throws(() => GameSimulation.load(JSON.stringify(checkpoint), catalog.slice(0, 16)), /Missing simulation crop/);
  assert.equal(expanded.save(4), JSON.stringify(checkpoint));
});

test('new farms, restarts and original imports retain all crops after native expansion without modifying SSM bytes', () => {
  const { seeds: _, ...options } = newFarmOptions;
  const fresh = GameSimulation.createNew(newFarmOptions, assets).withAllCrops(catalog);
  const restarted = fresh.restartGenerated(options, assets).withAllCrops(catalog);
  const bytes = source('SCEN7.SSM'), before = Buffer.from(bytes);
  const imported = restarted.importOriginal(bytes, catalog).simulation.withAllCrops(catalog);
  for (const game of [fresh, restarted, imported]) {
    assert.equal(game.getSnapshot().scenario.cropFiles.length, 24);
    assert.equal(GameSimulation.load(game.save(null), catalog).simulation.save(null), game.save(null));
  }
  assert.deepEqual(bytes, before);
});
