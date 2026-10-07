import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { beginTownExpansion, findTownExpansionSite, townStatistics } from '../src/simulation/town';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function empty() {
  const s = readScenario(source('SCEN4.SSM'));
  s.regionalConditions.fill(0);
  for (const c of s.cells) c.terrain = 15;
  s.farm.townRegionX = 6; s.farm.townRegionY = 6;
  return s;
}

test('town region byte, level counter, candidate mask and expansion quote match executable evidence', () => {
  const e = source('SIMFARM.EXE');
  const exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x45ab1, '059c94'); exact(0x3c5e7, '8a809c94c0e8042ae4');
  exact(0x3b256, '2680bfbd0002'); exact(0x3b26e, '01061275');
  exact(0x3c3f5, 'c646fe01'); exact(0x3c4eb, '807efe0c');
  exact(0x3c426, '26f687250430'); exact(0x3c4ae, '2680bfbd0000');
  exact(0x3c84b, '2bc08946fe8946f68946fa');
  exact(0x3c8b1, '030616752bd2');
  assert.equal(e.readUInt16LE(0x846f0 + 0x7516), 15000);
  exact(0x3bff0, '29068e7519169075'); exact(0x3c032, '26c687bd0002');
  exact(0x3c050, '6808a1'); // source opens the district choice screen after ownership/payment
});

test('all supplied farms count town ownership and retain the type nibble and all other region channels', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), s = readScenario(bytes), before = Buffer.from(s.regionalConditions);
    let regions = 0, residentialLevels = 0;
    for (let r = 0; r < 144; r++) if (bytes[0x21273 + r * 7 + 1] === 2) {
      regions++; residentialLevels += bytes[0x21273 + r * 7] >>> 4;
    }
    assert.deepEqual(townStatistics(s), { regions, residentialLevels });
    assert.deepEqual(Buffer.from(s.regionalConditions), before);
  }
  const s = empty();
  for (let r = 0; r < 144; r++) { s.regionalConditions[r * 7] = 255; s.regionalConditions[r * 7 + 1] = 2; }
  assert.deepEqual(townStatistics(s), { regions: 144, residentialLevels: 2160 });
  s.regionalConditions[1] = 1; s.regionalConditions[8] = 255;
  assert.deepEqual(townStatistics(s), { regions: 142, residentialLevels: 2130 });
});

test('town search uses original square scan order, terrain flags and radius eleven without map aliasing', () => {
  const s = empty();
  assert.deepEqual(findTownExpansionSite(s), { regionX: 5, regionY: 5 });
  s.regionalConditions[(5 * 12 + 5) * 7 + 1] = 1;
  assert.deepEqual(findTownExpansionSite(s), { regionX: 5, regionY: 6 });
  s.cells[worldIndex(5 * 8 + 7, 6 * 8 + 7)].terrain |= 0x1000;
  s.cells[worldIndex(5 * 8, 7 * 8)].terrain |= 0x2000;
  assert.deepEqual(findTownExpansionSite(s), { regionX: 6, regionY: 5 });
  // Flags on the second word do not block this source search.
  for (const c of s.cells) c.overlay = 0xffff;
  assert.deepEqual(findTownExpansionSite(s), { regionX: 6, regionY: 5 });
  for (let r = 0; r < 144; r++) s.regionalConditions[r * 7 + 1] = 2;
  s.farm.townRegionX = 0; s.farm.townRegionY = 0;
  s.regionalConditions[143 * 7 + 1] = 0;
  assert.deepEqual(findTownExpansionSite(s), { regionX: 11, regionY: 11 });
  s.cells[worldIndex(95, 95)].terrain |= 0x3000;
  assert.equal(findTownExpansionSite(s), null);
  s.farm.townRegionX = -1;
  assert.throws(() => findTownExpansionSite(s));
});

test('expansion spends town funds and reserves ownership before a choice, preserving player cash and map bytes', () => {
  const s = empty(), beforeCells = JSON.stringify(s.cells), beforeRegions = Buffer.from(s.regionalConditions), cash = s.farm.cash;
  const funds = { townRevenue: 123, expansionFunds: 14999 };
  assert.equal(beginTownExpansion(s, funds), null);
  assert.deepEqual(Buffer.from(s.regionalConditions), beforeRegions);
  funds.expansionFunds = 0xffffffff; // Signed comparison, not an enormous positive fund.
  assert.equal(beginTownExpansion(s, funds), null);
  funds.expansionFunds = 15000;
  assert.deepEqual(beginTownExpansion(s, funds), { regionX: 5, regionY: 5 });
  assert.deepEqual(funds, { townRevenue: 123, expansionFunds: 0 });
  beforeRegions[(5 * 12 + 5) * 7 + 1] = 2;
  assert.deepEqual(Buffer.from(s.regionalConditions), beforeRegions);
  assert.equal(JSON.stringify(s.cells), beforeCells); assert.equal(s.farm.cash, cash);
  for (const invalid of [NaN, -1, 0.5, 0x100000000]) {
    funds.expansionFunds = invalid; assert.throws(() => beginTownExpansion(s, funds));
  }
});
