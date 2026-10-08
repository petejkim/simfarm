import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFinancialState } from '../src/formats/finance';
import { readFarmState } from '../src/formats/scenario-state';
import { readIrrigation, IRRIGATION_SOURCE_OFFSET, validateIrrigation } from '../src/formats/irrigation';
import { encodeFinancialState } from '../src/formats/finance-save';
const source = (file: string) => readFileSync(new URL('../../simfarm-dos/' + file, import.meta.url));
const exe = source('SIMFARM.EXE');

test('in-game file load returns through its own pacing callback rather than chooser initialization', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, hex: string) => assert.equal(exe.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x43257, '0ee8e12183c4040bc07470'); //4543c, success branch.
  exact(0x43272, '2ac08e06e8ce26a2be668e06e4ce26a288019a3413e624');
  exact(0x432c3, '8e06ecce26c7069e010100e92aff'); //Return431fb, not main startup.
  exact(0x27060 + 0x1334 + 3, 'ea3811ce271200'); //Overlay18:1138 ->3f4e8.
  exact(0x3f4f3, '26803e8701007503e9850026fe0e8701757e');
  exact(0x3f519, '26c7068c1f0001'); exact(0x3f524, '26c706901f0100');
  exact(0x3f52f, '26c70686221000'); exact(0x3f53a, '26c70602240200');
  exact(0x459df, '46f0d1e08bc80554f9'); //Runtime overlapping registry destination.
  exact(0x45a31, '837ef040729d');
  exact(0x46208, '6890616802249a4a078400'); //Delay loads separately.
});

test('warm financial reads replace only transferred members and retain omitted accounts, statistics, debt and town state', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), previous = readFinancialState(source('SCEN0.SSM'));
    previous.accounts.buildingBookValue = 0xf1234567;
    Object.assign(previous.annual, { priorTaxExpenses: 11, ds3e70: 12, ds3e8c: 13, ds3e90: 14, ds3e94: 15, ds3e9c: 16 });
    previous.statistics.regions = [1, 2, 3, 4]; previous.statistics.words.fill(4321); previous.statistics.fieldPresence.fill(7);
    previous.statistics.distinctFieldStatuses = 8; previous.statistics.nutrientDeficientFields = 123; previous.statistics.chemicallyStressedFields = 234;
    previous.homestead.rank = 4; previous.debt.balanceDue = 0xffffffff; previous.debt.balanceCountdown = 253;
    previous.loanRate = 27; previous.taxFailures = 250;
    previous.clearing.x[3] = 20; previous.clearing.y[3] = 30; previous.clearing.cursor = 3; previous.clearing.count = 1; previous.clearing.lastTick = 65535;
    previous.town.expansionFunds = 123456; previous.town.developmentSpent = 654;
    const before = encodeFinancialState(previous), cold = readFinancialState(bytes), result = readFinancialState(bytes, previous);
    const expected = { ...cold,
      accounts: { ...cold.accounts, buildingBookValue: previous.accounts.buildingBookValue },
      annual: { ...cold.annual, priorTaxExpenses: 11, ds3e70: 12, ds3e8c: 13, ds3e90: 14, ds3e94: 15, ds3e9c: 16 },
      statistics: { ...previous.statistics, ds3e58: cold.statistics.ds3e58, ds3e5c: cold.statistics.ds3e5c },
      homestead: { ...cold.homestead, rank: 4 }, debt: { ...cold.debt, balanceDue: 0xffffffff, balanceCountdown: 253 },
      loanRate: 27, taxFailures: 250,
      town: { ...cold.town, expansionFunds: 123456, developmentSpent: 654 }, clearing: previous.clearing };
    assert.deepEqual(encodeFinancialState(result), encodeFinancialState(expected));
    result.statistics.words[0] = 0; result.statistics.regions[0] = 0; result.statistics.fieldPresence[0] = 0;
    result.town.recreationCoordinates[0] = 90; result.clearing.x[0] = 0;
    result.accounts.assets.animalDefinitions[0].bytes[0] ^= 1;
    assert.deepEqual(encodeFinancialState(previous), before);
  }
});

test('warm farm transfers retain worker ledger bits while replacing saved cash and calendar; invalid retained values reject', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`);
    for (const workerExpenses of [0, 1, 0x80000000, 0xffffffff]) {
      assert.deepEqual(readFarmState(bytes, workerExpenses), { ...readFarmState(bytes), workerExpenses });
    }
  }
  for (const bad of [-1, 0x100000000, 0.5, NaN]) assert.throws(() => readFarmState(source('SCEN0.SSM'), bad), /worker/);
});

test('warm irrigation transfer preserves every untransferred byte and active wave without aliasing the old state', () => {
  const previous = readIrrigation(source('SCEN0.SSM'));
  for (let i = 129; i < 192; i++) previous.sources[i] = (i * 3) & 255;
  previous.active = true; previous.phase = 1; previous.lastTick = 65534; previous.delay = 999;
  previous.flow = [{ x: 95, y: 0, strength: 255 }, { x: 0, y: 95, strength: 7 }];
  const before = structuredClone(previous);
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), result = readIrrigation(bytes, previous), expected = Uint8Array.from(previous.sources);
    for (let record = 0; record < 64; record++) for (let member = 0; member < 3; member++)
      expected[record * 2 + member] = bytes[IRRIGATION_SOURCE_OFFSET + 1 + record * 3 + member];
    assert.deepEqual(result, { ...previous, sources: expected, sourceCount: bytes[IRRIGATION_SOURCE_OFFSET], delay: bytes.readUInt16LE(0x21720) });
    result.sources[191] ^= 255; result.flow[0].x = 0;
    assert.deepEqual(previous, before);
  }
});

test('warm irrigation can supply all64 source records only from a valid retained tail; cold and malformed imports reject atomically', () => {
  const bytes = Buffer.from(source('SCEN0.SSM')), previous = readIrrigation(bytes);
  previous.sources.fill(0); bytes[IRRIGATION_SOURCE_OFFSET] = 64;
  bytes.fill(0, IRRIGATION_SOURCE_OFFSET + 1, IRRIGATION_SOURCE_OFFSET + 193);
  previous.sources.set([95, 94, 255], 63 * 3);
  const before = structuredClone(previous), loaded = readIrrigation(bytes, previous);
  assert.deepEqual([...loaded.sources.subarray(189)], [95, 94, 255]); assert.equal(loaded.sourceCount, 64); validateIrrigation(loaded);
  assert.throws(() => readIrrigation(bytes), /tail/);
  bytes[IRRIGATION_SOURCE_OFFSET] = 65; assert.throws(() => readIrrigation(bytes, previous), /state/);
  bytes[IRRIGATION_SOURCE_OFFSET] = 64; previous.sources[189] = 96;
  assert.throws(() => readIrrigation(bytes, previous), /coordinate/); previous.sources[189] = 95;
  assert.throws(() => readIrrigation(bytes.subarray(0, 0x21721), previous), /bounds|range|outside|binary/i);
  assert.deepEqual(previous, before);
});


test('malformed warm financial inputs and truncated SSM reads leave prior state unchanged', () => {
  const bytes = source('SCEN0.SSM');
  for (const change of [
    (f: ReturnType<typeof readFinancialState>) => f.loanRate = -1,
    (f: ReturnType<typeof readFinancialState>) => f.statistics.words[0] = 65536,
    (f: ReturnType<typeof readFinancialState>) => f.homestead.rank = 6,
    (f: ReturnType<typeof readFinancialState>) => f.clearing.count = 65,
  ]) {
    const prior = readFinancialState(bytes); change(prior); const before = encodeFinancialState(prior);
    assert.throws(() => readFinancialState(bytes, prior), /financial/);
    assert.deepEqual(encodeFinancialState(prior), before);
  }
  const prior = readFinancialState(bytes), before = encodeFinancialState(prior);
  assert.throws(() => readFinancialState(bytes.subarray(0, 0x2173f), prior), /Binary range/);
  assert.deepEqual(encodeFinancialState(prior), before);
});
