import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { findBuilding, reserveOwnedEquipment, toggleBuildingInterior, withdrawStoredEquipment } from '../src/simulation/building-storage';
import { attachEquipment, positionEquipmentAttachments, setEquipmentDestination } from '../src/simulation/equipment';
import { equipmentFootprint, eraseEquipment, moveEquipment, traverseEquipmentField, type EquipmentRuntime } from '../src/simulation/equipment-world';

const source = (id: number) => readFileSync(new URL(`../../simfarm-dos/SCEN${id}.SSM`, import.meta.url));

test('building records and nine definitions preserve all eight original saves independently', () => {
  for (let i = 0; i < 8; i++) {
    const bytes = source(i), before = Uint8Array.from(bytes), world = readScenario(bytes);
    assert.equal(world.buildings.length, 127);
    assert.equal(world.buildings.filter(b => b.active).length, bytes.readUInt16LE(0x5fc5));
    assert.deepEqual(world.buildingDefinitions.map(d => [d.type, d.width, d.height]),
      [[64, 1, 1], [65, 2, 2], [66, 3, 2], [67, 3, 3], [68, 3, 3], [69, 4, 3], [70, 1, 1], [71, 2, 2], [72, 1, 1]]);
    world.buildings[1].bytes.fill(0); world.buildingDefinitions[0].bytes.fill(0);
    assert.deepEqual(Uint8Array.from(bytes), before);
  }
});

test('original shed interior uses saved contents and closes to the original roof tile order', () => {
  const world = readScenario(source(4)), b = world.buildings[3];
  const before = world.cells.map(c => c.terrain);
  assert.deepEqual([b.type, b.x, b.y, b.flags], [67, 48, 49, 32]);
  assert.equal(findBuilding(world, 49, 51)?.slot, 3);
  assert.equal(findBuilding(world, 47, 48, 2, 2)?.slot, 3);
  assert.notEqual(findBuilding(world, 48, 52)?.slot, 3);
  toggleBuildingInterior(b, world);
  assert.equal(b.flags, 33);
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) {
    const cell = world.cells[worldIndex(b.x + dx, b.y + dy)];
    assert.equal(cell.terrain, 0x08d9);
    assert.equal(cell.overlay & 0x7ff, b.content(dx * 3 + dy).graphic);
  }
  toggleBuildingInterior(b, world);
  assert.equal(b.flags, 32);
  assert.deepEqual(world.cells.map(c => c.terrain), before);
});

test('every stored original machine can be withdrawn with exactly its footprint removed', () => {
  let withdrawals = 0;
  for (let i = 0; i < 8; i++) {
    const world = readScenario(source(i));
    for (const e of world.equipment.filter(e => e.active && (e.flags & 4))) {
      const b = findBuilding(world, e.x, e.y)!;
      assert.ok(b);
      const before = Array.from({ length: 12 }, (_, n) => b.content(n)), flags = b.flags;
      const dx = e.x - b.x, dy = e.y - b.y, { width, height } = equipmentFootprint(e, world);
      withdrawStoredEquipment(e, world); withdrawals++;
      assert.equal(e.flags & 4, 0); assert.equal(b.flags, flags);
      for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) {
        const cleared = x >= dx && x < dx + width && y >= dy && y < dy + height;
        assert.deepEqual(b.content(x * 3 + y), cleared ? { graphic: 217, type: -1, slot: 0 } : before[x * 3 + y]);
      }
    }
  }
  assert.ok(withdrawals > 100);
});

test('owned allocator reserves and withdraws the nearest original tractor without stale shed contents', () => {
  const world = readScenario(source(4)), e = world.equipment[1], b = findBuilding(world, e.x, e.y)!;
  const contentIndex = (e.x - b.x) * 3 + e.y - b.y;
  toggleBuildingInterior(b, world);
  assert.equal(reserveOwnedEquipment(world, 0, e.x, e.y)?.slot, 1);
  assert.equal(e.flags, 0x21);
  assert.deepEqual(b.content(contentIndex), { graphic: 217, type: -1, slot: 0 });
  assert.equal(world.cells[worldIndex(e.x, e.y)].terrain, 217);
  assert.equal(b.flags & 1, 1);
  assert.notEqual(reserveOwnedEquipment(world, 0, e.x, e.y)?.slot, 1);
  assert.equal(reserveOwnedEquipment(world, 8, e.x, e.y), undefined);
});

test('malformed storage reference fails before reserving a machine or altering contents (SF-011)', () => {
  const world = readScenario(source(4)), e = world.equipment[1], b = findBuilding(world, e.x, e.y)!;
  const index = (e.x - b.x) * 3 + e.y - b.y;
  b.bytes[58 + index] = 255;
  const contents = Uint8Array.from(b.bytes), equipment = Uint8Array.from(e.bytes);
  assert.throws(() => reserveOwnedEquipment(world, 0, e.x, e.y), /does not match/);
  assert.deepEqual(b.bytes, contents); assert.deepEqual(e.bytes, equipment);
});

test('original saved machinery can leave its sheds, rendezvous and execute a complete field pass', () => {
  const world = readScenario(source(4)), field = world.fields[1];
  const r: EquipmentRuntime = { grassTravelCount: 0, animationTick: 0, notices: [] };
  const tractor = reserveOwnedEquipment(world, 0, field.x, field.y)!;
  const implement = reserveOwnedEquipment(world, 1, field.x, field.y)!;
  assert.ok(tractor); assert.ok(implement);
  setEquipmentDestination(tractor, implement.x, implement.y, 0);
  let moving = true;
  for (let i = 0; i < 65 && moving; i++) moving = moveEquipment(tractor, world, r);
  assert.equal(moving, false);
  assert.deepEqual([tractor.x, tractor.y], [implement.x, implement.y]);
  eraseEquipment(tractor, world); eraseEquipment(implement, world);
  tractor.bytes[15] = 2; tractor.bytes[48] = field.slot; tractor.bytes[49] = 1;
  attachEquipment(tractor, implement, world.equipmentDefinitions);
  // Field-entry placement is a separate FSM step; this test exercises the newly ported dependencies.
  tractor.bytes[5] = field.x; tractor.bytes[6] = field.y;
  positionEquipmentAttachments(tractor, world.equipment, world.equipmentDefinitions);
  let done = false;
  for (let i = 0; i < 100 && !done; i++) done = traverseEquipmentField(tractor, field, 12, world, r);
  assert.equal(done, true);
  eraseEquipment(tractor, world);
  let painted = 0;
  for (let x = field.x; x < field.x + field.width; x++) for (let y = field.y; y < field.y + field.height; y++) {
    const tile = world.cells[worldIndex(x, y)].terrain & 0x7ff;
    assert.ok(tile === 12 || (tile >= 539 && tile < 666));
    if (tile === 12) painted++;
  }
  assert.ok(painted >= 48);
});
