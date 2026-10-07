import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { CHEMICAL_RECORDS_OFFSET as START, readChemicals } from '../src/formats/chemical';
import { consumeChemical } from '../src/simulation/chemicals';
import { findBuilding } from '../src/simulation/building-storage';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const farm = (id = 0) => readScenario(source(`SCEN${id}.SSM`));

test('chemical records, definitions and expense ledger decode original bytes on every farm', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes);
    assert.equal(world.chemicals.length, 127);
    assert.equal(world.chemicals.filter(c => c.active).length, id === 0 ? 63 : 0);
    for (const item of world.chemicals) assert.deepEqual([...item.bytes], [...bytes.subarray(START + item.slot * 20, START + (item.slot + 1) * 20)]);
    for (let i = 0; i < 4; i++) {
      const d = world.chemicalDefinitions[i];
      assert.equal(d.type, 220 + i); assert.equal(d.price, 200);
      assert.equal(d.count, world.chemicals.filter(c => c.active && c.type === d.type).length);
    }
    bytes.writeUInt32LE(0xfedcba98, 0x216bc);
    assert.equal(readScenario(bytes).farm.chemicalExpenses, 0xfedcba98);
    bytes[START + 20] = 0;
    assert.equal(world.chemicals[1].type, id === 0 ? 220 : 0); // Detached source bytes.
  }
});

test('chemical decoder rejects invalid counts, slot zero, types and positions at binary boundaries', () => {
  for (const [offset, value] of [[START - 2, 0], [START + 2, 32], [START + 20, 219], [START + 25, 96], [START + 26, 255]]) {
    const bytes = source('SCEN0.SSM'); bytes[offset] = value;
    assert.throws(() => readChemicals(bytes), /Invalid chemical/);
  }
});

test('all 63 original stored supplies are consumed once, freed from storage, with unknown bytes preserved', () => {
  const world = farm(), cash = world.farm.cash;
  world.farm.autoBuySeeds = false;
  for (const item of world.chemicals.filter(c => c.active)) {
    const before = Uint8Array.from(item.bytes), building = findBuilding(world, item.x, item.y)!;
    const index = (item.x - building.x) * 3 + item.y - building.y;
    assert.deepEqual(consumeChemical(world, item.type, 8), { ok: true, source: 'stored', cost: 0 });
    before[2] &= ~32; assert.deepEqual(item.bytes, before);
    assert.deepEqual(building.content(index), { graphic: 217, type: -1, slot: 0 });
  }
  assert.equal(world.farm.cash, cash); assert.equal(world.chemicals.some(c => c.active), false);
  for (const type of [220, 221, 222, 223]) {
    assert.equal(world.chemicalDefinitions[type - 220].count, 0);
    assert.deepEqual(consumeChemical(world, type, 8), { ok: false, reason: 'no-supplies' });
  }
});

test('automatic supply buying uses the shared saved flag and fixed cost with exact funds and ledger wrap', () => {
  const world = farm(4);
  world.farm.autoBuySeeds = false;
  assert.equal(consumeChemical(world, 220, 8).ok, false);
  world.farm.autoBuySeeds = true;
  for (const type of [220, 221, 222, 223]) {
    world.chemicalDefinitions[type - 220].price = 9999; // This routine does not consult the price table.
    world.farm.cash = 274;
    const before = JSON.stringify(world);
    assert.deepEqual(consumeChemical(world, type, 8), { ok: false, reason: 'insufficient-funds' });
    assert.equal(JSON.stringify(world), before);
    world.farm.cash = 275; world.farm.chemicalExpenses = 0xfffffff0;
    assert.deepEqual(consumeChemical(world, type, 8), { ok: true, source: 'purchased', cost: 275 });
    assert.equal(world.farm.cash, 0); assert.equal(world.farm.chemicalExpenses, 259);
  }
});

test('inconsistent chemical stock cannot create repeat free treatments (SF-030)', () => {
  for (const corruption of ['count', 'storage', 'position']) {
    const world = farm(), item = world.chemicals[1];
    if (corruption === 'count') world.chemicalDefinitions[0].count = 0;
    if (corruption === 'storage') findBuilding(world, item.x, item.y)!.clearContent(0);
    if (corruption === 'position') item.bytes[5] = 255;
    const before = JSON.stringify(world);
    assert.deepEqual(consumeChemical(world, 220, 8), { ok: false, reason: 'inconsistent-stock' });
    assert.equal(JSON.stringify(world), before);
  }
  const world = farm(), item = world.chemicals[1];
  item.bytes[5] = item.bytes[6] = 0;
  const cell = world.cells[worldIndex(0, 0)]; cell.terrain = 0xf800 | 800; cell.attribute = 12; cell.overlay = 0xabcd;
  consumeChemical(world, 220, 2);
  assert.equal(cell.terrain, 20); assert.equal(cell.overlay, 0xabcd);
});
