import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { EquipmentRecord } from '../src/formats/equipment';
import { attachEquipment, setEquipmentDestination } from '../src/simulation/equipment';
import { arriveEquipment, detachEquipment, parkEquipment, releaseEquipment, updateEquipment } from '../src/simulation/equipment-dispatch';
import type { EquipmentRuntime } from '../src/simulation/equipment-world';

const runtime = (): EquipmentRuntime => ({ grassTravelCount: 0, animationTick: 0, notices: [] });
function setup(tile = 150) {
  const world = readScenario(readFileSync(new URL('../../simfarm-dos/SCEN4.SSM', import.meta.url)));
  world.equipment.forEach(e => e.bytes.fill(0)); world.buildings.forEach(b => b.bytes.fill(0));
  world.cells.forEach(c => { c.terrain = tile; c.overlay = 0; c.attribute = 0; });
  return world;
}
function activate(e: EquipmentRecord, type = 0, x = 20, y = 20) {
  e.bytes.fill(0); e.bytes[0] = type; e.flags = 0x20;
  e.bytes[5] = e.bytes[50] = x; e.bytes[6] = e.bytes[51] = y;
  e.bytes[53] = 1; e.bytes[54] = type === 5 || type === 7 ? 2 : 1;
  return e;
}

test('detaching and releasing a three-member chain clears every link and restores footprints (SF-010)', () => {
  const world = setup(), head = activate(world.equipment[1]), a = activate(world.equipment[2], 1), b = activate(world.equipment[3], 5);
  attachEquipment(head, a, world.equipmentDefinitions); attachEquipment(a, b, world.equipmentDefinitions);
  for (const e of [head, a, b]) { e.flags |= 9; e.bytes[48] = 2; }
  b.flags |= 0x40;
  releaseEquipment(head, world);
  for (const e of [head, a, b]) {
    assert.equal(e.flags & 9, 0); assert.equal(e.bytes[48], 0);
    assert.equal(e.bytes[53], world.equipmentDefinitions[e.type].width);
    assert.equal(e.bytes[54], world.equipmentDefinitions[e.type].height);
  }
  assert.equal(b.active, false);
  // Detachment precedes release in arrival handling; exercise it separately with an active chain.
  b.flags |= 0x20; detachEquipment(head, world);
  for (const e of [head, a, b]) assert.deepEqual([e.parent, e.attachment], [0, 0]);
});

test('parking keeps a clear position, follows original ring order and terminates on a blocked map (SF-012)', () => {
  const world = setup(0), e = activate(world.equipment[1]), r = runtime();
  world.cells[worldIndex(20, 20)].terrain = 150;
  assert.equal(parkEquipment(e, world, r), true);
  assert.deepEqual([e.x, e.y], [20, 20]); assert.equal(e.flags & 0x80, 0x80);
  world.cells[worldIndex(20, 20)].terrain = 0;
  world.cells[worldIndex(19, 22)].terrain = 150;
  world.cells[worldIndex(20, 19)].terrain = 150;
  assert.equal(parkEquipment(e, world, r), true);
  assert.deepEqual([e.x, e.y, e.direction], [19, 22, 0]);
  world.cells.forEach(c => { c.terrain = 0; c.overlay = 0; });
  assert.equal(parkEquipment(e, world, r), false);
  assert.deepEqual([e.x, e.y, e.direction], [19, 22, 0]);
  assert.deepEqual(r.notices, [{ type: 'parking-unavailable', slot: 1 }]);
});

test('movement pacing uses unsigned tick rollover and field waypoints retain the reservation', () => {
  const world = setup(), e = activate(world.equipment[1]), r = runtime();
  e.flags |= 9; setEquipmentDestination(e, 21, 20, 65535); e.flags |= 0x1000;
  updateEquipment(world, r, 0); assert.equal(e.x, 20);
  updateEquipment(world, r, 1); assert.equal(e.x, 21);
  assert.equal(e.flags & 0x1002, 0); assert.equal(e.flags & 9, 9); assert.equal(e.timestamp, 1);
  assert.deepEqual([e.bytes[50], e.bytes[51]], [20, 20]);
  setEquipmentDestination(e, 22, 20, 1); e.flags &= ~8;
  updateEquipment(world, r, 1, false);
  assert.equal(e.x, 22); assert.equal(e.flags & 3, 0);
  assert.deepEqual([e.bytes[50], e.bytes[51]], [22, 20]);
});

test('implement-only arrival retains the tractor; final arrival orders its return and releases it', () => {
  for (const flag of [0x400, 0x100]) {
    const world = setup(), e = activate(world.equipment[1]), child = activate(world.equipment[2], 1, 30, 30), r = runtime();
    e.flags |= flag | 9; child.flags |= 9; attachEquipment(e, child, world.equipmentDefinitions);
    arriveEquipment(e, world, r, 0);
    assert.deepEqual([child.x, child.y, child.parent, child.attachment], [30, 30, 0, 0]);
    assert.equal(child.flags & 9, 0); assert.equal(e.attachment, 0); assert.equal(e.flags & 9, 9);
    if (flag === 0x400) assert.equal(e.flags & 0x702, 0);
    else {
      assert.equal(e.flags & 0x702, 0x202);
      for (let tick = 2; tick < 150 && (e.flags & 2); tick += 2) updateEquipment(world, r, tick);
      assert.equal(e.flags & 0x20b, 0); assert.deepEqual([e.x, e.y], [20, 20]);
    }
  }
});

test('moving an implement acquires a tractor, delivers it and returns the tractor without stale links', () => {
  const world = setup(), tractor = activate(world.equipment[1]), child = activate(world.equipment[2], 1, 25, 20), r = runtime();
  setEquipmentDestination(child, 30, 30, 0);
  let tick = 0, sawAttachment = false;
  for (; tick < 500; tick++) {
    updateEquipment(world, r, tick);
    sawAttachment ||= tractor.attachment === child.slot;
    if (tick > 0 && !(tractor.flags & 0xb) && child.bytes[4] === 0) break;
  }
  assert.ok(tick < 500); assert.ok(sawAttachment);
  assert.deepEqual([child.x, child.y, child.bytes[50], child.bytes[51]], [30, 30, 30, 30]);
  assert.deepEqual([tractor.x, tractor.y], [20, 20]);
  assert.equal(child.flags & 0xb, 0); assert.equal(child.parent, 0); assert.equal(tractor.attachment, 0);
});
