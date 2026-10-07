import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex, terrainTile } from '../src/formats/scenario';
import { readAssetSaleState } from '../src/formats/asset-sale';
import { readOtherGoodsDefinitions } from '../src/formats/inventory';
import { demolishBuilding } from '../src/simulation/building-demolition';
import { createClearingEffects, updateClearingEffects } from '../src/simulation/clearing-effects';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 4) => {
  const bytes = source(`SCEN${id}.SSM`);
  return { world: readScenario(bytes), state: { assets: readAssetSaleState(bytes), buildingBookValue: 100000,
    otherDefinitions: readOtherGoodsDefinitions(bytes) }, effects: createClearingEffects() };
};
const put = (b: Uint8Array, o: number, n: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);

test('demolition calls, record flags, signed building ledger and additional definitions match source bytes', () => {
  const exe = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(exe.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x19fe2, '2683bf2284ff'); exact(0x1a005, '9aaa10e624'); exact(0x1a07a, '2680a72504f7');
  exact(0x1a086, '9a961d3606'); exact(0x3a0e3, '99'); exact(0x3a0e8, '262906543e');
  exact(0x3a0f5, '9a0c00d417'); exact(0x3caa1, '9a2a00d417'); exact(0x3cab9, '9aaa10e624');
  exact(0x4599f, '05c473'); exact(0x459b1, '837ef011'); exact(0x3a1fb, '833ea07400'); exact(0x3a22d, '833e8e7400');
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), defs = readOtherGoodsDefinitions(bytes);
    assert.equal(defs.length, 17);
    defs.forEach((d, i) => { assert.equal(d.type, 288 + i); assert.deepEqual(d.bytes, Uint8Array.from(bytes.subarray(0x20fa0 + i * 18, 0x20fb2 + i * 18))); });
    defs[0].bytes[17] ^= 255; assert.notEqual(defs[0].bytes[17], bytes[0x20fb1]);
  }
  assert.throws(() => readOtherGoodsDefinitions(source('SCEN4.SSM').subarray(0, 0x210d1)));
  const broken = source('SCEN4.SSM'); broken[0x20fa2] = 0; assert.throws(() => readOtherGoodsDefinitions(broken));
});

test('every supplied building demolishes its stored assets once, preserves inactive records and never pays sale proceeds', () => {
  for (let id = 0; id < 8; id++) for (const original of setup(id).world.buildings.filter(b => b.active)) {
    const { world, state, effects } = setup(id), b = world.buildings[original.slot], d = world.buildingDefinitions[b.type - 64];
    const record = Uint8Array.from(b.bytes), regions = Uint8Array.from(world.regionalConditions), cells = world.cells.map(c => ({ ...c }));
    const farm = { ...world.farm }, sourceBefore = Uint8Array.from(world.sourceBytes), count = d.count, ledger = state.buildingBookValue;
    const equipment = new Set<number>(), animals = new Set<number>(), goods = new Set<number>(), chemicals = new Set<number>();
    for (let x = 0; x < d.width; x++) for (let y = 0; y < d.height; y++) {
      const c = b.content(x * 3 + y);
      if (c.type >= 0 && c.type <= 8) equipment.add(c.slot);
      else if (c.type >= 160 && c.type <= 164) animals.add(c.slot);
      else if (c.type >= 192 && c.type < 208) goods.add(c.slot);
      else if (c.type >= 220 && c.type <= 223) chemicals.add(c.slot);
    }
    const oldMachines = world.equipment.map(e => Uint8Array.from(e.bytes));
    const oldInventory = world.inventory.map(i => Uint8Array.from(i.bytes));
    const equipmentValue = [...equipment].reduce((sum, slot) => sum + ((world.equipment[slot].flags & 0x40) ? 0 : world.equipmentDefinitions[world.equipment[slot].type].price), 0);
    const oldEquipmentValue = state.assets.equipmentBookValue;
    assert.equal(demolishBuilding(world, state, b.slot, effects, 8), true, `SCEN${id} building ${b.slot}`);
    assert.equal(d.count, count - 1); assert.equal(state.buildingBookValue, (ledger - (d.price << 16 >> 16)) >>> 0);
    assert.equal(state.assets.equipmentBookValue, (oldEquipmentValue - equipmentValue) >>> 0);
    record[2] &= ~32;
    if (!animals.size) assert.deepEqual(b.bytes, record);
    for (const e of world.equipment) { if (equipment.has(e.slot)) oldMachines[e.slot][2] &= ~32; assert.deepEqual(e.bytes, oldMachines[e.slot]); }
    for (const i of world.inventory) { if (goods.has(i.slot)) oldInventory[i.slot][10] &= ~32; assert.deepEqual(i.bytes, oldInventory[i.slot]); }
    for (const slot of animals) assert.equal(world.animals[slot].active, false);
    for (const slot of chemicals) assert.equal(world.chemicals[slot].active, false);
    for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
      const index = worldIndex(x, y), c = world.cells[index];
      if (x >= b.x && x < b.x + d.width && y >= b.y && y < b.y + d.height) {
        assert.equal(terrainTile(c), 664); assert.equal(c.terrain & 0x800, 0); assert.equal(c.attribute, cells[index].attribute);
      } else assert.deepEqual(c, cells[index]);
    }
    assert.deepEqual(world.farm, farm); assert.deepEqual(world.regionalConditions, regions); assert.deepEqual(world.sourceBytes, sourceBefore);
    assert.equal(demolishBuilding(world, state, b.slot, effects, 8), false);
  }
});

function emptyBuilding() {
  const data = setup(), { world } = data, b = world.buildings[1];
  for (const other of world.buildings) other.flags &= ~32;
  put(b.bytes, 0, 69); b.flags = 0x21; b.bytes[4] = b.bytes[5] = 40;
  for (let i = 0; i < 12; i++) b.clearContent(i);
  const definition = world.buildingDefinitions[5]; definition.count = 1;
  return { ...data, b, definition };
}

test('mixed stored equipment, livestock, crops, seeds, chemicals and types 299/300 are destroyed without credit', () => {
  const { world, state, effects, b, definition } = emptyBuilding();
  const machine = world.equipment[1]; machine.bytes.fill(0); machine.flags = 0xa5; machine.bytes[5] = machine.bytes[6] = 40;
  world.equipmentDefinitions[0].ownedCount = 1;
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) b.setContent(x * 3 + y, 848 + x * 2 + y, 0, 1);
  const animal = world.animals[1]; animal.bytes.fill(0); animal.flags = 0x24; animal.bytes[0] = 41; animal.bytes[1] = 42;
  put(animal.bytes, 6, 161); put(animal.bytes, 16, b.slot); state.assets.animalDefinitions[1].count = 1;
  b.setContent(5, 970, 161, 1);
  for (const [slot, type, x, y] of [[1, 168, 42, 40], [2, 192, 42, 41], [3, 299, 42, 42], [4, 300, 43, 40]]) {
    const i = world.inventory[slot]; i.bytes.fill(0); put(i.bytes, 0, type); i.bytes[8] = x; i.bytes[9] = y; i.bytes[10] = 0x61;
    b.setContent((x - 40) * 3 + y - 40, 400, type, slot);
  }
  world.harvestDefinitions[0].count = world.seedDefinitions[0].count = state.otherDefinitions[11].count = state.otherDefinitions[12].count = 1;
  const chemical = world.chemicals[1]; chemical.bytes.fill(0); put(chemical.bytes, 0, 220); chemical.bytes[2] = 0x21;
  chemical.bytes[5] = 43; chemical.bytes[6] = 41; world.chemicalDefinitions[0].count = 1; b.setContent(10, 535, 220, 1);
  b.setContent(11, 123, -2, 0); // Occupancy sentinel is retained, not used as an array index.
  const old = Uint8Array.from(b.bytes), cash = world.farm.cash, equipmentLedger = state.assets.equipmentBookValue;
  assert.equal(demolishBuilding(world, state, b.slot, effects, 8), true);
  assert.equal(world.farm.cash, cash); assert.equal(machine.active, false); assert.equal(animal.active, false); assert.equal(chemical.active, false);
  for (let slot = 1; slot <= 4; slot++) assert.equal(world.inventory[slot].bytes[10], 0x41);
  for (const d of [world.harvestDefinitions[0], world.seedDefinitions[0], state.otherDefinitions[11], state.otherDefinitions[12], world.chemicalDefinitions[0], state.assets.animalDefinitions[1]]) assert.equal(d.count, 0);
  assert.equal(world.equipmentDefinitions[0].ownedCount, 0); assert.equal(definition.count, 0);
  assert.equal(state.assets.equipmentBookValue, (equipmentLedger - world.equipmentDefinitions[0].price) >>> 0);
  old[2] &= ~32; put(old, 10 + 5 * 2, 217); put(old, 34 + 5 * 2, 65535); old[58 + 5] = 0;
  assert.deepEqual(b.bytes, old); // Only stored-animal deletion clears content, other stale entries survive inactive.
  assert.equal(effects.count, 12);
  for (let tick = 16; tick <= 192; tick += 16) updateClearingEffects(world, effects, 8, tick);
  assert.equal(effects.count, 0);
});

test('signed building-price subtraction, dword wrap and rental equipment bookkeeping retain source arithmetic', () => {
  for (const price of [0, 32767, 32768, 65535]) for (const book of [0, 0xffffffff]) {
    const { world, state, effects, b, definition } = emptyBuilding();
    put(definition.bytes, 6, price); state.buildingBookValue = book;
    demolishBuilding(world, state, b.slot, effects, 8);
    assert.equal(state.buildingBookValue, (book - (price << 16 >> 16)) >>> 0);
  }
  const { world, state, effects, b } = emptyBuilding(), e = world.equipment[1];
  e.bytes.fill(0); e.flags = 0x65; e.bytes[5] = e.bytes[6] = 40;
  b.setContent(0, 848, 0, e.slot); world.equipmentDefinitions[0].ownedCount = 2;
  const ledger = state.assets.equipmentBookValue;
  demolishBuilding(world, state, b.slot, effects, 8);
  assert.equal(e.active, false); assert.equal(world.equipmentDefinitions[0].ownedCount, 2); assert.equal(state.assets.equipmentBookValue, ledger);
});

test('count-only goods and plane-home side effects use generic destruction rather than sale eligibility', () => {
  const { world, state, effects, b } = emptyBuilding();
  b.setContent(0, 15, 128, 0); b.setContent(1, 15, 291, 0);
  world.cropDefinitions[0].count = 1; state.otherDefinitions[3].count = 1;
  const e = world.equipment[1]; e.bytes.fill(0); put(e.bytes, 0, 8); e.flags = 0x29; // Reserved/working does not block destruction.
  e.bytes[5] = 41; e.bytes[6] = 40; e.bytes[50] = 3; e.bytes[51] = 10;
  world.equipmentDefinitions[8].ownedCount = 1; world.regionalConditions[7] = 0xe5;
  b.setContent(3, 860, 8, e.slot);
  demolishBuilding(world, state, b.slot, effects, 8);
  assert.equal(e.flags, 9); assert.equal(world.cropDefinitions[0].count, 0); assert.equal(state.otherDefinitions[3].count, 0);
  assert.equal(world.regionalConditions[7], 0xc5);
  for (let x = 3; x < 5; x++) for (let y = 10; y < 12; y++) assert.equal(terrainTile(world.cells[worldIndex(x, y)]), 23);
});

test('invalid counts, cross-references, bounds and external attachments reject demolition before mutation', () => {
  const cases = [
    (d: ReturnType<typeof emptyBuilding>) => { d.definition.count = 0; },
    (d: ReturnType<typeof emptyBuilding>) => { d.b.bytes[4] = 95; },
    (d: ReturnType<typeof emptyBuilding>) => { d.state.buildingBookValue = -1; },
    (d: ReturnType<typeof emptyBuilding>) => { d.effects.x[1] = 96; },
    (d: ReturnType<typeof emptyBuilding>) => { d.b.setContent(0, 0, 63, 1); },
    (d: ReturnType<typeof emptyBuilding>) => { d.b.setContent(0, 0, 192, 255); },
    (d: ReturnType<typeof emptyBuilding>) => {
      const e = d.world.equipment[1]; e.bytes.fill(0); e.flags = 32; e.bytes[5] = e.bytes[6] = 40;
      d.b.setContent(0, 848, 0, 1); d.world.equipmentDefinitions[0].ownedCount = 1;
      d.world.equipment[2].flags |= 32; d.world.equipment[2].attachment = 1;
    },
    (d: ReturnType<typeof emptyBuilding>) => {
      for (let slot = 1; slot <= 2; slot++) {
        const item = d.world.inventory[slot]; item.bytes.fill(0); put(item.bytes, 0, 192);
        item.bytes[8] = 40; item.bytes[9] = 39 + slot; item.bytes[10] = 32; d.b.setContent(slot - 1, 0, 192, slot);
      }
      d.world.seedDefinitions[0].count = 1; // Aggregate check catches the second item before deleting the first.
    },
  ];
  for (const corrupt of cases) {
    const data = emptyBuilding(); corrupt(data); const before = JSON.stringify(data);
    assert.throws(() => demolishBuilding(data.world, data.state, data.b.slot, data.effects, 8));
    assert.equal(JSON.stringify(data), before);
  }
  const { world, state, effects } = emptyBuilding();
  for (const slot of [0, -1, NaN, 127]) assert.equal(demolishBuilding(world, state, slot, effects, 8), false);
});
