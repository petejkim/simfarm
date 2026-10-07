import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Binary } from '../src/formats/binary';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { checkFieldPlacement, createField } from '../src/simulation/field-placement';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function cleared(x = 0, y = 0) {
  const world = readScenario(source('SCEN4.SSM'));
  for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)]; cell.terrain = 15; cell.overlay = 0x0800;
  }
  return world;
}

test('saved automatic clearing setting and executable terrain category constants match source bytes', () => {
  const bytes = source('SCEN4.SSM'); bytes[0x21737] = 1;
  assert.equal(readScenario(bytes).farm.autoClear, true);
  bytes[0x21737] = 0; assert.equal(readScenario(bytes).farm.autoClear, false);
  const exe = new Binary(source('SIMFARM.EXE'));
  for (const [offset, lengthOffset, base, count] of [[0x85e, 0x99e, 15, 16], [0x980, 0xa2f, 535, 4],
    [0x8fa, 0x9ec, 177, 11], [0x868, 0x9a3, 161, 11], [0x866, 0x9a2, 150, 11],
    [0x904, 0x9f1, 87, 11], [0x906, 0x9f2, 98, 11], [0x8ce, 0x9d6, 122, 4], [0x8da, 0x9dc, 131, 16]]) {
    assert.equal(exe.u16(0x4ec60 + offset), base); assert.equal(exe.bytes[0x4ec60 + lengthOffset], count);
  }
});

test('placement requires ownership, exact terrain categories and no overlay obstruction in every field cell', () => {
  const world = cleared(), slot = 9;
  assert.deepEqual(checkFieldPlacement(world, 0, 0), { ok: true, slot });
  const last = world.cells[worldIndex(7, 7)];
  last.overlay = 0; assert.deepEqual(checkFieldPlacement(world, 0, 0), { ok: false, reason: 'not-owned' });
  last.overlay = 0x0800;
  for (let tile = 0; tile < 848; tile++) {
    last.terrain = tile;
    assert.equal(checkFieldPlacement(world, 0, 0).ok, tile >= 15 && tile < 31, `normal ${tile}`);
  }
  world.farm.autoClear = true;
  const ranges = [[15, 30], [535, 538], [177, 187], [150, 171], [87, 108], [122, 125], [131, 146]];
  for (let tile = 0; tile < 848; tile++) {
    last.terrain = tile;
    assert.equal(checkFieldPlacement(world, 0, 0).ok, ranges.some(([a, b]) => tile >= a && tile <= b), `clear ${tile}`);
  }
  last.terrain = 0x0800 | 15; assert.deepEqual(checkFieldPlacement(world, 0, 0), { ok: false, reason: 'blocked-terrain' });
});

test('field spacing includes a clamped one-tile border; native bounds reject crossing the map', () => {
  const world = cleared(88, 88);
  assert.equal(checkFieldPlacement(world, 88, 88).ok, true);
  for (const [x, y] of [[-1, 0], [89, 0], [0, 89], [0, 0.5], [NaN, 0], [Infinity, 0]]) {
    assert.deepEqual(checkFieldPlacement(world, x, y), { ok: false, reason: 'outside-map' });
  }
  world.cells[worldIndex(87, 87)].overlay |= 0x1000;
  assert.deepEqual(checkFieldPlacement(world, 88, 88), { ok: false, reason: 'field-too-close' });
  world.cells[worldIndex(87, 87)].overlay &= ~0x1000;
  world.cells[worldIndex(86, 87)].overlay |= 0x1000;
  assert.equal(checkFieldPlacement(world, 88, 88).ok, true);
});

test('constructor initializes recovered members, samples the center region, paints the field and retains other bytes', () => {
  const world = cleared(0, 0), field = world.fields[9]; field.bytes.fill(0xab); field.bytes[7] = 0;
  const before = Uint8Array.from(field.bytes), region = world.regionalConditions;
  region[2] = 12; region[3] = 34; region[4] = 56; region[6] = 78;
  const cash = world.farm.cash;
  assert.deepEqual(createField(world, 0, 0), { ok: true, slot: 9 });
  assert.equal(world.farm.cash, cash);
  assert.equal(field.number, 9); assert.equal(field.state, 0); assert.equal(field.step, 0);
  assert.equal(field.x, 0); assert.equal(field.y, 0); assert.equal(field.width, 8); assert.equal(field.height, 8);
  const expected = Uint8Array.from(before), b = new Binary(expected);
  for (const off of [42, 6, 18, 36, 38, 48, 54, 64]) b.view.setUint16(off, 0, true);
  b.view.setUint16(0, 9, true); b.view.setUint16(8, 384, true); b.view.setUint16(58, 500, true);
  for (const off of [2, 3, 4, 5, 14, 32, 33, 34, 51, 52, 56, 57, 60, 61, 62]) expected[off] = 0;
  expected[7] = 1; expected[10] = expected[11] = 0; expected[12] = expected[13] = 8;
  expected[28] = expected[29] = 78; expected[30] = 65; expected[31] = 80;
  expected[20] = 12; expected[21] = 56; expected[22] = 34; expected[66] = expected[67] = 255;
  assert.deepEqual(field.bytes, expected);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    assert.equal(world.cells[worldIndex(x, y)].terrain, 36); assert.equal(world.cells[worldIndex(x, y)].overlay, 0x1800);
  }
  assert.equal(checkFieldPlacement(world, 8, 0).ok, false);
});

test('exhausted field slots and failed placement leave every field/map byte unchanged', () => {
  const world = cleared();
  for (const field of world.fields.slice(1)) field.bytes[7] |= 1;
  const before = JSON.stringify(world);
  assert.deepEqual(createField(world, 0, 0), { ok: false, reason: 'no-field-slots' });
  assert.equal(JSON.stringify(world), before);
  assert.equal(createField(world, 96, 0).ok, false); assert.equal(JSON.stringify(world), before);
});

test('all supplied farms need additional clearing or land purchase before another 8×8 field fits', () => {
  for (let id = 0; id < 8; id++) {
    const world = readScenario(source(`SCEN${id}.SSM`));
    for (const autoClear of [false, true]) {
      world.farm.autoClear = autoClear;
      for (let x = 0; x <= 88; x++) for (let y = 0; y <= 88; y++) assert.equal(checkFieldPlacement(world, x, y).ok, false);
    }
  }
});
