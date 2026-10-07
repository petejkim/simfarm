import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { EquipmentRecord } from '../src/formats/equipment';
import { FieldRecord } from '../src/formats/field';
import { attachEquipment, setEquipmentDestination } from '../src/simulation/equipment';
import { drawEquipment, equipmentFootprint, equipmentObstructed, eraseEquipment, moveEquipment,
  refreshEquipment, traverseEquipmentField, wearEquipment, type EquipmentRuntime } from '../src/simulation/equipment-world';

const source = (id: number) => readFileSync(new URL(`../../simfarm-dos/SCEN${id}.SSM`, import.meta.url));
const runtime = (): EquipmentRuntime => ({ grassTravelCount: 0, animationTick: 1234, notices: [] });
function setup(tile = 150) {
  const world = readScenario(source(4));
  world.equipment.forEach(e => e.bytes.fill(0));
  world.cells.forEach(c => { c.terrain = tile; c.overlay = 0; c.attribute = 0; });
  return world;
}
function activate(e: EquipmentRecord, type = 0, x = 20, y = 20) {
  e.bytes.fill(0); e.bytes[0] = type; e.flags = 0x20;
  e.bytes[5] = x; e.bytes[6] = y; e.bytes[53] = 1; e.bytes[54] = type === 5 || type === 7 ? 2 : 1;
  return e;
}

test('animal records match all saved counts and retain unmodified source bytes', () => {
  const counts = [4, 0, 0, 10, 0, 57, 18, 9];
  for (let i = 0; i < 8; i++) {
    const bytes = source(i), original = Uint8Array.from(bytes), world = readScenario(bytes);
    assert.equal(world.animals.length, 256);
    assert.equal(world.animals.filter(a => a.active).length, counts[i]);
    world.animals[1].bytes.fill(0); assert.deepEqual(Uint8Array.from(bytes), original);
  }
  const bad = source(0); bad.writeUInt16LE(256, 1);
  assert.throws(() => readScenario(bad), /animal count/);
});

test('erase/redraw of original saved trucks exactly restores both world words', () => {
  const world = readScenario(source(4));
  const before = world.cells.map(c => ({ ...c }));
  for (const slot of [25, 26, 27, 28]) {
    const e = world.equipment[slot];
    assert.equal(e.flags, 0xa0);
    eraseEquipment(e, world);
    assert.equal(world.cells[worldIndex(e.x, e.y)].terrain & 0x800, 0);
    assert.equal(world.cells[worldIndex(e.x, e.y)].overlay & 0x7ff, 0);
    refreshEquipment(e, world, runtime());
    assert.equal(e.flags, 0xa0);
  }
  assert.deepEqual(world.cells, before);
});

test('equipment overlay layout uses direction, frame and column-major quadrants', () => {
  const world = setup(), e = activate(world.equipment[1], 7);
  e.bytes[15] = 2; e.bytes[42] = 1; e.flags |= 0x80;
  assert.deepEqual(equipmentFootprint(e, world), { width: 2, height: 1 });
  for (const x of [20, 21]) { const cell = world.cells[worldIndex(x, 20)]; cell.terrain |= 0xc000; cell.overlay = 0xb000; }
  drawEquipment(e, world);
  // base 896 + 2 tiles * (2 frames * east quadrant 1 + frame 1).
  assert.deepEqual([world.cells[worldIndex(20, 20)].overlay, world.cells[worldIndex(21, 20)].overlay], [0xb000 | 902, 0xb000 | 903]);
  eraseEquipment(e, world);
  assert.deepEqual(world.cells[worldIndex(20, 20)], { terrain: 0xc000 | 150, overlay: 0xb000, attribute: 0 });
});

test('movement updates actual overlays and attachment positions through arrival', () => {
  const world = setup(), r = runtime(), e = activate(world.equipment[1]), trailer = activate(world.equipment[2], 5);
  e.bytes[15] = 2; attachEquipment(e, trailer, world.equipmentDefinitions);
  refreshEquipment(e, world, r);
  setEquipmentDestination(e, 30, 20, 100);
  for (let i = 1; i <= 10; i++) {
    assert.equal(moveEquipment(e, world, r), i < 10);
    assert.deepEqual([e.x, e.y, trailer.x, trailer.y], [20 + i, 20, 18 + i, 20]);
    assert.equal(world.cells[worldIndex(e.x, e.y)].overlay & 0x7ff, 849);
    assert.equal(world.cells[worldIndex(trailer.x, trailer.y)].overlay & 0x7ff, 880);
  }
  // Timer and moving flag are owned by the dispatcher above the movement routine.
  assert.equal(e.timestamp, 100); assert.ok(e.flags & 2); assert.equal(e.bytes[55], 0);
  eraseEquipment(e, world);
  assert.ok(world.cells.every(c => c.terrain === 150 && c.overlay === 0));
});

test('wear uses the shared eleventh-grass-step counter, saved age and type-six exemption', () => {
  const world = setup(15), r = runtime();
  const first = activate(world.equipment[1], 0, 10, 10), second = activate(world.equipment[2], 6, 10, 30);
  const trailer = activate(world.equipment[3], 5, 9, 30);
  first.bytes[18] = 8; second.bytes[18] = 8; trailer.bytes[18] = 8;
  second.bytes[15] = 2; attachEquipment(second, trailer, world.equipmentDefinitions);
  setEquipmentDestination(first, 50, 10, 0); setEquipmentDestination(second, 50, 30, 0);
  for (let i = 0; i < 10; i++) moveEquipment(first, world, r);
  assert.equal(first.condition, 0); assert.equal(r.grassTravelCount, 10);
  moveEquipment(second, world, r);
  assert.equal(second.condition, 0); assert.equal(trailer.condition, 4);
  assert.deepEqual(r.notices, [{ type: 'grass-wear', slot: 2 }]);
  first.bytes[17] = 254; wearEquipment(first, 2); assert.equal(first.condition, 255);
});

test('original 64-update fallback forces arrival and adds wear even while making progress', () => {
  const world = setup(), r = runtime(), e = activate(world.equipment[1], 0, 0, 0);
  e.bytes[18] = 12; setEquipmentDestination(e, 95, 95, 0);
  for (let i = 0; i < 63; i++) assert.equal(moveEquipment(e, world, r), true);
  assert.equal(moveEquipment(e, world, r), false);
  assert.deepEqual([e.x, e.y, e.bytes[55], e.condition], [95, 95, 0, 13]);
  assert.deepEqual(r.notices, [{ type: 'forced-arrival', slot: 1 }]);
  eraseEquipment(e, world); assert.ok(world.cells.every(c => !(c.terrain & 0x800)));
});

test('occupancy can hide a moving machine and applies original livestock collision aftermath once', () => {
  const world = setup(), r = runtime(), e = activate(world.equipment[1]);
  const animal = world.animals[1]; animal.bytes[0] = 20; animal.bytes[1] = 20; animal.flags = 0x22;
  const cell = world.cells[worldIndex(20, 20)]; cell.terrain |= 0x800; cell.overlay = 0x1000 | 980;
  refreshEquipment(e, world, r);
  assert.equal(e.flags & 0x80, 0); assert.equal(animal.flags, 0x28);
  assert.equal(cell.overlay, 0x1000 | 1040);
  assert.deepEqual([...animal.bytes.subarray(30, 32)], [210, 4]);
  assert.equal(equipmentObstructed(e, world, r), true);
  assert.deepEqual(r.notices, [{ type: 'animal-hit', slot: 1 }]);
  cell.terrain = 36; cell.overlay = 0;
  assert.equal(equipmentObstructed(e, world, r), true);
  cell.overlay = 0x1000; assert.equal(equipmentObstructed(e, world, r), false);
  // Rendering/occupancy accepts tile 173 even though route scoring rejects it.
  cell.overlay = 0; cell.terrain = 173; assert.equal(equipmentObstructed(e, world, r), false);
});

test('field traversal completes the original serpentine pass, preserving badges, borders and terrain flags', () => {
  const world = setup(15), r = runtime(), e = activate(world.equipment[1], 0, 10, 10);
  const field = new FieldRecord(1, new Uint8Array(68));
  field.bytes[7] = 1; field.bytes.set([10, 10, 8, 8], 10);
  e.bytes[15] = 2; e.bytes[48] = 1; e.bytes[49] = 1;
  const trailer = activate(world.equipment[2], 1); attachEquipment(e, trailer, world.equipmentDefinitions);
  for (let x = 10; x < 18; x++) for (let y = 10; y < 18; y++) {
    world.cells[worldIndex(x, y)].terrain = 0x4000 | 36;
    world.cells[worldIndex(x, y)].overlay = 0x1000;
  }
  world.cells[worldIndex(12, 10)].terrain = 0x4000 | 539;
  let steps = 0, finished = false;
  while (!finished && steps < 100) { finished = traverseEquipmentField(e, field, 12, world, r); steps++; }
  assert.equal(finished, true); assert.equal(steps, 72);
  eraseEquipment(e, world);
  for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
    const inField = x >= 10 && x < 18 && y >= 10 && y < 18;
    const expected = inField ? 0x4000 | (x === 12 && y === 10 ? 539 : 12) : 15;
    assert.equal(world.cells[worldIndex(x, y)].terrain, expected, `${x},${y}`);
  }
});

test('byte-wrapped attachments and field border traversal never address outside the native map', () => {
  const world = setup(15), r = runtime(), e = activate(world.equipment[1], 0, 0, 10);
  e.bytes[15] = 2; e.bytes[48] = 1; e.bytes[49] = 1;
  const trailer = activate(world.equipment[2], 1); attachEquipment(e, trailer, world.equipmentDefinitions);
  assert.equal(trailer.x, 255); assert.equal(equipmentObstructed(e, world, r), true);
  const field = new FieldRecord(1, new Uint8Array(68)); field.bytes[7] = 1; field.bytes.set([0, 10, 8, 8], 10);
  let done = false;
  for (let i = 0; i < 100 && !done; i++) done = traverseEquipmentField(e, field, -1, world, r);
  assert.equal(done, true); assert.equal(world.cells.length, 9216);
});
