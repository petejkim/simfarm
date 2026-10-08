import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { checkEquipmentSale } from '../src/simulation/asset-sale';
import { checkManualAssetSale, sellManualAsset, type AssetSaleKind } from '../src/simulation/manual-asset-sale';
import { aircraftFixture } from './support/aircraft';
import { purchaseAircraft } from '../src/simulation/aircraft';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('original sale-list source excludes rented equipment, accepts active animals and routes all three displayed rows to generic sale', () => {
  const exe = source('SIMFARM.EXE'), exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x4bd7a, 'f6c1407403e94301f6c2207503'); exact(0x4bf3a, '26f6870264207503e93f01');
  exact(0x4c09c, '0bc07503e979fa487503e995fc487503e965fe');
  exact(0x4c2cf, '0ee8490183c406'); exact(0x4c345, '0ee8d30083c406'); exact(0x4c389, '0ee88f0083c406');
  exact(0x4c3ce, '360e'); // Widget action6 -> overlay offset0xe36 -> file0x4c286.
});

test('manual quotes are read-only and every original farm animal and owned machine posts the displayed signed receipt once', () => {
  let count = 0;
  for (let id = 0; id < 8; id++) for (const kind of ['animal', 'equipment'] as const) {
    const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
    const records = (kind === 'animal' ? world.animals : world.equipment).filter(r => r.active);
    const before = JSON.stringify([world, finances]);
    const quotes = records.map(record => checkManualAssetSale(world, finances, kind, record.slot, 2));
    assert.equal(JSON.stringify([world, finances]), before);
    for (const [index, record] of records.entries()) {
      const cash = world.farm.cash, ledger = kind === 'animal' ? 'livestockIncome' : 'equipmentIncome';
      const income = finances.accounts.assets[ledger], quote = quotes[index];
      assert.ok(quote.ok);
      const result = sellManualAsset(world, finances, kind, record.slot, 2); assert.deepEqual(result, quote);
      assert.equal(world.farm.cash, Math.min(9_999_999, (cash + quote.value) >>> 0));
      assert.equal(finances.accounts.assets[ledger], (income + quote.value) >>> 0);
      const afterCash = world.farm.cash, afterIncome = finances.accounts.assets[ledger];
      assert.equal(sellManualAsset(world, finances, kind, record.slot, 2).ok, false);
      assert.equal(world.farm.cash, afterCash); assert.equal(finances.accounts.assets[ledger], afterIncome); count++;
    }
  }
  assert.ok(count > 180);
});

test('manual sales reject rentals, in-use and inconsistent records atomically while generic rental semantics remain intact', () => {
  const f = aircraftFixture(), w = f.state.scenario, a = f.state.finances;
  assert.ok(purchaseAircraft(w, a).ok); const e = w.equipment[1];
  e.flags |= 64; assert.ok(checkEquipmentSale(w, a.accounts.assets, 1, 2).ok);
  let before = JSON.stringify([w, a]);
  assert.deepEqual(sellManualAsset(w, a, 'equipment', 1, 2), { ok: false, reason: 'rented-equipment' });
  assert.equal(JSON.stringify([w, a]), before);
  e.flags &= ~64; e.flags |= 1; before = JSON.stringify([w, a]);
  assert.deepEqual(sellManualAsset(w, a, 'equipment', 1, 2), { ok: false, reason: 'asset-busy' });
  assert.equal(JSON.stringify([w, a]), before);
  e.flags &= ~1; e.attachment = 2; before = JSON.stringify([w, a]);
  assert.deepEqual(sellManualAsset(w, a, 'equipment', 1, 2), { ok: false, reason: 'inconsistent-asset' });
  assert.equal(JSON.stringify([w, a]), before);
  for (const slot of [-1, 0, 127, NaN, 1.5]) assert.equal(checkManualAssetSale(w, a, 'equipment', slot, 2).ok, false);
  assert.equal(checkManualAssetSale(w, a, 'bad' as AssetSaleKind, 1, 2).ok, false);
  e.attachment = 0; const definition = w.equipmentDefinitions[8]; new DataView(definition.bytes.buffer, definition.bytes.byteOffset).setUint16(6, 65535, true);
  assert.deepEqual(checkManualAssetSale(w, a, 'equipment', 1, 2), { ok: true, slot: 1, value: -1 }); // SF-055: UI must show signed proceeds.
});
