import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { projectFieldScheduleYear } from '../src/simulation/field-projection';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4, single = false) {
  const world = readScenario(source(`SCEN${id}.SSM`));
  const crops = world.cropFiles.map(file => readCrop(file, source(`CROPS/${file.toUpperCase()}`)).rawDefinition);
  if (single) world.fields.slice(2).forEach(f => f.bytes[7] &= ~1);
  return { world, crops, run: () => projectFieldScheduleYear(world, crops) };
}

test('year projection constants, segment selectors and unchecked scan agree with executable bytes', () => {
  const exe = source('SIMFARM.EXE');
  assert.equal(exe.subarray(0x48d9e, 0x48da1).toString('hex'), 'b8c024'); // Skip 48 weeks.
  assert.equal(exe.subarray(0x48dc4, 0x48dcc).toString('hex'), '6880496a02689f4d'); // Read 192 weeks.
  assert.equal(exe.subarray(0x49160, 0x49168).toString('hex'), '68e05b6a02689f4d'); // Write 240 weeks.
  assert.deepEqual([0xcf50, 0xcf52, 0xcf54, 0xcf56].map(o => exe.readUInt16LE(0x846f0 + o)), [0x6190, 0x6190, 0x2d9f, 0x2be7]);
  assert.equal(exe.readUInt16LE(0x4ec60 + 0x86a), 440);
  for (let slot = 0; slot < 16; slot++) assert.equal(exe.readUInt16LE(0x4ec60 + 0x90c + slot * 2), 832 + slot);
  assert.equal(exe.subarray(0x490c9, 0x490d3).toString('hex'), 'ff4ef480bea0fd00746b'); // No lower bound.
  assert.equal(exe.subarray(0x48efa, 0x48f01).toString('hex'), '268a87bec59840'); // Signed restart byte + 1.
});

test('all eight original plans shift four years and preserve source, fields and unknown inactive columns', () => {
  for (let id = 0; id < 8; id++) {
    const { world, crops, run } = setup(id), before = readScenario(source(`SCEN${id}.SSM`));
    const cropBytes = structuredClone(crops);
    assert.deepEqual(run(), { unprojectedFieldSlots: [] });
    for (const field of world.fields) {
      assert.deepEqual(field.bytes, before.fields[field.slot].bytes);
      if (!field.slot) continue;
      const old = before.schedule.column(field.slot - 1), actual = world.schedule.column(field.slot - 1);
      if (field.active) {
        const perennial = Boolean(crops[field.cropSlot][62] & 1);
        let marker = 239;
        while (marker >= 48 && !(perennial ? old[marker] === 440 : old[marker] >= 832 && old[marker] < 848)) marker--;
        assert.ok(marker >= 48);
        assert.deepEqual(actual.slice(0, marker - 48 + 1), old.slice(48, marker + 1));
        assert.ok(actual.slice(192).every(code => code === 440 || (code >= 688 && code < 816) || (code >= 832 && code < 848)));
      } else assert.deepEqual(actual, [...old.slice(48), ...old.slice(192)]);
    }
    const extra = before.schedule.column(97);
    assert.deepEqual(world.schedule.column(97), [...extra.slice(48), ...extra.slice(192)]);
    assert.deepEqual(world.sourceBytes, before.sourceBytes); assert.deepEqual(crops, cropBytes);
  }
});

test('original corn and grape schedules extend crop cycles rather than repeating a calendar year', () => {
  const corn = setup(4); corn.run();
  const cycle = [832, 688, 688, 689, 689, 690, 690, 691, 691, 692, 692, 693, 693, 440];
  assert.deepEqual(corn.world.schedule.column(0).slice(190), [...cycle, ...cycle, ...cycle, ...cycle.slice(0, 8)]);
  const grapes = setup(0); grapes.run();
  assert.deepEqual([180, 181, 187, 188, 222, 227, 228, 229, 235, 236, 239].map(w => grapes.world.schedule.get(w, 0)),
    [440, 696, 696, 697, 701, 702, 440, 696, 696, 697, 697]);
  // Repeated rollover is valid and keeps the first 48-week crop plan moving forward.
  const prior = corn.world.schedule.column(0); corn.run();
  assert.deepEqual(corn.world.schedule.column(0).slice(0, 140), prior.slice(48, 188));
});

test('annual plans choose the last planted crop, overwrite its later orders, and apply perennial restart', () => {
  const { world, crops, run } = setup(4, true);
  const apple = readCrop('apples', source('CROPS/APPLES.CRP')).rawDefinition;
  crops[1] = apple; // Future rotation differs from the current annual corn field.
  world.schedule.bytes.fill(0);
  world.schedule.set(48, 0, 833); world.schedule.set(80, 0, 915); world.schedule.set(220, 0, 65535);
  world.schedule.set(239, 97, 54321);
  run();
  assert.deepEqual([0, 1, 7, 8, 47, 48, 49, 54, 55, 95, 96, 102].map(w => world.schedule.get(w, 0)),
    [833, 696, 696, 697, 702, 440, 696, 696, 697, 440, 696, 697]);
  assert.equal(world.schedule.get(239, 97), 54321);
  assert.equal(world.fields[1].cropSlot, 0);
});

test('missing matching markers are bounded for annual and perennial fields without inventing a crop plan', () => {
  for (const id of [0, 4]) {
    const { world, run } = setup(id, true);
    world.schedule.bytes.fill(0);
    world.schedule.set(48, 0, 65535); world.schedule.set(238, 0, id ? 440 : 832);
    assert.deepEqual(run(), { unprojectedFieldSlots: [1] });
    assert.equal(world.schedule.get(0, 0), 65535);
    assert.equal(world.schedule.get(190, 0), id ? 440 : 832);
    assert.ok(world.schedule.column(0).slice(192).every(word => word === 209));
  }
});

test('invalid divisors, stack-overlapping durations and signed restart indices reject projection atomically', () => {
  for (const [offset, value, error] of [[66, 0, /divisor/], [56, 1, /divisor/], [56, 48, /duration/],
    [18, 127, /restart/], [18, 128, /restart/], [18, 254, /restart/]] as const) {
    const { world, crops, run } = setup(0);
    // The invalid crop is used by field 8, after seven otherwise valid projected fields.
    crops[0][offset] = value;
    const before = Uint8Array.from(world.schedule.bytes);
    assert.throws(run, error); assert.deepEqual(world.schedule.bytes, before);
  }
  const { world, crops, run } = setup(4, true);
  world.schedule.bytes.fill(0); world.schedule.set(48, 0, 832);
  // Zero duration executes neither original division; each two-word cycle remains valid.
  crops[0][56] = 0; crops[0][66] = 0;
  run(); assert.deepEqual(world.schedule.column(0).slice(0, 6), [832, 440, 832, 440, 832, 440]);
  crops[0][62] |= 1; crops[0][18] = 255; // Signed -1 + 1 gives valid index zero.
  run(); assert.ok(world.schedule.column(0).slice(191).every(word => word === 440));
});

test('stage-offset arithmetic retains original unsigned word wrap without changing crop bytes', () => {
  const { world, crops, run } = setup(4, true);
  world.schedule.bytes.fill(0); world.schedule.set(48, 0, 832);
  crops[0][26] = 255; crops[0][27] = 255;
  run();
  assert.deepEqual(world.schedule.column(0).slice(0, 6), [832, 687, 687, 688, 688, 689]);
});
