import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { checkCropSupplyPurchase, purchaseCropSupply, CROP_SUPPLY_TYPES } from '../src/simulation/crop-supply-purchase';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { toggleBuildingInterior } from '../src/simulation/building-storage';
import { consumeSeed } from '../src/simulation/seeds';
import { consumeChemical } from '../src/simulation/chemicals';
import { checkSupplyPickup, moveManualSupply } from '../src/simulation/manual-supply-move';

const source = (n: string) => readFileSync(new URL(`../../simfarm-dos/${n}`, import.meta.url));
function setup(id = 4, buildingType = 67) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const b of world.buildings) b.flags = 0;
  for (const e of world.equipment) e.flags = 0;
  for (const i of world.inventory) i.bytes[10] &= ~32;
  for (const c of world.chemicals) c.bytes[2] &= ~32;
  for (const c of world.cells) Object.assign(c, { terrain: 15, overlay: 0x8800, attribute: 0 });
  for (const d of [...world.seedDefinitions, ...world.chemicalDefinitions]) d.count = 0;
  world.farm.cash = 100000; world.farm.autoClear = false;
  const built = purchaseBuilding(world, finances, buildingType, 10, 10, 0); assert.ok(built.ok);
  return { world, finances, building: world.buildings[built.slot] };
}
const reject = (f: ReturnType<typeof setup>, type: number, x: number, y: number, reason: string) => {
  const before = JSON.stringify(f);
  assert.deepEqual(purchaseCropSupply(f.world, type, x, y, 0), { ok: false, reason });
  assert.equal(JSON.stringify(f), before);
};

test('manual supply source evidence pins storage-only placement, initialization, price sign extension and constructor bounds', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x1cf28, '817e10dc007c07817e10df007e1c817e10c0007c07817e10d7007e0e817e10c0007c0d817e10d7007f066a45e99afe');
  exact(0x3a43a, '6a006a0aff7606ff760cff760a9a04000313');
  exact(0x145a5, '837efe7f7d5e'); exact(0x14606, '8b46fec9cb'); exact(0x1cb59, '8946fe9952');
  exact(0x145c7, '26c787c0ed00008a4606268887c3ed8a4608268887c4ed26c787c6ed000026c687c2ed0026c787ceed000026c787cced000026808fc0ed2026c787d0ed18008b46fe');
  exact(0x1cd55, '6bd8468e0686c82683bf0084467503e99d002683bf0084477503e992002683bf0084487503e98700');
  for (let i = 0; i < 16; i++) assert.equal(e.readUInt16LE(0x4ec60 + 0x85e + (87 + i) * 2), 832 + i);
  for (let i = 0; i < 4; i++) assert.equal(e.readUInt16LE(0x4ec60 + 0x85e + (74 + i) * 2), 915 - i);
});

test('all eight farms buy every seed and chemical with exact retained bytes, definition prices, first-fit content and wrapping ledgers', () => {
  for (let id = 0; id < 8; id++) {
    const f = setup(id), w = f.world, b = f.building;
    for (const type of CROP_SUPPLY_TYPES) {
      const chemical = type >= 220, d = chemical ? w.chemicalDefinitions[type - 220] : w.seedDefinitions[type - 192];
      const item = chemical ? w.chemicals[1] : w.inventory[1]; item.bytes.fill(0xa5); item.bytes[chemical ? 2 : 10] = 0;
      const expected = new Uint8Array(item.bytes.length).fill(0xa5), v = new DataView(expected.buffer);
      v.setUint16(0, type, true);
      if (chemical) {
        v.setUint16(2, 36, true); expected[4] = 0; expected[5] = expected[6] = 10;
        for (const o of [8, 14, 16]) v.setUint16(o, 0, true); v.setUint16(18, 24, true);
      } else {
        v.setUint16(2, 10, true); v.setUint16(4, 0, true); v.setUint16(6, 0, true);
        expected[8] = expected[9] = 10; expected[10] = 36;
      }
      const account = chemical ? 'chemicalExpenses' : 'seedExpenses'; w.farm[account] = 0xfffffff0; d.count = 65535;
      const cash = w.farm.cash, other = JSON.stringify(f.finances), map = structuredClone(w.cells);
      assert.deepEqual(purchaseCropSupply(w, type, 11, 11, 0), { ok: true, slot: 1, price: d.price, clearingCost: 0, buildingSlot: b.slot, x: 10, y: 10 });
      assert.deepEqual(item.bytes, expected); assert.equal(d.count, 0); assert.equal(w.farm.cash, cash - d.price);
      assert.equal(w.farm[account], (0xfffffff0 + d.price) >>> 0); assert.equal(JSON.stringify(f.finances), other);
      assert.deepEqual(b.content(0), { graphic: chemical ? 915 - type + 220 : 832 + type - 192, type, slot: 1 });
      if (chemical) map[worldIndex(10, 10)].overlay = (map[worldIndex(10, 10)].overlay & 0xf800) | (915 - type + 220);
      assert.deepEqual(w.cells, map); assert.deepEqual(w.sourceBytes, Uint8Array.from(source(`SCEN${id}.SSM`)));
      item.bytes[chemical ? 2 : 10] &= ~32; b.clearContent(0);
    }
  }
});

test('purchases obey the source building filter, first-fit order, full capacity and clicked-cell occupancy', () => {
  for (let type = 64; type <= 72; type++) {
    const f = setup(4, type);
    for (const supply of [192, 220]) {
      if (type >= 70) { reject(f, supply, 10, 10, type === 71 ? 'blocked-terrain' : 'storage-required'); continue; }
      if (supply === 220 && type < 66) { reject(f, supply, 10, 10, 'incompatible-storage'); continue; }
      const r = purchaseCropSupply(f.world, supply, 10, 10, 0); assert.ok(r.ok);
      assert.equal(r.x, 10); assert.equal(r.y, supply === 220 ? 11 : 10);
    }
  }
  const f = setup(), w = f.world, b = f.building; toggleBuildingInterior(b, w);
  assert.ok(purchaseCropSupply(w, 220, 10, 10, 0).ok); assert.equal(w.cells[worldIndex(10, 10)].overlay & 2047, 915);
  reject(f, 192, 10, 10, 'blocked-terrain');
  assert.ok(purchaseCropSupply(w, 192, 11, 10, 0).ok); assert.equal(b.content(1).type, 192);
  assert.equal(w.cells[worldIndex(10, 11)].terrain, 832);
  // A seed graphic has no occupancy bit; another click still inserts first-fit elsewhere.
  const next = purchaseCropSupply(w, 193, 10, 11, 0); assert.ok(next.ok); assert.deepEqual([next.x, next.y], [10, 12]);
  toggleBuildingInterior(b, w);
  for (let n = 0; n < 9; n++) b.setContent(n, 217, -2, 0);
  reject(f, 192, 10, 10, 'no-storage-space'); reject(f, 220, 10, 10, 'no-storage-space');
});

test('map, storage, slot256, full-table and malformed-definition failures leave records, terrain and finances unchanged', () => {
  const f = setup(), w = f.world;
  for (const t of [168, 208, 215, 219, 224, NaN, 192.5]) reject(f, t, 10, 10, 'unsupported-supply');
  for (const [x,y] of [[-1,0],[96,0],[0,NaN],[0,0.5]]) reject(f, 192, x, y, 'outside-map');
  for (const tile of [15,30,31,150,171,172,131,535]) { w.cells[worldIndex(20,20)].terrain = tile; w.farm.autoClear = true; reject(f,192,20,20,'storage-required'); }
  const c = w.cells[worldIndex(10,10)]; c.overlay = 0; reject(f,192,10,10,'not-owned'); c.overlay = 0x4800; reject(f,192,10,10,'not-owned'); c.overlay = 0x800;
  for (const i of w.inventory.slice(1,256)) i.bytes[10] |= 32;
  reject(f,192,10,10,'storage-slot-overflow');
  for (const i of w.inventory.slice(256)) i.bytes[10] |= 32;
  reject(f,192,10,10,'no-inventory-slots');
  for (const c of w.chemicals.slice(1)) c.bytes[2] |= 32;
  reject(f,220,10,10,'no-chemical-slots');
  w.chemicals[1].bytes[2] = 0; w.chemicalDefinitions[0].bytes[8] = 2;
  const before = JSON.stringify(f); assert.throws(() => purchaseCropSupply(w,220,10,10,0), /definition/); assert.equal(JSON.stringify(f),before);
  w.chemicalDefinitions[0].bytes[8] = 1; w.buildingDefinitions[3].bytes[0] = 255;
  const unsupported = JSON.stringify(f); assert.throws(() => purchaseCropSupply(w,220,10,10,0), /graphic/); assert.equal(JSON.stringify(f),unsupported);
});

test('manual prices permit exact cash, preserve signed-word arithmetic and charge only the selected supply ledger', () => {
  for (const type of [192,220]) for (const price of [0,1,200,32767,32768,65535]) {
    const f = setup(), w = f.world, d = type === 192 ? w.seedDefinitions[0] : w.chemicalDefinitions[0];
    new DataView(d.bytes.buffer,d.bytes.byteOffset).setUint16(6,price,true);
    const cost = (price << 16 >> 16) >>> 0;
    if (cost) { w.farm.cash = cost - 1; reject(f,type,10,10,'insufficient-cash'); }
    w.farm.cash = cost; assert.ok(purchaseCropSupply(w,type,10,10,0).ok); assert.equal(w.farm.cash,0);
  }
  const f = setup(), w = f.world; w.farm.autoClear = true; w.cells[worldIndex(10,10)].terrain = 535;
  const price = w.seedDefinitions[0].price, workers = w.farm.workerExpenses;
  w.farm.cash = price + 24; reject(f,192,10,10,'insufficient-cash');
  w.farm.cash++; const r = purchaseCropSupply(w,192,10,10,0); assert.ok(r.ok); assert.equal(r.clearingCost,25);
  assert.equal(w.farm.workerExpenses,workers+25); assert.equal(w.farm.cash,0);
});

test('purchased stock can be relocated and consumed by original seed and chemical handlers without automatic buying', () => {
  const f = setup(), w = f.world; w.farm.autoBuySeeds = false; toggleBuildingInterior(f.building,w);
  for (const type of CROP_SUPPLY_TYPES) {
    const r = purchaseCropSupply(w,type,12,12,0); assert.ok(r.ok);
    const cash = w.farm.cash, pick = checkSupplyPickup(w,f.finances,r.x,r.y); assert.ok(pick.ok);
    assert.ok(moveManualSupply(w,f.finances,pick,20,20,0).ok);
    const used = type >= 220 ? consumeChemical(w,type,0) : consumeSeed(w,type-192,0);
    assert.deepEqual(used,{ok:true,source:'stored',cost:0}); assert.equal(w.farm.cash,cash);
    assert.equal(f.building.content(0).type,-1);
    // Existing chemical consumption retains the secondary image; reset only fixture ground.
    Object.assign(w.cells[worldIndex(20,20)],{terrain:15,overlay:0x8800});
  }
  assert.equal(w.inventory.filter(i=>i.active).length,0); assert.equal(w.chemicals.filter(c=>c.active).length,0);
});
