import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFields, FIELD_STATES } from '../src/formats/field';
import { readScenario, worldIndex, terrainTile } from '../src/formats/scenario';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('all original active fields have exact bounds, crop slots and serialized state', () => {
  const counts = [13, 9, 9, 3, 8, 5, 7, 7];
  for (let i = 0; i < counts.length; i++) {
    const bytes = source(`SCEN${i}.SSM`), scenario = readScenario(bytes);
    assert.equal(scenario.fields.length, 98);
    const active = scenario.fields.filter(f => f.active);
    assert.equal(active.length, counts[i]);
    for (const field of active) {
      assert.equal(field.status, 'Growing');
      assert.equal(field.width, 8); assert.equal(field.height, 8);
      assert.ok(field.contains(field.x, field.y));
      assert.ok(field.contains(field.x + 7, field.y + 7));
      assert.ok(!field.contains(field.x - 1, field.y));
      assert.ok(!field.contains(field.x + 8, field.y));
      assert.ok(!field.contains(field.x, field.y + 8));
      const cropTiles = scenario.cells.filter((_, index) => field.contains(Math.floor(index / 96), index % 96));
      assert.ok(cropTiles.some(cell => terrainTile(cell) >= 688 + field.cropSlot * 8 && terrainTile(cell) < 696 + field.cropSlot * 8));
      assert.deepEqual(field.bytes, bytes.subarray(0x45bd + field.slot * 68, 0x45bd + (field.slot + 1) * 68));
    }
  }
  const first = readScenario(source('SCEN0.SSM'));
  assert.equal(first.fields[1].number, 1);
  assert.equal(first.cropFiles[first.fields[1].cropSlot], 'grapes.crp');
  assert.equal(terrainTile(first.cells[worldIndex(first.fields[1].x, first.fields[1].y)]), 543);
});

test('field work names match the original string table; malformed active records fail', () => {
  const exe = source('SIMFARM.EXE');
  FIELD_STATES.forEach((state, i) => assert.equal(exe.subarray(0x8a598 + 16 * i, 0x8a598 + 16 * (i + 1)).toString().split('\0')[0], state));
  const bytes = source('SCEN0.SSM');
  bytes[0x45bd + 68 + 10] = 95;
  assert.throws(() => readFields(bytes), /bounds/);
  const wrongCount = source('SCEN0.SSM'); wrongCount.writeUInt16LE(97, 0x45bb);
  assert.throws(() => readFields(wrongCount), /count/);
});
