import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { orderTreatment, updateTreatmentField, TREATMENTS, type Treatment } from '../src/simulation/field-treatment';
import { updateEquipment } from '../src/simulation/equipment-dispatch';
import { reserveEquipment } from '../src/simulation/equipment-rental';
import type { EquipmentRuntime } from '../src/simulation/equipment-world';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const world = readScenario(source(`SCEN${id}.SSM`)), field = world.fields[1];
  const crop = readCrop('selected', source(`CROPS/${world.cropFiles[field.cropSlot].toUpperCase()}`)).rawDefinition;
  const runtime: EquipmentRuntime = { grassTravelCount: 0, animationTick: 0, notices: [] };
  return { world, field, crop, runtime };
}

test('all four treatment jobs consume once, traverse without repainting, restore state and return equipment on every original farm', () => {
  for (let id = 0; id < 8; id++) for (const treatment of TREATMENTS) {
    const { world, field, crop, runtime } = setup(id), b = field.bytes;
    const kind = TREATMENTS.indexOf(treatment), before = Uint8Array.from(b), cash = world.farm.cash;
    b[29] = 30; b[30] = 31; b[31] = 32; b[32] = 240;
    b[20] = 80; b[21] = 90; b[22] = 100; b[60] = 255; b[61] = 128; b[62] = 63;
    const tile = world.cells[worldIndex(field.x + 3, field.y + 4)].terrain & 0x7ff;
    const result = orderTreatment(world, field.slot, treatment, 8);
    assert.ok(result.ok); assert.equal(result.cost, id === 0 ? 0 : 275);
    const paid = world.farm.cash, steps = new Set<number>(), used = new Set<number>();
    assert.equal(orderTreatment(world, field.slot, treatment, 8).ok, false);
    assert.equal(world.farm.cash, paid);
    let tick = 0;
    for (; tick < 5000; tick++) {
      const allocate = (w: typeof world, type: number, x: number, y: number) => reserveEquipment(w, type, x, y, tick);
      updateEquipment(world, runtime, tick, true, allocate);
      if (field.state >= 6 && field.state <= 9) steps.add(field.step);
      if (field.equipment) used.add(field.equipment);
      if (field.pendingEquipment) used.add(field.pendingEquipment);
      updateTreatmentField(field, crop, world, runtime, tick, 8, allocate);
      if (field.state === before[2] && !world.equipment.some(e => e.active && (e.flags & 11))) break;
    }
    assert.ok(tick < 5000, `farm ${id} ${treatment} stuck ${field.state}/${field.step}`);
    assert.deepEqual([...steps], [1, 2, 3, 4, 5]);
    assert.equal(used.size, 2); assert.deepEqual([...used].map(i => world.equipment[i].type).sort(), [0, 3]);
    assert.equal(field.state, before[2]); assert.equal(field.step, before[3]);
    assert.equal(b[34], before[34]); assert.equal(b[33], before[33]);
    assert.deepEqual([...b.slice(18, 20)], [...before.slice(18, 20)]);
    assert.equal(world.cells[worldIndex(field.x + 3, field.y + 4)].terrain & 0x7ff, tile);
    assert.equal(world.farm.cash, cash - result.cost - world.farm.rentalExpenses);
    assert.equal(field.equipment, 0); assert.equal(field.pendingEquipment, 0);
    for (const slot of used) { assert.equal(world.equipment[slot].parent, 0); assert.equal(world.equipment[slot].attachment, 0); }
    assert.equal(b[28], 30); // Original status sample precedes the treatment effect.
    if (kind === 0) {
      assert.deepEqual([...b.slice(29, 33)], [255, 255, 255, 240]);
      assert.deepEqual([...b.slice(60, 63)], [255, 128, 63]);
    } else {
      assert.equal(b[32], 255);
      const pests = [80, 90, 100]; pests[kind - 1] = 0;
      assert.deepEqual([...b.slice(20, 23)], pests);
      const pressures = [255, 128, 63]; pressures[kind - 1] >>= 2;
      assert.deepEqual([...b.slice(60, 63)], pressures);
      assert.deepEqual([...b.slice(29, 32)], [30, 31, 32]);
    }
    assert.equal(runtime.notices.some(n => n.type === 'parking-unavailable'), false);
  }
});

test('invalid, busy and unpaid treatment orders leave the complete original state unchanged', () => {
  for (const [slot, treatment, state, cash] of [[0, 'fertilizer', 4, 40000], [1, 'unknown', 4, 40000],
    [1, 'fertilizer', 3, 40000], [1, 'fungicide', 4, 274]] as const) {
    const { world, field } = setup(); field.bytes[2] = state; world.farm.cash = cash;
    const before = JSON.stringify(world);
    assert.equal(orderTreatment(world, slot, treatment as Treatment, 8).ok, false);
    assert.equal(JSON.stringify(world), before);
  }
});

test('scheduled step zero waits for supplies and unavailable machinery does not repeat payment', () => {
  const { world, field, crop, runtime } = setup();
  field.bytes[2] = 6; field.bytes[3] = 0; field.bytes[4] = 0; field.bytes[5] = 0;
  world.farm.cash = 274;
  const unavailable = () => undefined;
  assert.equal(updateTreatmentField(field, crop, world, runtime, 1, 8, unavailable), false);
  assert.equal(field.step, 0); assert.equal(world.farm.cash, 274);
  world.farm.cash = 275;
  assert.equal(updateTreatmentField(field, crop, world, runtime, 2, 8, unavailable), true);
  assert.equal(field.step, 1); assert.equal(world.farm.cash, 0);
  for (let tick = 3; tick < 30; tick++) updateTreatmentField(field, crop, world, runtime, tick, 8, unavailable);
  assert.equal(field.step, 1); assert.equal(world.farm.chemicalExpenses, 275);
  assert.equal(field.equipment, 0);
});

test('waiting fields resume their saved substep and treatment timing survives the 16-bit tick boundary', () => {
  const { world, field, crop, runtime } = setup();
  field.bytes[2] = 0; field.bytes[3] = 7;
  assert.ok(orderTreatment(world, field.slot, 'fertilizer', 8).ok);
  for (let tick = 0; tick < 5000 && field.step !== 5; tick++) {
    const allocate = (w: typeof world, type: number, x: number, y: number) => reserveEquipment(w, type, x, y, tick);
    updateEquipment(world, runtime, tick, true, allocate);
    updateTreatmentField(field, crop, world, runtime, tick, 8, allocate);
  }
  assert.equal(field.step, 5);
  const tractor = world.equipment[field.equipment];
  tractor.timestamp = 65535;
  const before = JSON.stringify(world);
  assert.equal(updateTreatmentField(field, crop, world, runtime, 65535, 8), false);
  assert.equal(JSON.stringify(world), before);
  // Last traversal position: completion on wrapped tick zero must restore the saved Waiting state.
  tractor.bytes[5] = field.x + field.width; tractor.bytes[6] = field.y + field.height - 1; tractor.bytes[49] = 1;
  assert.equal(updateTreatmentField(field, crop, world, runtime, 0, 8), true);
  assert.equal(field.state, 0); assert.equal(field.step, 7);
  assert.equal(field.bytes[29], 255); assert.equal(field.equipment, 0);
});
