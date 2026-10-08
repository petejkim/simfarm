import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../src/simulation/game';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { initialTerrainHistory } from '../src/simulation/terrain-random';
import { newFarmAssets, newFarmOptions } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n)).map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops }, layouts = assets.townLayouts;
const { seeds: _, ...options } = newFarmOptions;
const original = (id = 4) => new GameSimulation(readScenario(source(`SCEN${id}.SSM`)), crops, layouts);
const parsed = (g: GameSimulation) => JSON.parse(g.save(null));
const restore = (text: string) => GameSimulation.load(text, crops, layouts).simulation;

test('session setup owns retained terrain history across cold entry, generation, original import and native restoration', () => {
  const old = original(); assert.deepEqual(old.getSnapshot().setup, { terrainHistory: initialTerrainHistory(9029), sourceArchive: null, previewRaw: null });
  const generated = GameSimulation.createNew(newFarmOptions, assets), checkpoint = parsed(generated);
  assert.equal(checkpoint.version, 20);
  assert.deepEqual(checkpoint.runtime.setup.terrainHistory, checkpoint.runtime.newFarm.terrainHistory);
  const imported = generated.importOriginal(source('SCEN6.SSM'), crops).simulation;
  assert.deepEqual(imported.getSnapshot().setup, generated.getSnapshot().setup);
  const before = parsed(imported), view = imported.getSnapshot(); view.setup.terrainHistory![0] ^= 65535;
  assert.deepEqual(parsed(imported), before); assert.deepEqual(parsed(restore(imported.save(null))), before);
});

test('all original farms restart with partial record/account resets, retained weather and clocks, and archived unknown source bytes', () => {
  for (let id = 0; id < 8; id++) {
    const state = readNativeSave(original(id).save(null)).state;
    state.scenario.fields[0].bytes[67] = 173; state.scenario.equipment[0].bytes[55] = 213;
    state.scenario.inventory[0].bytes[11] = 0xab;
    state.scenario.farm.workerExpenses = 0xfedcba98; state.finances.accounts.buildingBookValue = 123456;
    state.finances.accounts.taxExpenses = 123; state.finances.annual.reportNet = 456;
    state.finances.loanRate = 29; state.finances.taxFailures = 7;
    state.scenario.farm.animationTicks = 1000; state.scenario.farm.timerTicks = 321; state.dayTicks = 17;
    state.animalFrame.lastMoveTick = 654; state.traffic.lastTick = 999; state.traffic.records[0][1] = 213;
    state.scenario.irrigation.delay = 333; state.scenario.irrigation.lastTick = 555;
    state.scenario.irrigation.active = true; state.scenario.irrigation.phase = 1;
    state.scenario.irrigation.flow = [{ x: 95, y: 94, strength: 255 }];
    Object.assign(state.weather, { nextForecast: [4, 3, 2, 1, 0, 1, 2], wind: 27, moistureBalance: 8, precipitationBonus: 4,
      precipitationYear: 4, windYear: 3, temperatureYear: 2 });
    state.disasters.enabled = false; state.disasters.tornado.frame = 3; state.disasters.tornado.lastTick = 987;
    state.market.mood = 255; state.market.rawBC72 = 217; state.speed = 4;
    const old = restore(writeNativeSave(state, null)), before = old.save(null);
    const game = old.restartGenerated(options, assets), next = readNativeSave(game.save(null)).state;
    assert.equal(next.newFarm!.provenance.kind, 'restart'); assert.equal(next.retainedSetup, null);
    assert.equal(next.scenario.origin, 'generated'); assert.equal(next.scenario.sourceBytes, null);
    assert.deepEqual(next.setup.sourceArchive, Uint8Array.from(source(`SCEN${id}.SSM`)));
    assert.notDeepEqual(next.setup.terrainHistory, state.setup.terrainHistory);
    assert.equal(next.scenario.fields[0].bytes[67], 173); assert.equal(next.scenario.equipment[0].bytes[55], 213);
    assert.equal(next.scenario.inventory[0].bytes[11], 0xab);
    for (const table of [next.scenario.fields, next.scenario.equipment, next.scenario.animals, next.scenario.buildings, next.scenario.inventory, next.scenario.chemicals]) assert.ok(table.every(r => !r.active));
    assert.equal(next.scenario.farm.cash, 40000); assert.equal(next.scenario.farm.workerExpenses, 0xfedcba98);
    assert.equal(next.finances.accounts.buildingBookValue, 123456); assert.equal(next.finances.annual.priorTaxExpenses, 123);
    assert.equal(next.finances.annual.reportNet, 456); assert.equal(next.finances.loanRate, 29); assert.equal(next.finances.taxFailures, 7);
    assert.ok(Object.values(next.finances.loan).every(n => n === 0)); assert.ok(Object.values(next.finances.debt).every(n => n === 0));
    assert.equal(next.finances.accounts.assets.equipmentBookValue, 0);
    assert.equal(next.scenario.farm.timerTicks, 0); assert.equal(next.scenario.farm.animationTicks, 0); assert.equal(next.dayTicks, 64553);
    assert.equal(next.equipmentAnimationTick, 0); assert.equal(next.animalFrame.lastMoveTick, 654);
    assert.equal(next.traffic.activeCount, 8); assert.equal(next.traffic.lastTick, 999); assert.equal(next.traffic.records[0][1], 213);
    assert.equal(next.scenario.irrigation.delay, 333); assert.equal(next.scenario.irrigation.lastTick, 0);
    assert.equal(next.scenario.irrigation.active, false); assert.equal(next.scenario.irrigation.phase, 0);
    assert.equal(next.scenario.irrigation.sourceCount, 0); assert.equal(next.scenario.irrigation.flow.length, 0);
    assert.ok(next.scenario.irrigation.sources.every(n => n === 0));
    assert.deepEqual(next.weather.forecast, state.weather.nextForecast); assert.equal(next.weather.wind, 27);
    assert.equal(next.weather.soilMoisture, 12); assert.equal(next.weather.moistureBalance, 0);
    assert.deepEqual([next.weather.precipitationYear, next.weather.temperatureYear, next.weather.windYear], [0, 0, 0]);
    assert.equal(next.disasters.enabled, true); assert.deepEqual(next.disasters.tornado, state.disasters.tornado);
    assert.equal(next.market.mood, 255); assert.equal(next.market.rawBC72, 217);
    assert.equal(next.paused, true); assert.equal(next.speed, 4); assert.equal(next.daysAdvanced, 0);
    assert.deepEqual(next.scenario.farm.calendar, { day: 1, season: 1, month: 3, week: 0, year: 1993 });
    assert.ok(next.newFarm!.plannerBuffer.every((v, i) => v === (i % 2 ? 0 : 209)));
    assert.deepEqual(parsed(game), parsed(restore(game.save(null)))); assert.equal(old.save(null), before);
    const checkpoint = game.save(null), view = game.getSnapshot(); view.setup.sourceArchive![100] ^= 255;
    assert.equal(game.save(null), checkpoint);
  }
});

test('restart continuation uses retained RNG and survives repeated generations, original imports and exact native checkpoints', () => {
  const old = GameSimulation.createNew(newFarmOptions, assets);
  for (let day = 0; day < 3; day++) old.dispatch({ type: 'advance-day' });
  const before = old.save(null), a = old.restartGenerated(options, assets), b = restore(before).restartGenerated(options, assets);
  assert.deepEqual(parsed(a), parsed(b)); assert.equal(old.save(null), before);
  for (let day = 0; day < 14; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(parsed(a), parsed(b));
  const again = a.restartGenerated(options, assets);
  assert.deepEqual(parsed(again), parsed(restore(a.save(null)).restartGenerated(options, assets)));
  assert.notDeepEqual(again.getSnapshot().setup.terrainHistory, a.getSnapshot().setup.terrainHistory);
  const fromOriginal = original().restartGenerated(options, assets), originalBytes = fromOriginal.getSnapshot().setup.sourceArchive;
  const imported = fromOriginal.importOriginal(source('SCEN6.SSM'), crops).simulation;
  assert.deepEqual(imported.getSnapshot().setup.sourceArchive, originalBytes);
  assert.deepEqual(parsed(imported), parsed(restore(imported.save(null))));
  const restarted = imported.restartGenerated(options, assets);
  assert.deepEqual(restarted.getSnapshot().setup.sourceArchive, Uint8Array.from(source('SCEN6.SSM')));
});

test('v19 validates setup boundaries, migrates only known legacy history and rejects unavailable restart history atomically', () => {
  const cold = original(), saved = parsed(cold);
  for (const change of [
    (s: any) => delete s.runtime.setup, (s: any) => s.runtime.setup.terrainHistory.pop(),
    (s: any) => s.runtime.setup.terrainHistory[0] = 65536, (s: any) => s.runtime.setup.sourceArchive = '18',
    (s: any) => s.runtime.setup.sourceArchive = '00'.repeat(139072),
  ]) { const bad = structuredClone(saved); change(bad); assert.throws(() => restore(JSON.stringify(bad))); }
  const legacy = structuredClone(saved); legacy.version = 18; delete legacy.runtime.setup;
  const unknown = restore(JSON.stringify(legacy)), before = unknown.save(null);
  assert.equal(unknown.getSnapshot().setup.terrainHistory, null);
  assert.throws(() => unknown.restartGenerated(options, assets), /no retained terrain history/);
  assert.equal(unknown.save(null), before);
  const generated = parsed(GameSimulation.createNew(newFarmOptions, assets)); generated.version = 18; delete generated.runtime.setup;
  const migrated = restore(JSON.stringify(generated));
  assert.deepEqual(migrated.getSnapshot().setup.terrainHistory, generated.runtime.newFarm.terrainHistory);
  const retained = parsed(migrated.importOriginal(source('SCEN6.SSM'), crops).simulation);
  retained.version = 18; delete retained.runtime.setup;
  assert.deepEqual(restore(JSON.stringify(retained)).getSnapshot().setup.terrainHistory, retained.runtime.retainedSetup.terrainHistory);
  const invalid = parsed(migrated); invalid.runtime.setup.terrainHistory = null; assert.throws(() => restore(JSON.stringify(invalid)), /terrain history/);
  const sourceBefore = cold.save(null);
  for (const bad of [{ ...options, river: 1 }, { ...options, climate: { ...options.climate, wind: 4 } }, { ...options, date: { year: 1993, dayOfWeek: 7 } }])
    assert.throws(() => cold.restartGenerated(bad as any, assets));
  assert.throws(() => cold.restartGenerated(options, { ...assets, crops: [] }), /Missing starting crop/);
  assert.equal(cold.save(null), sourceBefore);
});

test('a restarted original farm can plant, grow, store and sell a valuable crop with exact saved continuation', async () => {
  const { checkFieldPlacement } = await import('../src/simulation/field-placement');
  const { checkBuildingPlacement } = await import('../src/simulation/building-placement');
  const a = original().restartGenerated({ ...options, river: false, lake: false }, assets);
  a.dispatch({ type: 'set-disasters-enabled', enabled: false }); a.dispatch({ type: 'set-auto-clear', enabled: true });
  const find = (check: (x: number, y: number) => boolean) => {
    for (let x = 0; x < 89; x++) for (let y = 0; y < 89; y++) if (check(x, y)) return { x, y };
    throw new Error('No restart placement');
  };
  let view = a.getSnapshot(); const field = find((x, y) => checkFieldPlacement(view.scenario, x, y).ok);
  a.dispatch({ type: 'create-field', ...field, cropSlot: 0 }); assert.ok(a.getSnapshot().lastNewFieldResult?.ok);
  view = a.getSnapshot(); const storage = find((x, y) => checkBuildingPlacement(view.scenario, 65, x, y, view.weather.soilMoisture).ok);
  a.dispatch({ type: 'build', ...storage, buildingType: 65 }); assert.ok(a.getSnapshot().lastBuildingResult?.ok);
  let b = restore(a.save(null)), treated = false;
  for (let day = 0; day < 168; day++) {
    a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' });
    if (!treated && a.getSnapshot().scenario.fields[1].state === 4) {
      treated = true;
      for (const g of [a, b]) { g.dispatch({ type: 'treat-field', fieldSlot: 1, treatment: 'fertilizer' }); assert.ok(g.getSnapshot().lastTreatmentResult?.ok); }
    }
    if (day % 14 === 0) { assert.deepEqual(parsed(a), parsed(b)); b = restore(b.save(null)); }
    if (treated && (a.getSnapshot().fieldHarvestEstimates[1]?.value ?? 0) > 0) break;
  }
  assert.ok((a.getSnapshot().fieldHarvestEstimates[1]?.value ?? 0) > 0);
  const oldSlots = new Set(a.getSnapshot().scenario.inventory.filter(i => i.active && i.type === 168).map(i => i.slot));
  for (const g of [a, b]) { g.dispatch({ type: 'harvest-field', fieldSlot: 1 }); assert.ok(g.getSnapshot().lastHarvestResult?.ok); }
  for (let day = 0; day < 12; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
  const item = a.getSnapshot().scenario.inventory.find(i => i.active && i.type === 168 && !oldSlots.has(i.slot)); assert.ok(item);
  assert.ok((a.getSnapshot().storedHarvestValues[item.slot] ?? 0) > 0);
  for (const g of [a, b]) { g.dispatch({ type: 'sell-harvest', inventorySlot: item.slot }); assert.ok(g.getSnapshot().lastSaleResult?.ok); }
  assert.deepEqual(parsed(a), parsed(b)); assert.equal(a.getSnapshot().scenario.inventory[item.slot].active, false);
});
