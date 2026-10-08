import type { Scenario } from '../src/formats/scenario';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Binary } from '../src/formats/binary';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { orderHarvest, updateHarvestField } from '../src/simulation/field-harvest';
import { creditHarvest } from '../src/simulation/harvest-income';
import { fieldHarvestValue, harvestLoss } from '../src/simulation/harvest-value';
import { updateEquipment } from '../src/simulation/equipment-dispatch';
import { reserveEquipment } from '../src/simulation/equipment-rental';
import { reserveHarvestStorage, deliverStoredHarvest } from '../src/simulation/harvest-storage';
import { FarmRandom } from '../src/simulation/random';
import type { EquipmentRuntime } from '../src/simulation/equipment-world';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id: number) {
  const world = readScenario(source(`SCEN${id}.SSM`)), field = world.fields.find(f => f.active)!;
  const crops = world.cropFiles.map(f => readCrop(f, source(`CROPS/${f.toUpperCase()}`)).rawDefinition), crop = crops[field.cropSlot];
  const runtime: EquipmentRuntime = { grassTravelCount: 0, animationTick: 0, notices: [] };
  const random = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
  // Mature, healthy test fixture; the source weather/growth path is separately tested.
  field.bytes[2] = 4; field.bytes[3] = 0; field.bytes[34] = crop[56];
  const f = new Binary(field.bytes);
  for (const offset of [18, 38, 40, 48]) f.view.setUint16(offset, 0, true);
  const steps = new Set<number>();
  const run = (until?: () => boolean) => {
    for (let tick = 1; tick < 5000; tick++) {
      runtime.animationTick = tick;
      if (tick % 256 === 0) world.farm.calendar.day = (world.farm.calendar.day + 1) % 7;
      const allocate = (w: Scenario, type: number, x: number, y: number) => reserveEquipment(w, type, x, y, tick);
      updateEquipment(world, runtime, tick, true, allocate);
      if (field.state === 5) steps.add(field.step);
      updateHarvestField(field, crop, world, runtime, tick, random, allocate);
      if (until?.() || (field.state !== 5 && !world.equipment.some(e => e.active && (e.flags & 11)))) return tick;
    }
    assert.fail(`farm ${id} stuck in ${field.state}/${field.step}`);
  };
  return { world, field, crop, crops, f, runtime, run, steps, random };
}

test('original machinery and worker harvests finish, store or sell and return equipment on all eight farms', () => {
  for (let id = 0; id < 8; id++) {
    const { world, field, crops, crop, f, run, steps, runtime } = setup(id);
    const value = fieldHarvestValue(field, crop, world.cropDefinitions[field.cropSlot].price), loss = harvestLoss(field, crop);
    const initialCash = world.farm.cash, initialSales = world.farm.salesAccumulator, rent = world.farm.rentalExpenses;
    const hasStorage = world.buildings.some(b => b.active && [64, 65].includes(b.type));
    assert.deepEqual(orderHarvest(world, field.slot, crops), { ok: true });
    assert.equal(field.step, crop[57] === 1 ? 10 : 0);
    run();
    assert.deepEqual([...steps], crop[57] === 1 ? [10, 11, 12, 13, 14, hasStorage ? 15 : 16] : [0, 1, 2, 3, 4, 5, hasStorage ? 6 : 7]);
    assert.equal(field.state, crop[62] & 1 ? 4 : 0);
    assert.equal(field.bytes[34], crop[62] & 1 ? crop[18] : 0);
    assert.equal(field.equipment, 0); assert.equal(field.pendingEquipment, 0); assert.equal(f.u16(46), 0);
    assert.equal(f.u16(18), 0); assert.equal(f.u16(38), 0); assert.equal(f.u16(40), 0);
    const items = world.inventory.filter(i => i.active && i.type === 168 + field.cropSlot);
    assert.equal(items.length, Number(hasStorage));
    if (hasStorage) { assert.equal(items[0].quantity, crop[32] | crop[33] << 8); assert.equal(items[0].loss, loss); }
    const workerFee = crop[57] === 1 ? f.u16(58) : 0;
    assert.equal(world.farm.cash, initialCash - (world.farm.rentalExpenses - rent) - workerFee + (hasStorage ? 0 : value));
    assert.equal(world.farm.workerExpenses, workerFee);
    assert.equal(world.farm.salesAccumulator, initialSales + (hasStorage ? 0 : value));
    assert.equal(runtime.notices.some(n => n.type === 'parking-unavailable'), false);
  }
});

test('harvest credit uses saved ledgers, caps cash and preserves uint32 accumulation', () => {
  const bytes = source('SCEN4.SSM');
  for (const [offset, value] of [[0x21690, 100], [0x2169c, 200], [0x216b0, 300], [0x21722, 400]]) bytes.writeUInt32LE(value, offset);
  const { farm } = readScenario(bytes);
  assert.deepEqual([farm.cropIncome, farm.contractGains, farm.contractLosses, farm.salesAccumulator], [100, 200, 300, 400]);
  const world = readScenario(bytes); world.farm.cash = 9_999_990; world.farm.cropIncome = 0xfffffff0;
  creditHarvest(world, 100);
  assert.equal(world.farm.cash, 9_999_999); assert.equal(world.farm.cropIncome, 84); assert.equal(world.farm.salesAccumulator, 500);
});

test('both harvest paths settle contracts once without creating stored inventory', () => {
  for (const id of [0, 4]) for (const price of [10, 1000]) {
    const { world, field, f, crops, crop, run } = setup(id);
    const market = fieldHarvestValue(field, crop, world.cropDefinitions[field.cropSlot].price);
    f.view.setUint16(48, price, true); world.cropDefinitions[field.cropSlot].count = 1;
    const value = fieldHarvestValue(field, crop, 0), gain = world.farm.contractGains, loss = world.farm.contractLosses;
    const income = world.farm.cropIncome;
    orderHarvest(world, field.slot, crops); run();
    assert.equal(world.cropDefinitions[field.cropSlot].count, 0); assert.equal(f.u16(48), 0);
    assert.equal(world.farm.cropIncome, income + value);
    assert.equal(world.farm.contractGains, gain + Math.max(0, value - market));
    assert.equal(world.farm.contractLosses, loss + Math.max(0, market - value));
    assert.equal(world.harvestDefinitions[field.cropSlot].count, 0);
  }
});

test('failed inventory delivery sells once and releases its reservation (SF-021/022)', () => {
  for (const id of [0, 4]) {
    const { world, field, crops, run, f } = setup(id);
    for (const item of world.inventory.slice(1, 256)) item.bytes[10] |= 32;
    const sales = world.farm.cropIncome;
    orderHarvest(world, field.slot, crops); run();
    assert.ok(world.farm.cropIncome > sales); assert.equal(world.harvestDefinitions[field.cropSlot].count, 0);
    assert.equal(f.u16(64), 0);
    assert.equal(world.buildings.some(b => b.active && Array.from({ length: 12 }, (_, i) => b.content(i).type).includes(-2)), false);
  }
});

test('worker harvest waits for funds and preserves original week-wrap duration (SF-024)', () => {
  const { world, field, crops, crop, f, runtime, random } = setup(0);
  world.farm.cash = 0; orderHarvest(world, field.slot, crops);
  updateHarvestField(field, crop, world, runtime, 0, random);
  assert.equal(field.step, 10); assert.equal(world.farm.workerExpenses, 0);
  world.farm.cash = f.u16(58); updateHarvestField(field, crop, world, runtime, 1, random);
  assert.equal(field.step, 11); assert.equal(world.farm.cash, 0);
  field.bytes[3] = 13; field.bytes[50] = 6; world.farm.calendar.day = 0;
  updateHarvestField(field, crop, world, runtime, 2, random);
  assert.equal(field.step, 14); // Original unsigned subtraction considers Sunday already past the delay.
});

test('truck return cannot modify unrelated equipment through the original stale index (SF-023)', () => {
  const { world, field, crops, crop, run, runtime, random } = setup(6);
  orderHarvest(world, field.slot, crops); run(() => field.step === 7);
  const truck = world.equipment[field.pendingEquipment]; truck.flags &= ~2;
  const unrelated = world.equipment.find(e => e.slot && e.type === 0)!;
  unrelated.bytes[42] = 7;
  const before = Uint8Array.from(unrelated.bytes);
  updateHarvestField(field, crop, world, runtime, 5000, random);
  assert.deepEqual(unrelated.bytes, before); assert.equal(field.state, 0);
});

test('worker sprites use the visual RNG and preserve the original unconditional overlay cleanup (SF-025)', () => {
  const { world, field, crop, runtime, random } = setup(0);
  const truck = reserveEquipment(world, 7, field.x, field.y, 0)!;
  truck.flags |= 8; truck.flags &= ~2;
  field.pendingEquipment = truck.slot; field.bytes[2] = 5; field.bytes[3] = 12;
  const occupied = world.cells[worldIndex(field.x, field.y)]; occupied.terrain |= 0x0800; occupied.overlay = 900;
  const before = random.snapshot();
  updateHarvestField(field, crop, world, runtime, 1, random);
  assert.equal(field.step, 13); assert.equal(random.snapshot().simulation, before.simulation);
  assert.notEqual(random.snapshot().visual, before.visual); assert.equal(occupied.overlay, 900);
  assert.ok(world.cells.some(c => (c.terrain & 0x0800) && (c.overlay & 0x7ff) >= 1036 && (c.overlay & 0x7ff) <= 1037));
  field.bytes[50] = 0; world.farm.calendar.day = 3;
  updateHarvestField(field, crop, world, runtime, 2, random);
  assert.equal(occupied.terrain & 0x0800, 0); assert.equal(field.step, 14);
});

test('failed concurrent deliveries release the same first reservation that successful delivery would fill', () => {
  const { world, field, crop, f, runtime, random } = setup(4);
  const first = reserveHarvestStorage(world, 61, 53)!, second = reserveHarvestStorage(world, 61, 53)!;
  assert.equal(first.buildingSlot, second.buildingSlot);
  assert.ok(deliverStoredHarvest(world, first.buildingSlot, field.cropSlot, 1, 0));
  const truck = reserveEquipment(world, 7, field.x, field.y, 0)!;
  truck.flags |= 8; truck.flags &= ~2;
  new Binary(truck.bytes).view.setUint16(34, 168 + field.cropSlot, true);
  field.bytes[2] = 5; field.bytes[3] = 6; field.pendingEquipment = truck.slot;
  f.view.setUint16(64, first.buildingSlot, true); field.bytes[66] = first.x; field.bytes[67] = first.y;
  for (const item of world.inventory.slice(1, 256)) item.bytes[10] |= 32;
  updateHarvestField(field, crop, world, runtime, 1, random);
  const b = world.buildings[first.buildingSlot];
  assert.notEqual(b.content(first.x * 3 + first.y).type, -1); // Completed delivery stays intact.
  assert.equal(b.content(second.x * 3 + second.y).type, -1); // Remaining reservation released.
});
