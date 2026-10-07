import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';
import { quoteLand } from '../src/simulation/land';
import { TREATMENTS } from '../src/simulation/field-treatment';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function farm(id = 4) {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  return { scenario, crops };
}

test('treatment commands own detached chemical stock and complete with deterministic machinery/weather timing', () => {
  for (const treatment of TREATMENTS) {
    const input = farm(0), a = new GameSimulation(input.scenario, input.crops), b = new GameSimulation(input.scenario, input.crops);
    const stock = a.getSnapshot().scenario.chemicals.filter(c => c.active).length;
    for (const game of [a, b]) {
      game.dispatch({ type: 'treat-field', fieldSlot: 1, treatment });
      assert.equal(game.getSnapshot().lastTreatmentResult?.ok, true);
      assert.equal(game.getSnapshot().scenario.chemicals.filter(c => c.active).length, stock - 1);
      game.dispatch({ type: 'set-paused', paused: false });
    }
    const view = a.getSnapshot(); view.scenario.chemicals[1].bytes.fill(255); view.scenario.chemicalDefinitions[0].count = 500;
    a.tick(12000); for (let n = 0; n < 120; n++) b.tick(100);
    assert.deepEqual(a.getSnapshot().scenario, b.getSnapshot().scenario);
    assert.deepEqual(a.getSnapshot().weather, b.getSnapshot().weather);
    assert.equal(a.getSnapshot().scenario.fields[1].state, 4);
    assert.equal(input.scenario.chemicals.filter(c => c.active).length, stock);
  }
});

test('fertilizer makes a newly purchased original plot produce a valuable stored corn harvest', () => {
  const input = farm(), game = new GameSimulation(input.scenario, input.crops);
  game.dispatch({ type: 'buy-land', regionX: 0, regionY: 2 });
  game.dispatch({ type: 'set-auto-clear', enabled: true });
  game.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 });
  const result = game.getSnapshot().lastNewFieldResult; assert.ok(result?.ok);
  for (let day = 0; day < 2; day++) game.dispatch({ type: 'advance-day' });
  assert.ok(game.getSnapshot().scenario.fields[result.slot].bytes[29] < 32);
  game.dispatch({ type: 'treat-field', fieldSlot: result.slot, treatment: 'fertilizer' });
  assert.deepEqual(game.getSnapshot().lastTreatmentResult,
    { ok: true, source: 'purchased', cost: 275, fieldSlot: result.slot, treatment: 'fertilizer' });
  const ordered = game.getSnapshot();
  game.tick(3000); assert.equal(game.getSnapshot(), ordered); // Paused work stays paused.
  for (let day = 2; day < 84; day++) game.dispatch({ type: 'advance-day' });
  const grown = game.getSnapshot();
  assert.equal(grown.scenario.fields[result.slot].state, 4);
  assert.ok(grown.scenario.fields[result.slot].bytes[29] > 128);
  assert.ok(grown.fieldHarvestEstimates[result.slot]!.value > 0);
  const priorItems = new Set(grown.scenario.inventory.filter(i => i.active).map(i => i.slot));
  game.dispatch({ type: 'harvest-field', fieldSlot: result.slot });
  game.dispatch({ type: 'advance-day' }); // The next week completes harvest and replants four original corn fields.
  const stored = game.getSnapshot(), item = stored.scenario.inventory.find(i => i.active && i.type === 168 && !priorItems.has(i.slot))!;
  assert.ok(item); assert.equal(stored.storedHarvestValues[item.slot], 395);
  const cash = stored.scenario.farm.cash;
  game.dispatch({ type: 'sell-harvest', inventorySlot: item.slot });
  assert.equal(game.getSnapshot().scenario.farm.cash, cash + 395);
  assert.equal(game.getSnapshot().scenario.farm.cash, 21800);
  assert.equal(game.getSnapshot().scenario.fields[result.slot].state, 0);
});

test('all original farms buy land, clear it, plant a new field and finish machinery work', () => {
  for (let id = 0; id < 8; id++) {
    const input = farm(id), game = new GameSimulation(input.scenario, input.crops), ry = id === 4 ? 2 : 0;
    const initial = game.getSnapshot(), count = initial.scenario.fields.filter(f => f.active).length;
    const price = quoteLand(initial.scenario, 0, ry, initial.weather.soilMoisture)!.price;
    game.dispatch({ type: 'buy-land', regionX: 0, regionY: ry });
    const bought = game.getSnapshot();
    assert.deepEqual(bought.lastLandResult, { ok: true, regionX: 0, regionY: ry, price });
    assert.equal(bought.scenario.farm.cash, 40000 - price);
    assert.equal(initial.scenario.farm.cash, 40000);
    game.dispatch({ type: 'create-field', x: 0, y: ry * 8, cropSlot: 0 });
    assert.deepEqual(game.getSnapshot().lastNewFieldResult, { ok: false, reason: 'blocked-terrain' });
    game.dispatch({ type: 'set-auto-clear', enabled: true });
    game.dispatch({ type: 'create-field', x: 0, y: ry * 8, cropSlot: 0 });
    const planted = game.getSnapshot(), result = planted.lastNewFieldResult;
    assert.ok(result?.ok); assert.equal(result.cost, planted.scenario.seedDefinitions[0].price + 20);
    assert.equal(planted.scenario.farm.cash, 40000 - price - result.cost);
    assert.equal(planted.scenario.fields.filter(f => f.active).length, count + 1);
    const field = planted.scenario.fields[result.slot];
    assert.equal(field.state, 3); assert.equal(field.x, 0); assert.equal(field.y, ry * 8);
    assert.deepEqual(planted.scenario.regionalConditions, bought.scenario.regionalConditions); // No replant pest reductions.
    const region = ((4 >> 3) * 12 + ((ry * 8 + 4) >> 3)) * 7;
    assert.equal(field.bytes[20], planted.scenario.regionalConditions[region + 2]);
    assert.equal(field.bytes[21], planted.scenario.regionalConditions[region + 4]);
    assert.equal(field.bytes[22], planted.scenario.regionalConditions[region + 3]);
    assert.equal(planted.scenario.cropDefinitions[0].price, planted.cropMarketPrices[0]);
    game.dispatch({ type: 'create-field', x: 0, y: ry * 8, cropSlot: 0 });
    assert.equal(game.getSnapshot().lastNewFieldResult?.ok, false);
    assert.deepEqual(game.getSnapshot().scenario, planted.scenario);
    for (let day = 0; day < 12; day++) game.dispatch({ type: 'advance-day' });
    const grown = game.getSnapshot();
    assert.equal(grown.scenario.fields[result.slot].state, 4, `farm ${id}`);
    assert.equal(grown.scenario.equipment.some(e => e.active && (e.flags & 9)), false);
    assert.equal(input.scenario.fields[result.slot].active, false);
    assert.equal(input.scenario.farm.autoClear, false);
  }
});

test('new-field failures preserve land, inventory, field slots, cash and random-dependent behavior', () => {
  for (const failure of ['funds', 'seeds', 'crop', 'bounds', 'slots']) {
    const input = farm();
    if (failure === 'seeds') input.scenario.farm.autoBuySeeds = false;
    if (failure === 'slots') for (const field of input.scenario.fields.slice(1)) field.bytes[7] |= 1;
    const quote = quoteLand(input.scenario, 0, 2, 8)!;
    if (failure === 'funds') input.scenario.farm.cash = quote.price;
    const game = new GameSimulation(input.scenario, input.crops), control = new GameSimulation(input.scenario, input.crops);
    for (const g of [game, control]) {
      g.dispatch({ type: 'buy-land', regionX: 0, regionY: 2 });
      g.dispatch({ type: 'set-auto-clear', enabled: true });
    }
    const before = game.getSnapshot();
    game.dispatch({ type: 'create-field', x: failure === 'bounds' ? 89 : 0, y: 16, cropSlot: failure === 'crop' ? 16 : 0 });
    assert.equal(game.getSnapshot().lastNewFieldResult?.ok, false, failure);
    assert.deepEqual(game.getSnapshot().scenario, before.scenario);
    assert.deepEqual(game.getSnapshot().cropMarketPrices, before.cropMarketPrices);
    if (failure !== 'slots') { // Artificial active records are not valid simulation fields.
      for (const g of [game, control]) g.dispatch({ type: 'advance-day' });
      assert.deepEqual(game.getSnapshot().scenario, control.getSnapshot().scenario);
      assert.deepEqual(game.getSnapshot().weather, control.getSnapshot().weather);
    }
  }
});

test('simulation owns game state, publishes stable detached snapshots, and pauses elapsed time', () => {
  const input = farm(), simulation = new GameSimulation(input.scenario, input.crops);
  const initial = simulation.getSnapshot(), cash = initial.scenario.farm.cash;
  assert.equal(simulation.getSnapshot(), initial);
  let notifications = 0;
  const unsubscribe = simulation.subscribe(() => notifications++);
  input.scenario.farm.cash = 0; initial.scenario.farm.cash = 1;
  input.scenario.fields[1].bytes[34] = 200; initial.scenario.fields[1].bytes[34] = 200;
  const equipmentFlags = initial.scenario.equipment[1].flags;
  input.scenario.equipment[1].flags = 0; initial.scenario.equipment[1].flags = 0;
  input.scenario.equipmentDefinitions[0].bytes[6] = 0; initial.scenario.equipmentDefinitions[0].bytes[6] = 0;
  const buildingFlags = initial.scenario.buildings[1].flags;
  input.scenario.buildings[1].flags = 0; initial.scenario.buildings[1].flags = 0;
  input.scenario.buildingDefinitions[0].bytes[8] = 0; initial.scenario.buildingDefinitions[0].bytes[8] = 0;
  input.scenario.animals[1].flags = 0x20; initial.scenario.animals[1].flags = 0x20;
  simulation.tick(5000); assert.equal(notifications, 0);
  simulation.dispatch({ type: 'set-paused', paused: false });
  assert.equal(simulation.getSnapshot().scenario.farm.cash, cash);
  assert.equal(simulation.getSnapshot().scenario.fields[1].bytes[34], 0);
  assert.equal(simulation.getSnapshot().scenario.equipment[1].flags, equipmentFlags);
  assert.equal(simulation.getSnapshot().scenario.equipmentDefinitions[0].price, 400);
  assert.equal(simulation.getSnapshot().scenario.buildings[1].flags, buildingFlags);
  assert.equal(simulation.getSnapshot().scenario.buildingDefinitions[0].width, 1);
  assert.equal(simulation.getSnapshot().scenario.animals[1].active, false);
  simulation.tick(900); assert.equal(simulation.getSnapshot().daysAdvanced, 0);
  simulation.tick(100); assert.equal(simulation.getSnapshot().daysAdvanced, 1);
  assert.equal(simulation.getSnapshot().scenario.fields[1].bytes[34], 1); // Sunday-to-Monday month boundary.
  simulation.dispatch({ type: 'set-paused', paused: true });
  const paused = simulation.getSnapshot();
  simulation.tick(5000); assert.equal(simulation.getSnapshot(), paused);
  unsubscribe(); const count = notifications;
  simulation.dispatch({ type: 'advance-day' }); assert.equal(notifications, count);
  assert.equal(simulation.getSnapshot().daysAdvanced, 2);
  assert.throws(() => simulation.tick(-1), /elapsed/);
});

test('manual and timed schedules produce the same crop, climate and calendar state', () => {
  const input = farm(), manual = new GameSimulation(input.scenario, input.crops), timed = new GameSimulation(input.scenario, input.crops);
  for (let i = 0; i < 100; i++) manual.dispatch({ type: 'advance-day' });
  timed.dispatch({ type: 'set-paused', paused: false }); timed.tick(100000);
  const a = manual.getSnapshot(), b = timed.getSnapshot();
  assert.deepEqual(a.scenario, b.scenario); assert.deepEqual(a.weather, b.weather);
  assert.equal(a.scenario.fields[1].state, 4); // The original plan has harvested and replanted corn.
  assert.ok(a.scenario.farm.seedExpenses > 0);
  assert.equal(input.scenario.fields[1].state, 4);
});

test('player planting commands charge seed, run machinery and grow the crop on all eight original farms', () => {
  for (let id = 0; id < 8; id++) {
    const input = farm(id), game = new GameSimulation(input.scenario, input.crops), slot = input.scenario.fields.find(f => f.active)!.slot;
    const seedPrice = game.getSnapshot().scenario.seedDefinitions[0].price + 20;
    game.dispatch({ type: 'plant-field', fieldSlot: slot, cropSlot: 0 });
    const ordered = game.getSnapshot();
    assert.equal(ordered.scenario.fields[slot].state, 3);
    assert.equal(ordered.scenario.farm.cash, 40000 - seedPrice);
    assert.equal(ordered.lastPlantResult?.ok, true);
    assert.equal(ordered.scenario.cropDefinitions[0].price, ordered.cropMarketPrices[0]);
    assert.equal(ordered.cropMarketPrices[0], Math.ceil((input.crops[0].rawDefinition[34] | input.crops[0].rawDefinition[35] << 8) * 0.75));
    game.tick(10000); assert.equal(game.getSnapshot(), ordered); // Paused machinery stays paused too.
    for (let n = 0; n < 12; n++) game.dispatch({ type: 'advance-day' });
    const result = game.getSnapshot();
    assert.equal(result.scenario.fields[slot].state, 4, `farm ${id}`);
    assert.equal(result.scenario.fields[slot].cropSlot, 0);
    assert.equal(result.scenario.fields[slot].bytes[34], [0, 2, 1, 2, 2, 2, 2, 1][id]);
    assert.equal(result.scenario.equipment.some(e => e.active && (e.flags & 9)), false);
    assert.equal(result.scenario.farm.seedExpenses, seedPrice);
    assert.equal(input.scenario.farm.cash, 40000);
  }
});

test('planting is deterministic across browser frame partitions, and rejects duplicate orders without paying again', () => {
  const input = farm(1), a = new GameSimulation(input.scenario, input.crops), b = new GameSimulation(input.scenario, input.crops);
  for (const game of [a, b]) {
    game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 3 });
    const cash = game.getSnapshot().scenario.farm.cash;
    game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 3 });
    assert.deepEqual(game.getSnapshot().lastPlantResult, { ok: false, reason: 'field-busy' });
    assert.equal(game.getSnapshot().scenario.farm.cash, cash);
    game.dispatch({ type: 'set-paused', paused: false });
  }
  a.tick(5000);
  for (let i = 0; i < 300; i++) b.tick(1000 / 60);
  assert.deepEqual(a.getSnapshot().scenario, b.getSnapshot().scenario);
  assert.deepEqual(a.getSnapshot().cropMarketPrices, b.getSnapshot().cropMarketPrices);
  const detached = a.getSnapshot(); detached.scenario.seedDefinitions[0].count = 999; detached.scenario.inventory[1].bytes.fill(255);
  a.dispatch({ type: 'advance-day' });
  assert.notEqual(a.getSnapshot().scenario.seedDefinitions[0].count, 999);
  assert.notEqual(a.getSnapshot().scenario.inventory[1].type, 65535);
});

test('failed seed purchase leaves the current crop, contract and cash intact (SF-018)', () => {
  const input = farm(4); input.scenario.farm.cash = 0;
  const game = new GameSimulation(input.scenario, input.crops), before = game.getSnapshot();
  game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
  const after = game.getSnapshot();
  assert.deepEqual(after.lastPlantResult, { ok: false, reason: 'insufficient-funds' });
  assert.deepEqual(after.scenario, before.scenario);
});

test('all eight original farms advance a year without invalid terrain or missing crop state', () => {
  for (let i = 0; i < 8; i++) {
    const input = farm(i), game = new GameSimulation(input.scenario, input.crops);
    for (let day = 0; day < 336; day++) {
      game.dispatch({ type: 'advance-day' });
      if (game.getSnapshot().pendingTown) game.dispatch({ type: 'choose-town', choice: 'residential' });
    }
    const snapshot = game.getSnapshot();
    assert.deepEqual(snapshot.scenario.farm.calendar, { ...input.scenario.farm.calendar, year: 1994 });
    assert.equal(snapshot.daysAdvanced, 336);
    assert.ok(snapshot.scenario.cells.every(c => Number.isInteger(c.terrain) && c.terrain >= 0 && c.terrain <= 65535));
    assert.ok(Number.isFinite(snapshot.weather.temperature));
  }
}, 15000);

test('the fifth year-end retains the original temperature-table overread into wind (SF-007)', () => {
  const input = farm();
  input.scenario.farm.calendar = { day: 6, week: 3, month: 11, year: 1997, season: 0 };
  input.scenario.climate.temperature.fill(70); input.scenario.climate.wind.fill(12);
  const checkpoint = JSON.parse(new GameSimulation(input.scenario, input.crops).save(4));
  Object.assign(checkpoint.runtime.weather, { temperatureYear: 4, precipitationYear: 4, windYear: 4 });
  const game = GameSimulation.load(JSON.stringify(checkpoint), input.crops).simulation;
  game.dispatch({ type: 'advance-day' });
  if (game.getSnapshot().pendingTown) game.dispatch({ type: 'choose-town', choice: 'residential' });
  const snapshot = game.getSnapshot();
  assert.equal(snapshot.scenario.farm.calendar.year, 1998);
  assert.equal(snapshot.weather.temperatureYear, 0);
  assert.equal(snapshot.weather.temperature, 12);
});

test('player harvest commands complete on all original farms, publish inventory and permit the next planting', () => {
  for (let id = 0; id < 8; id++) {
    const input = farm(id), game = new GameSimulation(input.scenario, input.crops);
    const field = input.scenario.fields.find(f => f.active)!, slot = field.slot;
    const before = game.getSnapshot();
    game.dispatch({ type: 'harvest-field', fieldSlot: slot });
    assert.deepEqual(game.getSnapshot().lastHarvestResult, { ok: true });
    const ordered = game.getSnapshot();
    assert.equal(ordered.scenario.fields[slot].state, 5);
    game.tick(10000); assert.equal(game.getSnapshot(), ordered);
    game.dispatch({ type: 'harvest-field', fieldSlot: slot });
    assert.deepEqual(game.getSnapshot().lastHarvestResult, { ok: false, reason: 'not-growing' });
    assert.deepEqual(game.getSnapshot().scenario, ordered.scenario);
    for (let day = 0; day < 12; day++) game.dispatch({ type: 'advance-day' });
    const result = game.getSnapshot(), harvested = result.scenario.fields[slot];
    assert.notEqual(harvested.state, 5, `farm ${id}`);
    assert.equal(result.scenario.equipment.some(e => e.active && (e.flags & 11)), false);
    const hasStorage = input.scenario.buildings.some(b => b.active && [64, 65].includes(b.type));
    const items = result.scenario.inventory.filter(i => i.active && i.type === 168 + field.cropSlot);
    assert.equal(items.length, Number(hasStorage));
    assert.equal(before.scenario.fields[slot].state, 4);
    assert.equal(input.scenario.inventory.filter(i => i.active && i.type === 168 + field.cropSlot).length, 0);
    if (items.length) {
      items[0].bytes.fill(255); result.scenario.harvestDefinitions[field.cropSlot].count = 999;
    }
    result.fieldHarvestEstimates[slot]!.value = -1;
    game.dispatch({ type: 'plant-field', fieldSlot: slot, cropSlot: field.cropSlot });
    assert.equal(game.getSnapshot().lastPlantResult?.ok, true);
    assert.equal(game.getSnapshot().lastHarvestResult, null);
    assert.notEqual(game.getSnapshot().fieldHarvestEstimates[slot]!.value, -1);
    assert.notEqual(game.getSnapshot().scenario.harvestDefinitions[field.cropSlot].count, 999);
  }
});

test('harvesting with growing weather and machinery is deterministic across frame partitions', () => {
  for (const id of [0, 4, 6]) {
    const input = farm(id), a = new GameSimulation(input.scenario, input.crops), b = new GameSimulation(input.scenario, input.crops);
    for (const game of [a, b]) {
      game.dispatch({ type: 'harvest-field', fieldSlot: 1 });
      game.dispatch({ type: 'set-paused', paused: false });
    }
    a.tick(12000);
    for (let frame = 0; frame < 720; frame++) b.tick(1000 / 60);
    assert.deepEqual(a.getSnapshot().scenario, b.getSnapshot().scenario);
    assert.deepEqual(a.getSnapshot().weather, b.getSnapshot().weather);
    assert.deepEqual(a.getSnapshot().fieldHarvestEstimates, b.getSnapshot().fieldHarvestEstimates);
  }
});

test('an invalid harvest order leaves cash, field work and inventory unchanged', () => {
  const input = farm(4), game = new GameSimulation(input.scenario, input.crops), initial = game.getSnapshot();
  for (const slot of [0, -1, 1.5, 98, NaN]) {
    game.dispatch({ type: 'harvest-field', fieldSlot: slot });
    assert.deepEqual(game.getSnapshot().lastHarvestResult, { ok: false, reason: 'invalid-field' });
    assert.deepEqual(game.getSnapshot().scenario, initial.scenario);
  }
  game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
  const planting = game.getSnapshot();
  game.dispatch({ type: 'harvest-field', fieldSlot: 1 });
  assert.deepEqual(game.getSnapshot().lastHarvestResult, { ok: false, reason: 'not-growing' });
  assert.deepEqual(game.getSnapshot().scenario, planting.scenario);
});

test('original corn completes a positive-value plant-grow-harvest-store-sell cycle and releases its storage', () => {
  const input = farm(4), game = new GameSimulation(input.scenario, input.crops);
  game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
  for (let day = 0; day < 84; day++) game.dispatch({ type: 'advance-day' });
  const grown = game.getSnapshot();
  assert.equal(grown.scenario.fields[1].state, 4); assert.ok(grown.fieldHarvestEstimates[1]!.value > 0);
  const previousLots = new Set(grown.scenario.inventory.filter(i => i.active).map(i => i.slot));
  game.dispatch({ type: 'harvest-field', fieldSlot: 1 });
  game.dispatch({ type: 'advance-day' });
  const harvested = game.getSnapshot(), item = harvested.scenario.inventory.find(i => i.active && i.type === 168 && !previousLots.has(i.slot))!;
  const value = harvested.storedHarvestValues[item.slot]!;
  assert.ok(value > 0);
  game.dispatch({ type: 'sell-harvest', inventorySlot: item.slot });
  const sold = game.getSnapshot();
  assert.deepEqual(sold.lastSaleResult, { ok: true, slot: item.slot, value });
  assert.equal(sold.scenario.farm.cash, harvested.scenario.farm.cash + value);
  assert.equal(sold.scenario.farm.cropIncome, harvested.scenario.farm.cropIncome + value * 2); // SF-026.
  assert.equal(sold.storedHarvestValues[item.slot], null);
  assert.equal(sold.scenario.inventory[item.slot].active, false);
  assert.equal(sold.scenario.harvestDefinitions[0].count, harvested.scenario.harvestDefinitions[0].count - 1);
  assert.equal(harvested.scenario.inventory[item.slot].active, true);
  sold.lastSaleResult!.value = -1; sold.storedHarvestValues[item.slot] = 100000;
  game.dispatch({ type: 'advance-day' });
  assert.deepEqual(game.getSnapshot().lastSaleResult, { ok: true, slot: item.slot, value });
  game.dispatch({ type: 'sell-harvest', inventorySlot: item.slot });
  assert.deepEqual(game.getSnapshot().lastSaleResult, { ok: false, reason: 'invalid-item' });
  assert.equal(game.getSnapshot().scenario.farm.cash, harvested.scenario.farm.cash + value);
  assert.equal(game.getSnapshot().storedHarvestValues[item.slot], null);
  game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
  assert.equal(game.getSnapshot().lastPlantResult?.ok, true);
});

test('speed changes preserve fractional ticks, pause, and single-day manual advancement', () => {
  const input = farm(), game = new GameSimulation(input.scenario, input.crops);
  assert.equal(game.getSnapshot().speed, 1);
  game.dispatch({ type: 'set-speed', speed: 16 }); game.tick(1000);
  assert.equal(game.getSnapshot().daysAdvanced, 0);
  game.dispatch({ type: 'advance-day' }); assert.equal(game.getSnapshot().daysAdvanced, 1);
  game.dispatch({ type: 'set-speed', speed: 0.25 });
  game.dispatch({ type: 'set-paused', paused: false });
  game.tick(2001); // Half a day plus part of one logical tick.
  assert.equal(game.getSnapshot().daysAdvanced, 1);
  game.dispatch({ type: 'set-speed', speed: 4 }); game.tick(124.9375);
  assert.equal(game.getSnapshot().daysAdvanced, 2);
  game.dispatch({ type: 'set-paused', paused: true });
  game.dispatch({ type: 'set-speed', speed: 0.5 });
  const paused = game.getSnapshot(); game.tick(100000); assert.equal(game.getSnapshot(), paused);
  for (const speed of [0, -1, 0.3, 17, NaN, Infinity]) {
    assert.throws(() => game.dispatch({ type: 'set-speed', speed }), /Invalid simulation speed/);
    assert.equal(game.getSnapshot(), paused);
  }
});

test('speed scaling keeps machinery and weather identical to the same logical time at normal speed', () => {
  const input = farm(0), normal = new GameSimulation(input.scenario, input.crops), fast = new GameSimulation(input.scenario, input.crops);
  for (const game of [normal, fast]) {
    game.dispatch({ type: 'harvest-field', fieldSlot: 1 });
    game.dispatch({ type: 'set-paused', paused: false });
  }
  fast.dispatch({ type: 'set-speed', speed: 16 });
  for (let frame = 0; frame < 60; frame++) fast.tick(1000 / 60);
  normal.tick(16000);
  assert.deepEqual(fast.getSnapshot().scenario, normal.getSnapshot().scenario);
  assert.deepEqual(fast.getSnapshot().weather, normal.getSnapshot().weather);
  assert.equal(fast.getSnapshot().daysAdvanced, 16);
  assert.equal(fast.getSnapshot().scenario.fields[1].state, 4);
});
