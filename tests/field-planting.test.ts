import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { findFieldEntry, updatePlantingField } from '../src/simulation/field-planting';
import { updateEquipment } from '../src/simulation/equipment-dispatch';
import type { EquipmentRuntime } from '../src/simulation/equipment-world';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('a validated planting order completes both passes and returns owned machines on all four equipped farms', () => {
  for (const id of [3, 4, 5, 6]) {
    const world = readScenario(source(`SCEN${id}.SSM`)), field = world.fields.find(f => f.active)!;
    const crop = readCrop('selected', source(`CROPS/${world.cropFiles[field.cropSlot].toUpperCase()}`)).rawDefinition;
    const runtime: EquipmentRuntime = { grassTravelCount: 0, animationTick: 0, notices: [] };
    // This is the post-seed-validation boundary, not the still-unported planting command.
    field.bytes[2] = 3; field.bytes[3] = 0;
    const stored = new Set(world.equipment.filter(e => e.flags & 4).map(e => e.slot));
    const steps = new Set<number>(), tractors = new Set<number>(), used = new Set<number>();
    let tick = 0, sawPlowed = false;
    for (; tick < 3000; tick++) {
      runtime.animationTick = tick;
      updateEquipment(world, runtime, tick);
      if (field.state === 3) {
        steps.add(field.step);
        if (field.equipment) tractors.add(field.equipment);
        if (field.pendingEquipment) used.add(field.pendingEquipment);
        updatePlantingField(field, crop, world, runtime, tick);
        if (field.step === 6) sawPlowed ||= world.cells[worldIndex(field.x, field.y + 2)].terrain % 2048 === 12;
      }
      if (field.state === 4 && [...tractors, ...used].every(slot => !(world.equipment[slot].flags & 0xb))) break;
    }
    assert.ok(tick < 3000, `farm ${id}: stuck at step ${field.step}`);
    assert.deepEqual([...steps], Array.from({ length: 12 }, (_, n) => n));
    assert.equal(tractors.size, 1); assert.equal(used.size, 2); assert.ok(sawPlowed);
    assert.equal(field.state, 4); assert.equal(field.equipment, 0); assert.equal(field.pendingEquipment, 0);
    assert.equal(field.bytes[34], 0); assert.equal(field.bytes[33], (world.farm.calendar.week + 1) & 3);
    assert.equal(field.bytes[36] | field.bytes[37] << 8, crop[30] | crop[31] << 8);
    assert.equal(field.bytes[6] & 6, 4);
    let planted = 0;
    for (let x = field.x; x < field.x + field.width; x++) for (let y = field.y; y < field.y + field.height; y++) {
      const tile = world.cells[worldIndex(x, y)].terrain & 0x7ff;
      assert.ok(tile === 688 + field.cropSlot * 8 || (tile >= 539 && tile < 666), `farm ${id}: unexpected tile ${tile}`);
      if (tile === 688 + field.cropSlot * 8) planted++;
    }
    assert.ok(planted >= 48);
    for (const slot of [...tractors, ...used]) {
      const machine = world.equipment[slot];
      assert.equal(machine.parent, 0); assert.equal(machine.attachment, 0);
      if (stored.has(slot)) assert.equal(machine.flags & 4, 4, `farm ${id}: machine ${slot} not stored`);
      assert.equal(machine.bytes[48], 0);
    }
    assert.equal(runtime.notices.some(n => n.type === 'parking-unavailable'), false);
  }
});

test('field entry scans top before bottom in column order, clamps edges and falls back to the origin', () => {
  const world = readScenario(source('SCEN4.SSM')), field = world.fields[1];
  world.cells.forEach(c => { c.terrain = 15; });
  assert.deepEqual(findFieldEntry(field, world), { x: field.x, y: field.y });
  world.cells[worldIndex(field.x, field.y - 1)].terrain = 150;
  world.cells[worldIndex(field.x - 1, field.y + 8)].terrain = 171;
  assert.deepEqual(findFieldEntry(field, world), { x: field.x - 1, y: field.y + 8 });
  field.bytes[10] = 0; field.bytes[11] = 0;
  world.cells[0].terrain = 150;
  assert.deepEqual(findFieldEntry(field, world), { x: 0, y: 0 });
});
