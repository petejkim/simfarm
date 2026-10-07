import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Binary } from '../src/formats/binary';
import { FieldRecord } from '../src/formats/field';
import { readCrop } from '../src/formats/crop';
import { readScenario } from '../src/formats/scenario';
import { cropMaturity, harvestLoss, harvestValue, fieldHarvestValue } from '../src/simulation/harvest-value';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const crop = (name: string) => readCrop(name, source(`CROPS/${name}`)).rawDefinition;
function field(age: number, stress = 0, heatDeficit = 0): FieldRecord {
  const f = new FieldRecord(1, new Uint8Array(68)), view = new Binary(f.bytes).view;
  f.bytes[2] = 4; f.bytes[7] = 1; f.bytes[34] = age;
  view.setUint16(18, stress, true); view.setUint16(38, heatDeficit, true);
  return f;
}

test('maturity uses signed age, heat delay and the original one-eighth fixed-point cutoff', () => {
  const definition = Array(128).fill(0); definition[56] = 16;
  assert.equal(cropMaturity(field(1), definition), 0);
  assert.equal(cropMaturity(field(2), definition), 8192);
  assert.equal(cropMaturity(field(8), definition), 32768);
  assert.equal(cropMaturity(field(16), definition), 65535);
  assert.equal(cropMaturity(field(17), definition), 65535);
  definition[30] = 10;
  assert.equal(cropMaturity(field(8, 0, 35), definition), 24576); // delay = 2
  assert.equal(cropMaturity(field(8, 0, 36), definition), 20480); // delay = 3
  assert.equal(cropMaturity(field(1, 0, 24), definition), 65535); // SF-019: -1 wraps.
  assert.equal(cropMaturity(field(0, 0, 128 * 12), definition), 65535); // signed delay byte
  assert.equal(cropMaturity(field(128), definition), 65535); // signed age byte
  definition[56] = 0;
  assert.throws(() => cropMaturity(field(2), definition), /maturity definition/);
  definition[56] = 16; definition[30] = 254; definition[31] = 255;
  assert.throws(() => cropMaturity(field(2), definition), /heat divisor/);
});

test('harvest stress saturates, cutoff is strict, value rounds down and intermediate product wraps (SF-020)', () => {
  const definition = Array(128).fill(0); definition[56] = 16;
  assert.equal(harvestLoss(field(8, 1000), definition), 33767);
  assert.equal(harvestLoss(field(8, 40000), definition), 65535);
  assert.equal(harvestValue(1000, 0, 100), 34463); // 100000 -> low word 34464
  assert.equal(harvestValue(1000, 51000, 10), 2217);
  assert.equal(harvestValue(1000, 51001, 10), 0);
  assert.equal(harvestValue(65535, 0, 65535), 0); // low product word is 1, then floor
  assert.throws(() => harvestValue(65536, 0, 1), /unsigned words/);
  assert.throws(() => harvestValue(1, -1, 1), /unsigned words/);
});

test('all original crop definitions produce bounded harvest values and contract prices override trade prices', () => {
  for (const filename of readdirSync(new URL('../../simfarm-dos/CROPS/', import.meta.url)).filter(f => f.endsWith('.CRP'))) {
    const c = crop(filename), b = new Binary(Uint8Array.from(c)), f = field(c[56]);
    assert.equal(cropMaturity(f, c), 65535, filename);
    assert.equal(harvestLoss(f, c), 0, filename);
    const price = b.u16(34), quantity = b.u16(32);
    assert.equal(fieldHarvestValue(f, c, price), Number((BigInt(quantity * Math.floor(price / 10)) % 65536n) * 65535n / 65536n));
    new Binary(f.bytes).view.setUint16(48, 100, true);
    assert.equal(fieldHarvestValue(f, c, price), harvestValue(quantity, 0, 10));
    f.bytes[2] = 0;
    assert.equal(fieldHarvestValue(f, c, price), 0);
  }
  const corn = crop('CORN.CRP');
  assert.equal(fieldHarvestValue(field(12), corn, 150), 4334);
  assert.equal(fieldHarvestValue(field(12), corn, 159), 4334); // price truncates before multiplying
});

test('valuation leaves all original saved field records and definitions unchanged', () => {
  for (let id = 0; id < 8; id++) {
    const world = readScenario(source(`SCEN${id}.SSM`));
    for (const f of world.fields.filter(f => f.active)) {
      const c = crop(world.cropFiles[f.cropSlot].toUpperCase()), before = Uint8Array.from(f.bytes), original = [...c];
      const result = fieldHarvestValue(f, c, world.cropDefinitions[f.cropSlot].price);
      assert.ok(Number.isInteger(result) && result >= 0 && result < 65536);
      assert.deepEqual(f.bytes, before); assert.deepEqual(c, original);
    }
  }
});
