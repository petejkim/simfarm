import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EQUIPMENT_RECORDS_OFFSET, EquipmentRecord } from '../src/formats/equipment';
import { readScenario, worldIndex, type WorldCell } from '../src/formats/scenario';
import { attachEquipment, equipmentTargetDirection, findAvailableEquipment, planEquipmentStep,
  positionEquipmentAttachments, scoreEquipmentStep, setEquipmentDestination } from '../src/simulation/equipment';

const source = (i: number) => readFileSync(new URL(`../../simfarm-dos/SCEN${i}.SSM`, import.meta.url));
function machine(slot: number, type = 0, x = 20, y = 20): EquipmentRecord {
  const e = new EquipmentRecord(slot, new Uint8Array(56));
  e.bytes[0] = type; e.flags = 0x20; e.bytes[5] = x; e.bytes[6] = y;
  e.bytes[53] = e.bytes[54] = 1;
  return e;
}
const map = (tile: number): WorldCell[] => Array.from({ length: 96 * 96 }, () => ({ terrain: tile, overlay: 0, attribute: 0 }));

test('all original farms decode machinery and type tables without aliasing source bytes', () => {
  const counts = [49, 0, 42, 7, 28, 32, 54, 0];
  for (let i = 0; i < 8; i++) {
    const input = source(i), before = Uint8Array.from(input), s = readScenario(input);
    assert.equal(s.equipment.length, 127);
    assert.equal(s.equipment.filter(e => e.active).length, counts[i]);
    assert.deepEqual(s.equipmentDefinitions.slice(0, 9).map(d => d.price), [400, 200, 200, 200, 400, 200, 250, 500, 6000]);
    assert.deepEqual(s.equipmentDefinitions.slice(0, 9).map(d => [d.width, d.height]), [[1, 1], [1, 1], [1, 1], [1, 1], [1, 2], [1, 2], [1, 1], [1, 2], [2, 2]]);
    s.equipment[1].bytes.fill(0); s.equipmentDefinitions[0].bytes.fill(0);
    assert.deepEqual(Uint8Array.from(input), before);
  }
  const bad = source(4); bad.writeUInt16LE(127, EQUIPMENT_RECORDS_OFFSET - 2);
  assert.throws(() => readScenario(bad), /equipment count/);
  const cycle = source(4);
  cycle.writeUInt16LE(2, EQUIPMENT_RECORDS_OFFSET + 56 + 46);
  cycle.writeUInt16LE(1, EQUIPMENT_RECORDS_OFFSET + 112 + 46);
  assert.throws(() => readScenario(cycle), /attachment cycle/);
  const outside = source(4); outside[EQUIPMENT_RECORDS_OFFSET + 56 + 5] = 96;
  assert.throws(() => readScenario(outside), /equipment type, coordinates/);
});

test('owned equipment selection observes condition, rental, reservation and attachment exclusions', () => {
  const records = Array.from({ length: 10 }, (_, i) => machine(i, 0, i ? 20 : 0, 20));
  records[1].flags = 0; records[2].flags |= 1; records[3].flags |= 8;
  records[4].flags |= 0x40; records[5].attachment = 8; records[6].bytes[17] = 192;
  records[7].bytes[0] = 1;
  // Stored machines are eligible; the caller must subsequently withdraw them from the building.
  records[8].flags |= 4; records[8].bytes[17] = 191;
  assert.equal(findAvailableEquipment(records, 0, 20, 20)?.slot, 8);
  records[9].bytes[5] = 21;
  assert.equal(findAvailableEquipment(records, 0, 21, 20)?.slot, 9);
  assert.equal(findAvailableEquipment(records, 8, 20, 20), undefined);
  assert.equal(records[8].flags, 0x24); // Selection itself does not prematurely reserve or erase storage.
});

test('movement orders clamp targets, reset history and preserve other flags and unknown data', () => {
  const e = machine(1); e.flags |= 0x1008; e.bytes[55] = 63; e.bytes[41] = 173;
  setEquipmentDestination(e, -5, 120, 65537);
  assert.deepEqual([e.targetX, e.targetY, e.timestamp, e.bytes[4], e.bytes[55]], [0, 95, 1, 1, 0]);
  assert.deepEqual([...e.bytes.subarray(9, 15)], [20, 20, 20, 20, 20, 20]);
  assert.equal(e.flags, 0x102a); assert.equal(e.bytes[41], 173);
  assert.deepEqual([e.x, e.y], [20, 20]);
});

test('equipment routing reproduces terrain penalties, history, ties and original blocked fallback', () => {
  const e = machine(1), cells = map(150);
  setEquipmentDestination(e, 50, 50, 0);
  assert.equal(equipmentTargetDirection(e), 4);
  assert.deepEqual(planEquipmentStep(e, cells), { x: 20, y: 21, direction: 4, teleported: false });
  cells[worldIndex(20, 21)].terrain = 15;
  assert.equal(scoreEquipmentStep(e, cells, 0, 1), 85);
  assert.deepEqual(planEquipmentStep(e, cells), { x: 19, y: 20, direction: 6, teleported: false });
  e.bytes[9] = 19; e.bytes[10] = 20;
  assert.equal(scoreEquipmentStep(e, cells, -1, 0), 200);
  assert.deepEqual(planEquipmentStep(e, cells), { x: 21, y: 20, direction: 2, teleported: false });
  for (const [tile, score] of [[14, 20000], [15, 85], [31, 85], [32, 20000], [149, 20000], [150, 0], [172, 0], [173, 20000], [188, 0], [192, 0], [193, 20000]]) {
    cells[worldIndex(20, 21)].terrain = 0x8000 | tile;
    assert.equal(scoreEquipmentStep(e, cells, 0, 1), score, `tile ${tile}`);
  }
  assert.deepEqual(planEquipmentStep(e, map(36)), { x: 50, y: 50, direction: 0, teleported: true });
  // Within squared distance 4, source ignores even blocked terrain and movement history.
  setEquipmentDestination(e, 20, 23, 0);
  assert.equal(scoreEquipmentStep(e, map(36), 0, 1), 0);
  e.bytes[5] = 0; setEquipmentDestination(e, 0, 20, 0);
  assert.equal(scoreEquipmentStep(e, cells, -1, 0), 20000);
});

test('a machine follows a road corridor using the original routing rules', () => {
  const e = machine(1, 0, 10, 10), cells = map(36);
  for (let x = 10; x <= 20; x++) cells[worldIndex(x, 10)].terrain = 150;
  for (let y = 10; y <= 20; y++) cells[worldIndex(20, y)].terrain = 150;
  setEquipmentDestination(e, 20, 20, 0);
  const positions = [[e.x, e.y]];
  for (let i = 0; i < 20; i++) {
    const step = planEquipmentStep(e, cells);
    assert.equal(step.teleported, false);
    e.bytes.copyWithin(11, 9, 13); e.bytes[9] = e.x; e.bytes[10] = e.y;
    e.bytes[5] = step.x; e.bytes[6] = step.y; e.bytes[15] = step.direction;
    positions.push([e.x, e.y]);
  }
  assert.deepEqual(positions[10], [20, 10]);
  assert.deepEqual(positions[20], [20, 20]);
});

test('attachments retain original footprint and cardinal geometry through movement and turns', () => {
  const definitions = readScenario(source(4)).equipmentDefinitions;
  for (const [direction, x, y] of [[0, 20, 21], [2, 18, 20], [4, 20, 18], [6, 21, 20]]) {
    const parent = machine(1), child = machine(2, 5);
    parent.bytes[15] = direction; parent.bytes[48] = 3; parent.bytes[49] = 255;
    attachEquipment(parent, child, definitions);
    assert.deepEqual([parent.attachment, child.parent, parent.bytes[53], parent.bytes[54]], [2, 1, 1, 2]);
    assert.deepEqual([child.x, child.y, child.direction, child.fieldSlot, child.bytes[49]], [x, y, direction, 3, 255]);
    parent.bytes[5] = 30; parent.bytes[6] = 30;
    positionEquipmentAttachments(parent, [machine(0), parent, child], definitions);
    assert.deepEqual([child.x, child.y], [x + 10, y + 10]);
    assert.throws(() => attachEquipment(parent, child, definitions), /attachment/);
  }
  const parent = machine(1), first = machine(2, 5), second = machine(3, 5);
  parent.bytes[15] = 2;
  attachEquipment(parent, first, definitions); first.bytes[54] = 2;
  attachEquipment(first, second, definitions);
  parent.bytes[5] = 40; parent.bytes[6] = 40; parent.bytes[15] = 4;
  positionEquipmentAttachments(parent, [machine(0), parent, first, second], definitions);
  assert.deepEqual([first.x, first.y, second.x, second.y], [40, 38, 40, 36]);
  second.attachment = 1;
  assert.throws(() => positionEquipmentAttachments(parent, [machine(0), parent, first, second], definitions), /attachment chain/);
});
