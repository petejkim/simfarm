import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { Binary } from '../src/formats/binary';
import { editFieldPlan, type FieldPlanEdit } from '../src/simulation/field-plan-edit';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const world = readScenario(source(`SCEN${id}.SSM`));
  const crops = world.cropFiles.map(file => readCrop(file, source(`CROPS/${file.toUpperCase()}`)).rawDefinition);
  const now = world.farm.calendar.month * 4 + world.farm.calendar.week;
  return { world, crops, now, edit: (week: number, action: FieldPlanEdit) => editFieldPlan(world, crops, 1, week, action) };
}

test('editor dispatch table, calendar guards, slot offset and writer arguments agree with source bytes', () => {
  const exe = source('SIMFARM.EXE');
  assert.deepEqual(Array.from({ length: 23 }, (_, i) => 0x2cf40 + exe.readUInt16LE(0x2e798 + i * 2)),
    [...Array(16).fill(0x2e5a6), 0x2e58a, 0x2e238, 0x2e238, 0x2e7f5, 0x2e46a, 0x2e7f5, 0x2e29a]);
  assert.equal(exe.subarray(0x2e228, 0x2e22e).toString('hex'), '3b86a2fd7203'); // Strictly future edits.
  assert.equal(exe.subarray(0x2d0a0, 0x2d0a3).toString('hex'), '2aed49'); // Field slot minus one.
  assert.equal(exe.subarray(0x2e779, 0x2e780).toString('hex'), 'ffb6a4fde9eafd'); // Write from selected week.
  assert.equal(exe.subarray(0x2e535, 0x2e53b).toString('hex'), '3982aafd7213'); // Original strict upper bound (SF-039).
  assert.equal(exe.subarray(0x2e59b, 0x2e5a2).toString('hex'), '26c7870000ef00'); // Unhandled marker 239 (SF-040).
});

test('all eight farms can plant a future crop while preserving every earlier and neighboring schedule word', () => {
  for (let id = 0; id < 8; id++) {
    const { world, crops, now, edit } = setup(id), start = now + 1, duration = crops[15][56];
    const before = Uint8Array.from(world.schedule.bytes), fields = world.fields.map(f => Uint8Array.from(f.bytes));
    assert.deepEqual(edit(start, { kind: 'plant', cropSlot: 15 }), { ok: true, fieldSlot: 1, week: start });
    assert.equal(world.schedule.get(start, 0), 847);
    assert.equal(world.schedule.get(start + 1, 0), 808);
    assert.equal(world.schedule.get(start + duration + 1, 0), 440);
    assert.equal(world.schedule.get(start + duration + 2, 0), 847);
    assert.deepEqual(world.schedule.bytes.slice(0, start * 196), before.slice(0, start * 196));
    for (let row = start; row < 240; row++) assert.deepEqual(world.schedule.bytes.slice(row * 196 + 2, (row + 1) * 196), before.slice(row * 196 + 2, (row + 1) * 196));
    world.fields.forEach((f, i) => assert.deepEqual(f.bytes, fields[i]));
  }
});

test('perennial future planting keeps its fixed harvest dates and refuses a separately moved harvest', () => {
  const { world, now, edit } = setup(0), before = Uint8Array.from(world.schedule.bytes);
  assert.deepEqual(edit(now + 1, { kind: 'harvest' }), { ok: false, reason: 'fixed-harvest-week' });
  assert.deepEqual(world.schedule.bytes, before);
  edit(40, { kind: 'plant', cropSlot: 1 }); // Grapes after their current-year harvest week 36.
  assert.equal(world.schedule.get(40, 0), 833);
  assert.equal(world.schedule.get(84, 0), 440);
  assert.equal(world.schedule.get(85, 0), 696);
});

test('all four calendar treatments protect planting, harvest and contracts but replace other codes', () => {
  const { world, now, edit } = setup();
  for (const [kind, code] of [['fertilizer', 915], ['pesticide', 914], ['herbicide', 913], ['fungicide', 912]] as const) {
    for (const old of [0, 1, 2, 3, 198, 209, 231, 239, 440, 688, 815, 831, 832, 846, 847, 848, 852, 912, 65535]) {
      world.schedule.set(now + 1, 0, old);
      const protectedWord = old === 198 || old === 440 || old >= 832 && old <= 847;
      assert.equal(edit(now + 1, { kind }).ok, !protectedWord);
      assert.equal(world.schedule.get(now + 1, 0), protectedWord ? old : code);
    }
  }
});

test('annual harvest clears through the next planting and preserves all sixteen crop slots (SF-039)', () => {
  for (let crop = 0; crop < 16; crop++) {
    const { world, now, edit } = setup(), harvest = now + 2, nextPlant = harvest + 4;
    world.schedule.set(nextPlant, 0, 832 + crop);
    const old = world.schedule.column(0);
    edit(harvest, { kind: 'harvest' });
    assert.deepEqual(world.schedule.column(0).slice(0, harvest), old.slice(0, harvest));
    assert.deepEqual(world.schedule.column(0).slice(harvest, nextPlant), [440, 209, 209, 209]);
    assert.deepEqual(world.schedule.column(0).slice(nextPlant), old.slice(nextPlant));
  }
  const { world, edit } = setup();
  edit(239, { kind: 'harvest' }); assert.equal(world.schedule.get(239, 0), 440);
});

test('clearing removes the whole remaining plan and planting can restart at the last week', () => {
  const { world, now, edit } = setup(), old = world.schedule.column(0);
  edit(now + 1, { kind: 'clear' });
  assert.deepEqual(world.schedule.column(0).slice(0, now + 1), old.slice(0, now + 1));
  assert.ok(world.schedule.column(0).slice(now + 1).every(word => word === 209));
  edit(239, { kind: 'plant', cropSlot: 0 });
  assert.equal(world.schedule.get(238, 0), 209); assert.equal(world.schedule.get(239, 0), 832);
});

test('current-week contract captures the original crop trade price once without immediate income', () => {
  const { world, now, edit } = setup(), f = new Binary(world.fields[1].bytes), def = world.cropDefinitions[0];
  const count = def.count, cash = world.farm.cash;
  assert.deepEqual(edit(now + 1, { kind: 'contract' }), { ok: false, reason: 'contract-current-week' });
  assert.equal(edit(now, { kind: 'contract' }).ok, true);
  assert.equal(f.u16(48), def.price); assert.equal(def.count, count + 1);
  assert.equal(world.schedule.get(now, 0), 198); assert.equal(world.farm.cash, cash);
  assert.deepEqual(edit(now, { kind: 'contract' }), { ok: false, reason: 'already-contracted' });
});

test('past/current edits, malformed crops, inactive fields and binary boundaries are rejected without writes', () => {
  const { world, crops, now, edit } = setup(), before = JSON.stringify(world);
  for (const week of [0, now]) for (const kind of ['clear', 'harvest', 'fertilizer', 'plow'] as const) {
    assert.deepEqual(edit(week, { kind }), { ok: false, reason: 'future-week-required' });
  }
  for (const week of [-1, 240, NaN, 0.5]) assert.deepEqual(edit(week, { kind: 'clear' }), { ok: false, reason: 'invalid-week' });
  for (const field of [0, -1, 97, 98, NaN]) assert.deepEqual(editFieldPlan(world, crops, field, now + 1, { kind: 'clear' }), { ok: false, reason: 'invalid-field' });
  for (const slot of [-1, 16, NaN]) assert.deepEqual(edit(now + 1, { kind: 'plant', cropSlot: slot }), { ok: false, reason: 'invalid-crop' });
  for (const [offset, value] of [[56, 48], [66, 0]]) {
    const old = crops[0][offset]; crops[0][offset] = value;
    assert.deepEqual(edit(now + 1, { kind: 'plant', cropSlot: 0 }), { ok: false, reason: 'invalid-crop' });
    crops[0][offset] = old;
  }
  assert.equal(JSON.stringify(world), before);
});
