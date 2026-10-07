import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readAnnualStatistics, copyAnnualStatistics, validateAnnualStatistics } from '../src/formats/annual-statistics';
import { annualAssetValue, annualAssetRating, updateAnnualStatistics, updateReportedFieldStatus } from '../src/simulation/annual-statistics';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
test('annual statistics pin source reads, signed arithmetic, report stores, initialization and clock calls', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  for (const [start, end, address] of [[0x45ca6, 0x45cbc, '68583e'], [0x45cbe, 0x45cd4, '685c3e']] as const) {
    assert.ok(e.subarray(start, end).includes(Buffer.from(address, 'hex')));
  }
  exact(0xbe8b, '9aa006781c'); exact(0xce0e, '9a520b781c9af40b781c');
  exact(0x3d9d2, '6a006a038d46fc509ad0348400'); exact(0x3d9ec, '2946fc1956fe837efe007d08');
  exact(0x3ccff, '3d40427303b80700c9cb');
  exact(0x1f58d, '98a36044'); exact(0x1f5a3, '98a36444');
  exact(0x1f5af, '2bca890e4c44'); exact(0x1f5bd, '2bc1a35044'); exact(0x1f5cd, '2b065444a35444');
  exact(0x1f5de, '26a11cfaa35844'); exact(0x1f5ef, '26a11efaa35c44');
  for (const [address, length] of [[0x444c, 28], [0x750d, 4], [0x448e, 8], [0x4560, 1]]) {
    assert.deepEqual([...e.subarray(0x846f0 + address, 0x846f0 + address + length)], Array(length).fill(0));
  }
});

test('all eight source farms import the two raw dwords with byte-offset and truncation boundaries, without inventing history', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), before = Uint8Array.from(bytes), state = readAnnualStatistics(bytes);
    assert.equal(state.ds3e58, bytes.readUInt32LE(0x21684)); assert.equal(state.ds3e5c, bytes.readUInt32LE(0x21688));
    assert.deepEqual(state.words, Array(14).fill(0)); assert.deepEqual(state.regions, [0, 0, 0, 0]);
    const copy = copyAnnualStatistics(state); copy.words[0] = 123; copy.regions[0] = 1; copy.fieldPresence[0] = 1;
    assert.equal(state.words[0], 0); assert.equal(state.regions[0], 0); assert.equal(state.fieldPresence[0], 0);
    assert.deepEqual(Uint8Array.from(bytes), before);
  }
  const bytes = Buffer.alloc(0x2168c + 7, 0x5a), view = bytes.subarray(7);
  view.writeUInt32LE(0xfedcba98, 0x21684); view.writeUInt32LE(0x87654321, 0x21688);
  assert.equal(readAnnualStatistics(view).ds3e58, 0xfedcba98); assert.equal(readAnnualStatistics(view).ds3e5c, 0x87654321);
  for (let end = 0x21684; end < 0x2168c; end++) assert.throws(() => readAnnualStatistics(view.subarray(0, end)), /Binary range/);
});

test('asset values divide signed wrapped sums before wrapped debt subtraction and signed clamp; rating retains the upper fallthrough', () => {
  const values = [0, 1, 2, 3, 65535, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff];
  for (const a of values) for (const b of values) for (const debt of values) {
    const sum = BigInt.asIntN(32, BigInt(a) * 3n + BigInt(b) * 2n);
    const net = BigInt.asIntN(32, sum / 3n - BigInt(debt));
    assert.equal(annualAssetValue(a, b, a, b, a, debt), Number(net < 0 ? 0n : net));
  }
  const bounds = [4000, 15000, 50000, 100000, 200000, 300000, 500000, 1000000];
  for (let rank = 0; rank < bounds.length; rank++) {
    assert.equal(annualAssetRating(bounds[rank] - 1), rank);
    assert.equal(annualAssetRating(bounds[rank]), rank === 7 ? 1000000 & 65535 : rank + 1);
  }
  assert.equal(annualAssetRating(1048576), 0); assert.equal(annualAssetRating(0x7fffffff), 65535);
  assert.equal(annualAssetRating(0x80000000), 0); assert.equal(annualAssetRating(0xffffffff), 0);
  for (const bad of [-1, NaN, 0.5, 0x100000000]) {
    assert.throws(() => annualAssetValue(0, 0, 0, 0, 0, bad)); assert.throws(() => annualAssetRating(bad));
  }
});

test('annual region and word updates preserve signed-byte counts, unknown ownership and repeated-year recurrences', () => {
  const world = readScenario(source('SCEN4.SSM'));
  for (const f of world.fields) f.bytes[7] = 0;
  world.fields[97].bytes[7] = 1; world.fields[97].bytes[54] = 0x84;
  for (const count of [0, 1, 127, 128, 144]) for (const owner of [1, 2]) {
    const state = readAnnualStatistics(world.sourceBytes);
    state.ds3e58 = 30000; state.ds3e5c = 0;
    for (let i = 0; i < 144; i++) world.regionalConditions[i * 7 + 1] = i < count ? owner : 255;
    state.regions = [33, 44, 55, 66]; state.words = Array.from({ length: 14 }, (_, i) => i + 10);
    const rawWorld = Uint8Array.from(world.regionalConditions);
    updateAnnualStatistics(world, state, 0, 0, 0, 0);
    const player = owner === 1 ? count : 0, town = owner === 2 ? count : 0;
    const signed = (n: number) => n >= 128 ? n - 256 : n;
    assert.deepEqual(state.regions, [55, 66, town, player]);
    assert.deepEqual(state.words.slice(0, 4), [(signed(player) - 10) & 65535, 10, (signed(town) - 12) & 65535, 12]);
    assert.deepEqual(state.words.slice(6), [1, 16, 1, 18, signed(player) & 65535, 20, signed(town) & 65535, 22]);
    assert.deepEqual(world.regionalConditions, rawWorld);
    const first = [...state.words]; updateAnnualStatistics(world, state, 0, 0, 0, 0);
    assert.deepEqual(state.regions, [town, player, town, player]);
    assert.equal(state.words[0], (signed(player) - first[0]) & 65535); assert.equal(state.words[1], first[0]);
    assert.equal(state.words[4], 14); assert.equal(state.words[5], first[4]);
    assert.equal(state.words[7], 1); assert.equal(state.words[9], 1);
  }
});

test('weekly aggregation leaves annual history untouched and invalid annual inputs reject before mutation', () => {
  const world = readScenario(source('SCEN4.SSM')), state = readAnnualStatistics(world.sourceBytes);
  state.words.fill(0xffff); state.regions.fill(0xff);
  for (const field of world.fields) field.bytes[7] = 0;
  world.fields[97].bytes[7] = 1; world.fields[97].bytes[54] = 0xff; world.farm.cash = 4999;
  assert.equal(updateReportedFieldStatus(world, state), 'dfarm');
  assert.deepEqual(state.words, Array(14).fill(65535)); assert.deepEqual(state.regions, Array(4).fill(255));
  assert.deepEqual(state.fieldPresence, Array(8).fill(1)); assert.equal(state.nutrientDeficientFields, 1);
  const before = structuredClone(state);
  assert.throws(() => updateAnnualStatistics(world, state, -1, 0, 0, 0));
  assert.throws(() => updateAnnualStatistics(world, state, 0, 0, 0, NaN));
  assert.throws(() => updateAnnualStatistics({ ...world, fields: [] }, state, 0, 0, 0, 0));
  assert.throws(() => updateAnnualStatistics({ ...world, regionalConditions: new Uint8Array(1007) }, state, 0, 0, 0, 0));
  assert.deepEqual(state, before);
  for (const bad of [{ ...state, words: [] }, { ...state, regions: [0, 0, 0, 256] }, { ...state, fieldPresence: Array(8).fill(2) }]) {
    assert.throws(() => validateAnnualStatistics(bad));
  }
});
