import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { increaseAnimalNeeds, consumeAnimalSupply } from '../src/simulation/animal-needs';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup() {
  const b = source('SCEN4.SSM'), world = readScenario(b), finances = readFinancialState(b);
  for (const a of world.animals) a.flags = 0;
  for (const i of world.inventory) i.bytes[10] &= ~32;
  for (const c of world.cells) { c.terrain = 15; c.overlay = 0x800; }
  const a = world.animals[1]; a.flags = 32; a.bytes[0] = a.bytes[1] = 10; a.bytes[6] = 160; a.bytes[7] = 0;
  const cell = (x: number, y: number) => world.cells[worldIndex(x, y)];
  const supply = (slot: number, type: number, x: number, y: number, quantity: number) => {
    const item = world.inventory[slot], v = new DataView(item.bytes.buffer, item.bytes.byteOffset, item.bytes.byteLength);
    v.setUint16(0, type, true); v.setUint16(2, quantity, true); item.bytes[8] = x; item.bytes[9] = y; item.bytes[10] |= 32;
    finances.accounts.otherDefinitions[type - 288].count++;
    cell(x, y).terrain = type === 299 ? 175 : 0x80f; cell(x, y).overlay = 0x800 | (type === 299 ? 15 : 1020);
    return item;
  };
  return { world, finances, a, cell, supply };
}

test('need increments pin source tables, odd-day call and signed temperature boundaries with bounded sparse traversal', () => {
  const e = source('SIMFARM.EXE');
  assert.equal(e.subarray(0xd28b, 0xd290).toString('hex'), '9a1e13870f');
  assert.deepEqual([...e.subarray(0x86988, 0x86990)], [8, 8, 4, 2, 2, 2, 1, 1]);
  for (const temperature of [-128, 31, 32, 95, 96, 127]) {
    const { world } = setup(); world.animals[1].flags = 0;
    for (let type = 0; type < 4; type++) {
      const a = world.animals[252 + type]; a.flags = 32; a.bytes[6] = 160 + type; a.bytes[7] = 0;
      a.bytes[0] = a.bytes[1] = 0; a.bytes[8] = type + 3; a.bytes[13] = 250; a.bytes[14] = 254;
    }
    increaseAnimalNeeds(world, temperature);
    for (let type = 0; type < 4; type++) {
      const a = world.animals[252 + type]; assert.equal(a.bytes[13], [255, 255, 254, 252][type]); assert.equal(a.bytes[14], 255);
      assert.equal(a.bytes[8], temperature < 32 || temperature > 95 ? Math.max(0, type - 2) : type + 3);
    }
    const a = world.animals[255]; a.flags |= 4; const condition = a.bytes[8]; increaseAnimalNeeds(world, -128); assert.equal(a.bytes[8], condition);
  }
  const { world, a } = setup(); a.bytes[6] = 164;
  const before = world.animals.map(a => [...a.bytes]); assert.throws(() => increaseAnimalNeeds(world, 20), /Unsupported/);
  assert.deepEqual(world.animals.map(a => [...a.bytes]), before);
});

test('water consumption uses the first clamped5×5 supply, saturates quantity and retains empty trough records', () => {
  const { world, finances, a, cell, supply } = setup(); a.bytes[14] = 10;
  const first = supply(2, 299, 8, 12, 7), second = supply(1, 299, 9, 8, 100); const count = finances.accounts.otherDefinitions[11].count;
  cell(8, 12).terrain |= 0xf800;
  assert.equal(consumeAnimalSupply(world, finances, a, 'water', 0), true);
  assert.equal(first.quantity, 0); assert.equal(first.active, true); assert.equal(second.quantity, 100);
  assert.equal(cell(8, 12).terrain, 0xf800 | 174); assert.equal(finances.accounts.otherDefinitions[11].count, count);
  assert.equal(a.bytes[14], 10); // Reset belongs to the caller.
  assert.equal(consumeAnimalSupply(world, finances, a, 'water', 0), true); assert.equal(second.quantity, 90);
  a.bytes[0] = a.bytes[1] = 0; const edge = supply(3, 299, 0, 0, 50);
  assert.equal(consumeAnimalSupply(world, finances, a, 'water', 0), true); assert.equal(edge.quantity, 40);
});

test('feed depletion preserves source stage boundaries, flags and native definition/record cleanup', () => {
  for (const remaining of [0, 1, 101, 102, 205, 206, 307, 308, 409, 410, 512]) {
    const { world, finances, a, cell, supply } = setup(); a.bytes[13] = 8;
    const item = supply(1, 300, 10, 11, remaining + 8), count = finances.accounts.otherDefinitions[12].count;
    cell(10, 11).terrain |= 0xa000; cell(10, 11).overlay |= 0xa000; cell(10, 11).attribute = 12;
    const oldBytes = [...item.bytes]; assert.equal(consumeAnimalSupply(world, finances, a, 'feed', -1), true);
    assert.equal(item.quantity, remaining); assert.equal(item.active, remaining > 0);
    assert.equal(finances.accounts.otherDefinitions[12].count, count - Number(!remaining));
    const expected = remaining === 0 ? 17 : remaining < 102 ? 1024 : remaining < 206 ? 1023 : remaining < 308 ? 1022 : remaining < 410 ? 1021 : 1020;
    assert.equal(cell(10, 11).overlay, 0xa800 | expected); assert.equal(cell(10, 11).terrain, remaining ? 0xa80f : 0xa00f);
    for (const offset of [0, 1, 4, 5, 6, 7, 8, 9, 11]) assert.equal(item.bytes[offset], oldBytes[offset]);
  }
});

test('missing, empty and mismatched supplies do not satisfy needs, and invalid cleanup rejects before changing quantity', () => {
  const { world, finances, a, cell, supply } = setup(); a.bytes[13] = a.bytes[14] = 10;
  cell(10, 11).terrain = 175;
  assert.equal(consumeAnimalSupply(world, finances, a, 'water', 0), false); // SF-096 correction.
  const item = supply(1, 299, 10, 11, 0); assert.equal(consumeAnimalSupply(world, finances, a, 'water', 0), false);
  item.bytes[0] = 44; item.bytes[1] = 1; item.bytes[2] = 10; // Type300 behind water175 is inconsistent.
  assert.equal(consumeAnimalSupply(world, finances, a, 'water', 0), false);
  const feed = supply(2, 300, 11, 10, 8); finances.accounts.otherDefinitions[12].count = 0;
  const before = [...feed.bytes], terrain = { ...cell(11, 10) };
  assert.throws(() => consumeAnimalSupply(world, finances, a, 'feed', 0), /definition/);
  assert.deepEqual([...feed.bytes], before); assert.deepEqual(cell(11, 10), terrain);
});
