import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { ownedLandValue, assessAnnualTax, settleAnnualTax, type TaxAccount } from '../src/simulation/tax';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const farm = (id = 4) => readScenario(source(`SCEN${id}.SSM`));

test('tax assessment is grounded in the original cash brackets, signed division and land ownership calls', () => {
  const exe = source('SIMFARM.EXE');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x1d52b, '833e4a3e02'); exact(0x1d534, '813e483ef049'); // 150000
  exact(0x1d553, '833e4a3e07'); exact(0x1d55c, '813e483e20a1'); // 500000
  exact(0x1d53e, '6a0a'); exact(0x1d566, '6a05'); exact(0x1d57d, '6a03');
  exact(0x1d57f, 'ff36463eff36443e9af8338400'); // sales / divisor
  exact(0x1d596, '26a11875'); // unpaid balance
  exact(0x1d5a5, '6a006a639ac810e624'); // land / 99
  exact(0x28128, 'e8c2f4ea0820ce270f00'); // overlay 15:2008
  exact(0x3cbe4, '2680bfbd0001'); exact(0x3cbf9, 'e86afb'); // owner 1 -> valuation
  exact(0x3c83b, '2bd2'); // individual quote is an unsigned word
  exact(0x5e40, '8b46080bc07d11'); exact(0x5ec4, 'f7daf7d883da00'); // signed long divide
  exact(0xcdf4, '9a640d661a9a360b661a'); // annual collection, then ledger reset
  exact(0x1d5d9, '2bc0a3463ea3443e'); // sales reset before debit
  exact(0x1d5e5, '68c409'); exact(0x1d5fe, '2669061275c800'); // taxes, low-word level*200
  exact(0x1d622, 'd1ead1d8d1ead1d8'); // unsigned old-debt quarter
  exact(0x1d630, 'd1fbd1d9d1fbd1d9'); // signed assessment quarter
  exact(0x1d679, '26c606d7fe03'); exact(0x1d75c, '9ad210e624');
});

function settlementFarm(level = 1) {
  const s = farm(); s.regionalConditions.fill(0);
  s.regionalConditions[0] = level << 4; s.regionalConditions[1] = 2;
  s.farm.cash = 40000; s.farm.salesAccumulator = 1000; // Tax 100, maintenance 200 per level.
  const account: TaxAccount = { unpaidTaxes: 0, taxExpenses: 0, taxFailures: 0, taxCountdown: 0, townRevenue: 0, expansionFunds: 0 };
  return { s, account };
}

test('annual payment allocates town revenue, draws reserves and requests expansion at the source threshold', () => {
  for (const [revenue, reserves, nextRevenue, nextReserves, offer] of [
    [0, 0, -100, 0, false], [0, 99, -1, 0, false], [0, 100, 0, 0, false],
    [0, 150, 0, 50, false], [99, 0, -1, 0, false], [100, 0, -25, 25, true],
    [500, 300, 375, 325, true],
  ] as const) {
    const { s, account } = settlementFarm();
    account.townRevenue = revenue; account.expansionFunds = reserves; account.taxExpenses = 0xfffffff0;
    const result = settleAnnualTax(s, 8, account);
    assert.equal(result.paid, true); assert.equal(result.offerExpansion, offer); assert.equal(result.maintenance, 200);
    assert.equal(s.farm.cash, 39900); assert.equal(s.farm.salesAccumulator, 0);
    assert.equal(account.taxExpenses, 84); assert.equal(account.townRevenue, nextRevenue >>> 0); assert.equal(account.expansionFunds, nextReserves);
  }
});

test('failed taxes clear sales, preserve cash and compound source debt with signed and unsigned quarters', () => {
  const { s, account } = settlementFarm();
  account.unpaidTaxes = 80; account.taxFailures = 255; account.expansionFunds = 777;
  s.farm.cash = 179;
  const result = settleAnnualTax(s, 8, account);
  assert.equal(result.assessment.total, 180); assert.equal(result.paid, false); assert.equal(result.offerExpansion, false);
  assert.equal(s.farm.cash, 179); assert.equal(s.farm.salesAccumulator, 0);
  assert.deepEqual(account, { unpaidTaxes: 325, taxExpenses: 0, taxFailures: 0, taxCountdown: 3, townRevenue: (-180) >>> 0, expansionFunds: 777 });
  // A zero debit returns zero and follows failure in the original.
  account.unpaidTaxes = 0;
  assert.equal(settleAnnualTax(s, 8, account).paid, false);
  assert.equal(account.taxFailures, 1); assert.equal(account.taxCountdown, 3);
});

test('annual success retains existing debt/countdown; funding uses word maintenance and signed dword comparisons', () => {
  const { s, account } = settlementFarm();
  account.unpaidTaxes = 80; account.taxCountdown = 2; account.taxFailures = 4;
  account.townRevenue = 0xfffffff0; account.expansionFunds = 100;
  assert.equal(settleAnnualTax(s, 8, account).offerExpansion, false);
  assert.equal(account.unpaidTaxes, 80); assert.equal(account.taxCountdown, 2); assert.equal(account.taxFailures, 4);
  assert.equal(account.townRevenue, 0); assert.equal(account.expansionFunds, 64);
  for (let r = 0; r < 144; r++) { s.regionalConditions[r * 7] = 255; s.regionalConditions[r * 7 + 1] = 2; }
  s.farm.salesAccumulator = 1000; account.unpaidTaxes = 0;
  assert.equal(settleAnnualTax(s, 8, account).maintenance, 38784); // 2160 * 200, low word.
});

test('invalid annual tax state is rejected before clearing sales or spending cash', () => {
  for (const key of ['unpaidTaxes', 'taxExpenses', 'townRevenue', 'expansionFunds', 'taxFailures', 'taxCountdown'] as const) {
    const { s, account } = settlementFarm();
    account[key] = key === 'taxFailures' || key === 'taxCountdown' ? 256 : 0x100000000;
    const before = JSON.stringify([s, account]);
    assert.throws(() => settleAnnualTax(s, 8, account));
    assert.equal(JSON.stringify([s, account]), before);
  }
});

test('owned land valuation includes only player plots but all ownership codes affect plot prices', () => {
  const s = farm(); s.regionalConditions.fill(0);
  for (const c of s.cells) c.terrain = 15;
  assert.equal(ownedLandValue(s, 0), 0);
  s.regionalConditions[1] = 1; s.regionalConditions[6] = 0xf0;
  s.regionalConditions[8] = 2; s.regionalConditions[15] = 255;
  s.cells[worldIndex(7, 7)].terrain |= 0x1000;
  assert.equal(ownedLandValue(s, -1), 15000 + 300 + 240 - 16 + 500);
  s.regionalConditions[(11 * 12 + 11) * 7 + 1] = 1;
  assert.equal(ownedLandValue(s, -1), (15000 + 400 + 240 - 16 + 500) + (15000 + 400 - 16));
  // Every owned plot contributes; byte ownership codes are not treated as booleans.
  for (let i = 0; i < 144; i++) s.regionalConditions[i * 7 + 1] = 1;
  assert.equal(ownedLandValue(s, 127), 144 * (15000 + 14400 + 2032) + 240 + 500);
});

test('tax cash brackets use exact unsigned boundaries and truncate sales and land separately', () => {
  const s = farm(); s.regionalConditions.fill(0);
  for (const c of s.cells) c.terrain = 15;
  s.regionalConditions[1] = 1; s.farm.salesAccumulator = 101;
  for (const [cash, divisor, sales] of [[0, 10, 10], [149999, 10, 10], [150000, 5, 20],
    [499999, 5, 20], [500000, 3, 33], [0xffffffff, 3, 33]]) {
    s.farm.cash = cash;
    assert.deepEqual(assessAnnualTax(s, 0, 123), {
      salesDivisor: divisor, salesTax: sales, landValue: 15100, landTax: 152, arrears: 123, total: sales + 275,
    });
  }
});

test('tax quotations retain signed sales conversion and unsigned total wrapping without mutating a farm', () => {
  const s = farm(); s.regionalConditions.fill(0); s.farm.cash = 500000;
  for (const [sales, tax, arrears, total] of [[0x7fffffff, 715827882, 0, 715827882],
    [0x80000000, -715827882, 0, 3579139414], [0xffffffff, 0, 0, 0],
    [30, 10, 0xfffffffe, 8]]) {
    s.farm.salesAccumulator = sales;
    const before = JSON.stringify(s), result = assessAnnualTax(s, 0, arrears);
    assert.equal(result.salesTax, tax); assert.equal(result.total, total);
    assert.equal(JSON.stringify(s), before);
  }
});

test('all original farms receive source-data land assessments; invalid accounting inputs fail without mutation', () => {
  for (let id = 0; id < 8; id++) {
    const s = farm(id), before = JSON.stringify(s), sourceBefore = Buffer.from(s.sourceBytes);
    const moisture = 8; // Existing native startup weather, not a saved climate-table member.
    const occupied = Array.from({ length: 144 }, (_, i) => s.regionalConditions[i * 7 + 1]).filter(Boolean).length;
    let expected = 0;
    for (let r = 0; r < 144; r++) if (s.regionalConditions[r * 7 + 1] === 1) {
      let marked = 0;
      for (let x = Math.floor(r / 12) * 8; x < Math.floor(r / 12) * 8 + 8; x++) {
        for (let y = r % 12 * 8; y < r % 12 * 8 + 8; y++) marked += Number(Boolean(s.cells[worldIndex(x, y)].terrain & 0x1000));
      }
      expected += (15000 + occupied * 100 + (s.regionalConditions[r * 7 + 6] >> 4) * 16 + moisture * 16 + marked * 500) & 65535;
    }
    const arrears = new DataView(s.sourceBytes.buffer, s.sourceBytes.byteOffset).getUint32(0x21726, true);
    const result = assessAnnualTax(s, moisture, arrears);
    assert.equal(result.landValue, expected); assert.equal(result.landTax, Math.trunc(expected / 99));
    assert.equal(JSON.stringify(s), before); assert.deepEqual(Buffer.from(s.sourceBytes), sourceBefore);
    for (const invalid of [-1, 0x100000000, 0.5, NaN, Infinity]) assert.throws(() => assessAnnualTax(s, moisture, invalid));
    assert.throws(() => assessAnnualTax(s, 128, 0)); assert.throws(() => assessAnnualTax(s, -129, 0));
    assert.equal(JSON.stringify(s), before);
  }
});
