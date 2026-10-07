import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex, type Scenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { Binary } from '../src/formats/binary';
import { GameSimulation } from '../src/simulation/game';
import { finishWeeklyFieldWork } from '../src/simulation/field-weekly';
import { TREATMENTS } from '../src/simulation/field-treatment';
import { equipmentChain, type EquipmentRuntime } from '../src/simulation/equipment-world';
import { fieldHarvestValue } from '../src/simulation/harvest-value';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  const definitions = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  return { scenario, definitions, crops: definitions.map(c => c.rawDefinition) };
}
const runtime = (world: Scenario): EquipmentRuntime => ({ grassTravelCount: 0, animationTick: world.farm.animationTicks, notices: [] });
function assertReleased(world: Scenario, slots: number[]) {
  for (const slot of slots) {
    const e = world.equipment[slot];
    assert.equal(e.flags & 11, 0, `equipment ${slot} still busy`);
    assert.equal(e.parent, 0); assert.equal(e.attachment, 0); assert.equal(e.fieldSlot, 0);
    if (e.flags & 64) assert.equal(e.active, false);
  }
}
function assigned(world: Scenario): number[] {
  const f = world.fields[1], header = new Binary(f.bytes).u16(46);
  const slots = [f.equipment, f.pendingEquipment];
  if (f.state === 5 && f.step < 4 && header) slots.push(header);
  return [...new Set(slots.filter(Boolean).flatMap(slot => equipmentChain(world.equipment[slot], world).map(e => e.slot)))];
}

test('weekly completion matches the original state jump table and equipment flag masks', () => {
  const exe = source('SIMFARM.EXE');
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => 0x2cf40 + exe.readUInt16LE(0x2f640 + i * 2)),
    [0x2f19a, 0x2f64e, 0x2e970, 0x2f4d4, 0x2f536, 0x2f57c, 0x2f5c0]);
  assert.equal(exe.subarray(0x2f295, 0x2f29c).toString('hex'), '2681a4bca6fce9');
  assert.equal(exe.subarray(0x2f4de, 0x2f4e1).toString('hex'), '68ff00'); // Full fertilizer even before work starts.
});

test('weekly planting completion handles every actual planting phase on all eight original farms', () => {
  for (let id = 0; id < 8; id++) {
    const { scenario, definitions, crops } = setup(id), game = new GameSimulation(scenario, definitions), phases = new Set<number>();
    game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
    game.dispatch({ type: 'set-paused', paused: false });
    for (let tick = 0; tick < 4096; tick++) {
      const world = game.getSnapshot().scenario, field = world.fields[1];
      if (field.state !== 3) break;
      if (!phases.has(field.step)) {
        phases.add(field.step);
        const used = assigned(world), cash = world.farm.cash, marker = field.bytes[33], heat = new Binary(field.bytes).u16(36);
        const plan = Uint8Array.from(world.schedule.bytes), source = Uint8Array.from(world.sourceBytes);
        finishWeeklyFieldWork(world, crops, runtime(world));
        assert.equal(field.state, 4); assert.equal(field.step, 0); assert.equal(field.bytes[34], 0);
        assert.equal(field.bytes[33], marker); assert.equal(new Binary(field.bytes).u16(36), heat);
        assert.equal(field.equipment, 0); assert.equal(field.pendingEquipment, 0); assertReleased(world, used);
        assert.equal(world.cells[worldIndex(field.x + 3, field.y + 4)].terrain & 0x7ff, 688);
        assert.equal(world.farm.cash, cash); assert.deepEqual(world.schedule.bytes, plan); assert.deepEqual(world.sourceBytes, source);
      }
      game.tick(1000 / scenario.farm.dayDelayTicks);
    }
    assert.deepEqual([...phases], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  }
}, 15000);

test('weekly treatments restore prior state, release actual machinery and apply full effects at every phase', () => {
  for (const treatment of TREATMENTS) {
    const { scenario, definitions, crops } = setup(), game = new GameSimulation(scenario, definitions), phases = new Set<number>();
    game.dispatch({ type: 'treat-field', fieldSlot: 1, treatment }); game.dispatch({ type: 'set-paused', paused: false });
    for (let tick = 0; tick < 2048; tick++) {
      const world = game.getSnapshot().scenario, f = world.fields[1], kind = TREATMENTS.indexOf(treatment);
      if (f.state < 6) break;
      if (!phases.has(f.step)) {
        phases.add(f.step); const used = assigned(world), cash = world.farm.cash, oldAge = f.bytes[34], oldSample = f.bytes[28];
        f.bytes[29] = 1; f.bytes[30] = 2; f.bytes[31] = 3; f.bytes[32] = 240;
        f.bytes[20] = 80; f.bytes[21] = 90; f.bytes[22] = 100; f.bytes[60] = 63; f.bytes[61] = 128; f.bytes[62] = 255;
        finishWeeklyFieldWork(world, crops, runtime(world));
        assert.equal(f.state, 4); assert.equal(f.bytes[4], 0); assert.equal(f.bytes[5], 0); assert.equal(f.bytes[34], oldAge);
        assert.equal(f.bytes[28], oldSample); assert.equal(world.farm.cash, cash); assertReleased(world, used);
        if (!kind) assert.deepEqual([...f.bytes.slice(29, 33)], [255, 255, 255, 240]);
        else {
          assert.equal(f.bytes[32], 255); assert.equal(f.bytes[19 + kind], 0);
          assert.equal(f.bytes[59 + kind], [63, 128, 255][kind - 1] >> 2);
        }
      }
      game.tick(1000 / scenario.farm.dayDelayTicks);
    }
    assert.deepEqual([...phases], [1, 2, 3, 4, 5]);
  }
  const { scenario, crops } = setup(), f = scenario.fields[1];
  scenario.farm.cash = 0; f.bytes[2] = 6; f.bytes[3] = 0; f.bytes[4] = 0; f.bytes[5] = 11;
  f.bytes[29] = 0;
  finishWeeklyFieldWork(scenario, crops, runtime(scenario));
  assert.equal(f.state, 0); assert.equal(f.step, 0); assert.equal(f.bytes[5], 11);
  assert.equal(f.bytes[29], 255); assert.equal(scenario.farm.cash, 0); assert.equal(scenario.farm.chemicalExpenses, 0); // SF-032 preserved.
});

test('weekly harvest completion settles actual machinery and worker phases across every original farm', () => {
  for (let id = 0; id < 8; id++) {
    const { scenario, definitions, crops } = setup(id), game = new GameSimulation(scenario, definitions), phases = new Set<number>();
    game.dispatch({ type: 'harvest-field', fieldSlot: 1 }); game.dispatch({ type: 'set-paused', paused: false });
    for (let tick = 0; tick < 4096; tick++) {
      const world = game.getSnapshot().scenario, f = world.fields[1];
      if (f.state !== 5) break;
      if (!phases.has(f.step)) {
        phases.add(f.step); const used = assigned(world), cash = world.farm.cash;
        finishWeeklyFieldWork(world, crops, runtime(world));
        assert.equal(f.state, crops[f.cropSlot][62] & 1 ? 4 : 0); assert.equal(f.step, 0);
        assert.equal(f.equipment, 0); assert.equal(f.pendingEquipment, 0); assertReleased(world, used);
        assert.ok(world.farm.cash >= cash);
        const after = JSON.stringify(world); finishWeeklyFieldWork(world, crops, runtime(world));
        assert.equal(JSON.stringify(world), after, 'completion must not pay or store twice');
      }
      game.tick(1000 / scenario.farm.dayDelayTicks);
    }
    assert.ok(phases.size >= (crops[scenario.fields[1].cropSlot][57] === 1 ? 5 : 7), `farm ${id} phases ${[...phases]}`);
  }
}, 15000);

test('weekly harvest honors contracts, storage failure cleanup, already-paid sales and worker-sale repair', () => {
  const { scenario, crops } = setup(4), f = scenario.fields[1], data = new Binary(f.bytes);
  f.bytes[2] = 5; f.bytes[3] = 10; f.bytes[34] = 84; f.bytes[28] = 255; data.view.setUint16(18, 1, true);
  for (const offset of [38, 40]) data.view.setUint16(offset, 0, true);
  data.view.setUint16(48, 500, true); scenario.cropDefinitions[f.cropSlot].count = 1;
  const value = fieldHarvestValue(f, crops[f.cropSlot], scenario.cropDefinitions[f.cropSlot].price), cash = scenario.farm.cash;
  finishWeeklyFieldWork(scenario, crops, runtime(scenario));
  assert.equal(scenario.farm.cash, cash + value); assert.equal(data.u16(48), 0); assert.equal(scenario.cropDefinitions[f.cropSlot].count, 0);
  for (const step of [7, 16]) {
    const { scenario: w, crops: c } = setup(4), field = w.fields[1]; field.bytes[2] = 5; field.bytes[3] = step;
    field.bytes[34] = 70; field.bytes[28] = 255;
    const amount = fieldHarvestValue(field, c[field.cropSlot], w.cropDefinitions[field.cropSlot].price), cash = w.farm.cash;
    finishWeeklyFieldWork(w, c, runtime(w));
    assert.equal(field.state, 0); assert.equal(field.pendingEquipment, 0);
    assert.equal(w.farm.cash, cash + (step === 16 ? amount : 0));
  }
  const { scenario: w, crops: c } = setup(4), field = w.fields[1]; field.bytes[2] = 5; field.bytes[3] = 5;
  // Exhaust native inventory: forced storage must fall back to sale and release its new reservation.
  for (const item of w.inventory.slice(1)) item.bytes[10] |= 32;
  const reservations = () => w.buildings.flatMap(b => Array.from({ length: 12 }, (_, i) => b.content(i))).filter(x => x.type === -2).length;
  const before = reservations(); finishWeeklyFieldWork(w, c, runtime(w)); assert.equal(reservations(), before);
});

test('forced planting uses the original badge boundary and clears overlays without rewriting their words', () => {
  const { scenario, crops } = setup(), f = scenario.fields[1]; f.bytes[2] = 3;
  const tiles = [538, 539, 634, 635, 665, 815];
  tiles.forEach((tile, x) => {
    const cell = scenario.cells[worldIndex(f.x + x, f.y + 4)];
    cell.terrain = 0xf800 | tile; cell.overlay = 0xdead; cell.attribute = 0xab;
  });
  finishWeeklyFieldWork(scenario, crops, runtime(scenario));
  tiles.forEach((tile, x) => {
    const cell = scenario.cells[worldIndex(f.x + x, f.y + 4)];
    assert.equal(cell.terrain, 0xf000 | (tile >= 539 && tile < 635 ? tile : 688 + f.cropSlot * 8));
    assert.equal(cell.overlay, 0xdead); assert.equal(cell.attribute, 0xab);
  });
  for (const state of [0, 1, 2, 4]) {
    f.bytes[2] = state; const before = JSON.stringify(scenario);
    finishWeeklyFieldWork(scenario, crops, runtime(scenario)); assert.equal(JSON.stringify(scenario), before);
  }
});
