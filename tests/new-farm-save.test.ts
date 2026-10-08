import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/simulation/game';
import { createNewFarmState } from '../src/simulation/create-farm';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { readScenario } from '../src/formats/scenario';
import { readFileSync } from 'node:fs';
import { checkFieldPlacement } from '../src/simulation/field-placement';
import { checkBuildingPlacement } from '../src/simulation/building-placement';
import { newFarmAssets as assets, newFarmOptions as options, newFarmExe as exe } from './support/new-farm';
const create = () => GameSimulation.createNew(options, assets);
const restore = (text: string) => GameSimulation.load(text, assets.crops, assets.townLayouts).simulation;
const parsed = (game: GameSimulation) => JSON.parse(game.save(null));

// No SSM is read by the generated fixtures or factory.
test('cold irrigation bytes and startup phase ordering reach canonical generated farms without an SSM', () => {
  assert.equal(exe.readUInt16LE(0x86af2), 64); assert.equal(exe.readUInt16LE(0x5ffb2), 0);
  assert.ok(exe.subarray(0x60134, 0x60134 + 192).every(n => n === 0));
  assert.equal(exe.subarray(0x17328, 0x17331).toString('hex'), '262b06d2f73b060224');
  assert.equal(assets.runtime.irrigation.delay, 64);
  for (let precipitation = 0; precipitation < 4; precipitation++) for (const river of [false, true]) for (const lake of [false, true]) {
    const chosen = { ...options, climate: { ...options.climate, precipitation }, river, lake };
    const state = createNewFarmState(chosen, assets), game = GameSimulation.createNew(chosen, assets), view = game.getSnapshot();
    assert.equal(view.scenario.sourceBytes, null); assert.equal(view.scenario.version, null); assert.equal(view.scenario.origin, 'generated');
    assert.equal(view.scenario.farm.cash, 40000); assert.equal(view.finances.homestead.rank, 0);
    assert.equal(view.scenario.regionalConditions.filter((v, i) => i % 7 === 1 && v === 1).length, 9);
    assert.equal(view.scenario.farm.calendar.month, 3); assert.equal(view.weather.soilMoisture, precipitation * 4);
    assert.deepEqual(view.scenario.cropFiles, assets.records.cropFiles);
    assert.equal(view.scenario.irrigation.delay, 64); assert.equal(view.scenario.fields.filter(f => f.active).length, 0);
    const save = parsed(game); assert.equal(save.version, 19); assert.equal(save.scenarioId, null); assert.equal(save.scenario.source, null);
    assert.deepEqual(save.runtime.random, state.random); assert.deepEqual(view.newFarm, state.newFarm);
    assert.equal(view.traffic.activeCount, 8); assert.equal(view.market.history.length, 16);
    assert.deepEqual(save, parsed(restore(game.save(null))));
    assert.throws(() => game.save(0), /provenance/);
    assert.throws(() => new GameSimulation(state.scenario, assets.crops, assets.townLayouts), /initialized state/);
  }
  assert.equal(assets.runtime.farm.cash, 20000); assert.equal(assets.records.records.fields[0][7], 0);
});

test('v17 preserves raw setup bytes, market history, traffic clocks and detached partial-tick continuation', () => {
  const state = createNewFarmState(options, assets), n = state.newFarm!;
  n.raw = { ds3e4c: 0xfedcba98, ds3eb8: 0x89abcdef, ds4468: Array(19).fill(65535), ds64c5: 255, s4d9fFedd: 173 };
  state.market.mood = 255; state.market.history[0][29] = 65535; n.terrainHistory[4] = 65535; n.plannerBuffer[3071] = 173;
  state.traffic.records[15].fill(255); state.traffic.records[15][0] &= ~1; state.traffic.delay = 65535; state.traffic.lastTick = 65534;
  state.scenario.fields[97].bytes[67] = 173; state.scenario.irrigation.sources[191] = 207;
  const a = restore(writeNativeSave(state, null));
  a.dispatch({ type: 'set-disasters-enabled', enabled: false }); a.dispatch({ type: 'set-paused', paused: false }); a.tick(123.456);
  const text = a.save(null), b = restore(text), events: unknown[] = []; b.subscribeEvents(e => events.push(e));
  assert.ok(parsed(a).runtime.elapsed > 0); assert.ok(parsed(a).runtime.dayTicks > 0);
  const view = b.getSnapshot(); view.newFarm!.raw.ds4468.fill(0); view.market.history[0].fill(0);
  view.traffic.records[0].fill(0); view.newFarm!.provenance.options.climate.precipitation = 0;
  view.scenario.fields[97].bytes[67] = 0; assert.equal(b.save(null), text); assert.deepEqual(events, []);
  for (let i = 0; i < 35; i++) { a.tick(1000); b.tick(1000); }
  assert.deepEqual(parsed(a), parsed(b)); assert.deepEqual(b.getSnapshot().newFarm, n);
  assert.equal(b.getSnapshot().scenario.fields[97].bytes[67], 173);
  assert.equal(b.getSnapshot().scenario.irrigation.sources[191], 207);
});

test('v17 rejects forged provenance, missing generated state and malformed startup boundaries atomically', () => {
  const game = create(), text = game.save(null);
  const changes: ((s: any) => void)[] = [s => s.version = 14, s => s.scenarioId = 0, s => s.scenario.origin = 'other',
    s => s.scenario.source = '00', s => s.scenario.cropFiles.pop(), s => s.scenario.cropFiles[0] = '../corn.crp',
    s => s.runtime.newFarm = null, s => delete s.runtime.newFarm, s => s.runtime.newFarm.provenance.version = 2,
    s => s.runtime.newFarm.provenance.options.climate.wind = 4, s => s.runtime.newFarm.provenance.options.river = 'yes',
    s => s.runtime.newFarm.provenance.options.date.year = 65536, s => s.runtime.newFarm.provenance.options.date.dayOfWeek = 7,
    s => s.runtime.newFarm.provenance.options.seeds.visual = -1, s => s.runtime.newFarm.terrainHistory.pop(),
    s => s.runtime.newFarm.raw.ds3e4c = 0x100000000, s => s.runtime.newFarm.raw.ds4468.pop(), s => s.runtime.newFarm.raw.ds64c5 = 256,
    s => s.runtime.newFarm.raw.s4d9fFedd = -1, s => s.runtime.newFarm.plannerBuffer.push(0), s => s.runtime.newFarm.plannerBuffer[0] = 256,
    s => s.runtime.market.history.pop(), s => s.runtime.market.history[0].pop(), s => s.runtime.market.history[0][0] = -1,
    s => s.runtime.market.mood = 256, s => s.runtime.traffic.activeCount = 9, s => s.runtime.traffic.records.pop(),
    s => s.runtime.traffic.records[0][2] = 96, s => s.runtime.traffic.records[0][6] = 8,
    s => s.runtime.traffic.records[0][7] = 4, s => s.runtime.traffic.lastTick = 65536,
    s => s.runtime.traffic.delay = -1, s => s.runtime.finances.accounts.homeRegionX = 12,
  ];
  for (const change of changes) { const s = JSON.parse(text); change(s); assert.throws(() => restore(JSON.stringify(s))); assert.equal(game.save(null), text); }
  assert.throws(() => GameSimulation.load(text, [], assets.townLayouts), /Missing simulation crop/);
  const changed = assets.crops.map(c => ({ ...c, rawDefinition: [...c.rawDefinition] })); changed[0].rawDefinition[34] ^= 1;
  assert.throws(() => GameSimulation.load(text, changed, assets.townLayouts), /different crop definitions/);
});

test('v1–14 original checkpoints migrate to v17 without invented generated provenance or lost source bytes', () => {
  const source = new Uint8Array(readFileSync(new URL('../../simfarm-dos/SCEN4.SSM', import.meta.url)));
  const scenario = readScenario(source), game = new GameSimulation(scenario, assets.crops, assets.townLayouts);
  const baseline = JSON.parse(game.save(4)); assert.equal(baseline.runtime.newFarm, null);
  for (let version = 1; version <= 14; version++) {
    const old = structuredClone(baseline); old.version = version; delete old.scenario.origin; delete old.scenario.cropFiles; delete old.runtime.newFarm;
    if (version === 1) delete old.scenario.schedule;
    const loaded = GameSimulation.load(JSON.stringify(old), assets.crops, assets.townLayouts);
    assert.equal(loaded.scenarioId, 4); assert.equal(loaded.simulation.getSnapshot().newFarm, null);
    assert.deepEqual(loaded.simulation.getSnapshot().scenario.sourceBytes, source);
    const upgraded = JSON.parse(loaded.simulation.save(4)); assert.equal(upgraded.version, 19); assert.equal(upgraded.scenario.origin, 'original');
    assert.equal(upgraded.runtime.newFarm, null);
  }
  baseline.runtime.newFarm = createNewFarmState(options, assets).newFarm;
  assert.throws(() => readNativeSave(JSON.stringify(baseline)), /provenance/);
});

test('generated farms plant, grow, harvest into purchased storage and sell with exact saved continuation', () => {
  let a = create(); a.dispatch({ type: 'set-disasters-enabled', enabled: false }); a.dispatch({ type: 'set-auto-clear', enabled: true });
  let view = a.getSnapshot();
  const position = (check: (x: number, y: number) => boolean) => {
    for (let x = 0; x < 89; x++) for (let y = 0; y < 89; y++) if (check(x, y)) return { x, y };
    throw new Error('No test placement');
  };
  const field = position((x, y) => checkFieldPlacement(view.scenario, x, y).ok);
  a.dispatch({ type: 'create-field', ...field, cropSlot: 0 }); assert.ok(a.getSnapshot().lastNewFieldResult?.ok);
  view = a.getSnapshot(); const storage = position((x, y) => checkBuildingPlacement(view.scenario, 65, x, y, view.weather.soilMoisture).ok);
  a.dispatch({ type: 'build', ...storage, buildingType: 65 }); assert.ok(a.getSnapshot().lastBuildingResult?.ok);
  a.dispatch({ type: 'set-paused', paused: false }); a.tick(12.345);
  let b = restore(a.save(null));
  let treated = false;
  // Source-paced equipment changes field completion and subsequent RNG timing.
  // Allow the growing season; harvest when the recovered quote becomes valuable.
  for (let day = 0; day < 168; day++) {
    a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' });
    if (!treated && a.getSnapshot().scenario.fields[1].state === 4) for (const g of [a, b]) {
      treated = true;
      g.dispatch({ type: 'treat-field', fieldSlot: 1, treatment: 'fertilizer' }); assert.ok(g.getSnapshot().lastTreatmentResult?.ok);
    }
    if (day % 14 === 0) { assert.deepEqual(parsed(a), parsed(b)); b = restore(b.save(null)); }
    if (treated && (a.getSnapshot().fieldHarvestEstimates[1]?.value ?? 0) > 0) break;
  }
  assert.ok((a.getSnapshot().fieldHarvestEstimates[1]?.value ?? 0) > 0);
  // Automatic plans may have stored an earlier crop during the longer season.
  // Verify the new manual harvest, not the first occupied inventory slot.
  const priorHarvests = new Set(a.getSnapshot().scenario.inventory.filter(i => i.active && i.type === 168).map(i => i.slot));
  for (const g of [a, b]) { g.dispatch({ type: 'harvest-field', fieldSlot: 1 }); assert.ok(g.getSnapshot().lastHarvestResult?.ok); }
  for (let day = 0; day < 12; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(parsed(a), parsed(b));
  const harvest = a.getSnapshot().scenario.inventory.find(i => i.active && i.type === 168 && !priorHarvests.has(i.slot)); assert.ok(harvest);
  assert.ok((a.getSnapshot().storedHarvestValues[harvest.slot] ?? 0) > 0);
  for (const g of [a, b]) { g.dispatch({ type: 'sell-harvest', inventorySlot: harvest.slot }); assert.ok(g.getSnapshot().lastSaleResult?.ok); }
  assert.deepEqual(parsed(a), parsed(b)); a = restore(a.save(null)); assert.equal(a.getSnapshot().scenario.inventory[harvest.slot].active, false);
});

test('invalid creation options and cold irrigation bytes reject without mutating shared source defaults', () => {
  const before = JSON.stringify(assets);
  for (const invalid of [
    { ...options, climate: { ...options.climate, precipitation: 4 } },
    { ...options, date: { year: 1993, dayOfWeek: 7 } },
    { ...options, seeds: { ...options.seeds, visual: -1 } },
  ]) assert.throws(() => GameSimulation.createNew(invalid, assets));
  const runtime = structuredClone(assets.runtime); runtime.irrigation.sources[191] = 256;
  assert.throws(() => GameSimulation.createNew(options, { ...assets, runtime }), /irrigation bytes/);
  assert.equal(JSON.stringify(assets), before);
});
