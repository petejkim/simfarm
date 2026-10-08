import type { Scenario } from '../src/formats/scenario';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { createEquipment, reserveEquipment } from '../src/simulation/equipment-rental';
import { updateEquipment } from '../src/simulation/equipment-dispatch';
import { updatePlantingField } from '../src/simulation/field-planting';
import type { EquipmentRuntime } from '../src/simulation/equipment-world';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('rental settings, ledgers, town and both timer words load from their original saved offsets', () => {
  const towns = [[0, 4], [0, 4], [3, 8], [10, 6], [3, 0], [0, 4], [6, 11], [0, 9]];
  for (let i = 0; i < 8; i++) {
    const bytes = source(`SCEN${i}.SSM`), s = readScenario(bytes);
    assert.deepEqual([s.farm.townRegionX, s.farm.townRegionY], towns[i]);
    assert.equal(s.farm.autoRent, true); assert.equal(s.farm.rentalExpenses, 0);
    assert.equal(s.farm.timerTicks, bytes.readUInt16LE(0x216f9));
    assert.equal(s.farm.animationTicks, bytes.readUInt16LE(0x216f7));
  }
  const bad = source('SCEN1.SSM'); bad.writeUInt16LE(12, 0x2170b);
  assert.throws(() => readScenario(bad), /town region/);
});

test('automatic rentals debit half-price, reserve the first free slot and use the original town entrance', () => {
  const world = readScenario(source('SCEN1.SSM'));
  const e = reserveEquipment(world, 0, 40, 40, 65537)!;
  assert.equal(e.slot, 1); assert.equal(e.flags, 0xe1); assert.equal(e.timestamp, 1);
  assert.deepEqual([e.x, e.y, e.bytes[50], e.bytes[51]], [1, 37, 1, 37]);
  assert.equal(world.farm.cash, 39800); assert.equal(world.farm.rentalExpenses, 200);
  assert.equal(reserveEquipment(world, 0, 40, 40, 2)?.slot, 2);
  assert.equal(world.farm.cash, 39600); assert.equal(world.farm.rentalExpenses, 400);
  world.farm.rentalExpenses = 0xfffffff0;
  reserveEquipment(world, 1, 40, 40, 3);
  assert.equal(world.farm.rentalExpenses, 84); // Original unsigned ledger arithmetic.
});

test('owned machines avoid rental charges; disabled rentals, no funds and no slots cannot create active rentals', () => {
  const owned = readScenario(source('SCEN4.SSM'));
  assert.equal(reserveEquipment(owned, 0, 40, 40, 0)!.flags & 0x40, 0);
  assert.equal(owned.farm.cash, 40000); assert.equal(owned.farm.rentalExpenses, 0);
  const world = readScenario(source('SCEN1.SSM'));
  world.farm.autoRent = false;
  assert.equal(reserveEquipment(world, 0, 0, 0, 0), undefined);
  world.farm.autoRent = true; world.farm.cash = 199;
  assert.equal(reserveEquipment(world, 0, 0, 0, 0), undefined);
  assert.equal(world.equipment.some(e => e.active), false); assert.equal(world.farm.cash, 199);
  world.farm.cash = 200;
  assert.ok(reserveEquipment(world, 0, 0, 0, 0)); assert.equal(world.farm.cash, 0);
  for (const e of world.equipment.slice(1)) e.flags = 0x61;
  world.farm.cash = 1000;
  assert.equal(reserveEquipment(world, 1, 0, 0, 0), undefined); assert.equal(world.farm.cash, 1000);
});

test('new machinery resets recovered constructor members while retaining unknown bytes in reused slots', () => {
  const world = readScenario(source('SCEN1.SSM')), e = world.equipment[1];
  e.bytes.fill(0x55); e.flags = 0;
  assert.equal(createEquipment(world, 5, 10, 11, 123), e);
  assert.deepEqual([e.type, e.x, e.y, e.direction, e.condition, e.parent, e.attachment, e.timestamp], [5, 10, 11, 0, 0, 0, 0, 123]);
  assert.deepEqual([e.bytes[48], e.bytes[49], e.bytes[53], e.bytes[54], e.bytes[55]], [0, 1, 1, 2, 0]);
  assert.deepEqual([e.bytes[23], e.bytes[38], e.bytes[43]], [0x55, 0x55, 0x55]);
});

test('planting on farms without the required equipment rents each missing type and releases rentals', () => {
  for (const id of [0, 1, 2, 7]) {
    const world = readScenario(source(`SCEN${id}.SSM`)), field = world.fields.find(f => f.active)!;
    // Start after seed validation, as in the owned-machinery integration case.
    field.bytes[2] = 3; field.bytes[3] = 0;
    const crop = readCrop('selected', source(`CROPS/${world.cropFiles[field.cropSlot].toUpperCase()}`)).rawDefinition;
    const runtime: EquipmentRuntime = { grassTravelCount: 0, animationTick: 0, notices: [] };
    const rentals: number[] = [], ownedCount = world.equipment.filter(e => e.active).length;
    let tick = 0;
    const allocate = (w: Scenario, type: number, x: number, y: number) => {
      const e = reserveEquipment(w, type, x, y, tick);
      if (e && (e.flags & 0x40)) rentals.push(type);
      return e;
    };
    for (; tick < 3000; tick++) {
      updateEquipment(world, runtime, tick, true, allocate);
      updatePlantingField(field, crop, world, runtime, tick, allocate);
      if (field.state === 4 && !world.equipment.some(e => e.active && (e.flags & 9))) break;
    }
    assert.ok(tick < 3000, `farm ${id}: stuck at step ${field.step}`);
    assert.deepEqual(rentals, id === 0 || id === 2 ? [1, 2] : [0, 1, 2]);
    assert.equal(world.equipment.filter(e => e.active).length, ownedCount);
    assert.equal(world.farm.rentalExpenses, id === 0 || id === 2 ? 200 : 400);
    assert.equal(world.farm.cash, 40000 - world.farm.rentalExpenses);
    assert.equal(field.state, 4);
  }
});
