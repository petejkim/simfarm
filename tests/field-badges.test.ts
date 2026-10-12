import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { updateFieldStatus } from '../src/simulation/field-status';
import { drawFieldBadgeStacks, fieldBadgeStacks } from '../src/render/field-badges';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const crop = readCrop('grapes', source('CROPS/GRAPES.CRP')).rawDefinition;

test('several column-3 conditions render as a fixed vertical stack while the simulation keeps cycling', () => {
  const scenario = readScenario(source('SCEN0.SSM')), field = scenario.fields[1], b = field.bytes;
  assert.ok(field.width >= 8 && field.height >= 8);
  new DataView(b.buffer).setUint16(24, 0, true); b[29] = 90; b[32] = 129; b[20] = b[21] = b[22] = 53; b[56] = 0;
  const expected = [{ x: field.x + 6, y: field.y, badges: [18, 21, 16, 20] }]; // toxicity, weed, pest, fungus
  for (const badge of [21, 16, 20]) {
    updateFieldStatus(field, crop, scenario.cells);
    assert.equal(scenario.cells[worldIndex(field.x + 6, field.y)].terrain & 2047, 539 + badge * 4); // original cycling write
    assert.deepEqual(fieldBadgeStacks(scenario).filter(s => s.x === field.x + 6 && s.y === field.y), expected);
  }
  const draws: number[][] = [];
  drawFieldBadgeStacks({ drawImage: (_: unknown, sx: number, sy: number, _w: number, _h: number, dx: number, dy: number) => draws.push([(sy / 16) * 32 + sx / 16, dx / 16, dy / 16]) } as unknown as CanvasRenderingContext2D, expected, {} as CanvasImageSource);
  assert.deepEqual(draws.slice(4, 8), [[623, field.x + 6, field.y + 2], [624, field.x + 7, field.y + 2], [625, field.x + 6, field.y + 3], [626, field.x + 7, field.y + 3]]);
  assert.equal(draws.length, 16);
  // One condition keeps the original single badge; a field too short for the stack keeps the original display.
  b[21] = b[22] = 0; b[32] = 0; updateFieldStatus(field, crop, scenario.cells);
  assert.equal(fieldBadgeStacks(scenario).some(s => s.x === field.x + 6 && s.y === field.y), false);
  b[21] = b[22] = 53; updateFieldStatus(field, crop, scenario.cells); b[13] = 5;
  assert.equal(fieldBadgeStacks(scenario).some(s => s.x === field.x + 6 && s.y === field.y), false);
  b[13] = 6; assert.deepEqual(fieldBadgeStacks(scenario).find(s => s.x === field.x + 6 && s.y === field.y)?.badges, [21, 16, 20]);
  // Stale flags without a displayed column-3 badge (e.g. erased terrain) draw nothing.
  scenario.cells[worldIndex(field.x + 6, field.y)].terrain = 15;
  assert.equal(fieldBadgeStacks(scenario).some(s => s.x === field.x + 6 && s.y === field.y), false);
});
