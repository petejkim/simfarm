import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { createInventoryItem } from '../src/simulation/harvest-storage';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { toggleBuildingInterior } from '../src/simulation/building-storage';
import { checkSupplyPickup, checkSupplyMove, moveManualSupply, type SupplyMoveKind, type SupplyMoveTarget } from '../src/simulation/manual-supply-move';
import { ageInventoryAndRefillTroughs } from '../src/simulation/weekly-inventory';
import { consumeChemical } from '../src/simulation/chemicals';
import { sellStoredHarvest } from '../src/simulation/harvest-sale';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const b of world.buildings) b.flags = 0;
  for (const e of world.equipment) e.flags = 0;
  for (const i of world.inventory) i.bytes[10] &= ~32;
  for (const c of world.chemicals) c.bytes[2] &= ~32;
  for (const c of world.cells) Object.assign(c, { terrain: 0xa00f, overlay: 0x8800, attribute: 0x34 });
  world.farm.cash = 100000; world.farm.autoClear = false;
  for (const d of [...world.seedDefinitions, ...world.harvestDefinitions, ...world.chemicalDefinitions, ...finances.accounts.otherDefinitions]) d.count = 0;
  return { world, finances };
}
function goods(f: ReturnType<typeof setup>, type: number, x = 10, y = 10, quantity = 512) {
  const { world: w, finances: a } = f, chemical = type >= 220 && type <= 223;
  const kind: SupplyMoveKind = chemical ? 'chemical' : type >= 192 && type < 208 ? 'seed' : type < 184 ? 'harvest' : type === 299 ? 'trough' : 'feed';
  const d = chemical ? w.chemicalDefinitions[type - 220] : kind === 'seed' ? w.seedDefinitions[type - 192]
    : kind === 'harvest' ? w.harvestDefinitions[type - 168] : a.accounts.otherDefinitions[type - 288];
  const image = chemical ? 915 - type + 220 : kind === 'seed' ? 832 + type - 192 : kind === 'harvest' ? 816 + type - 168 : type === 299 ? 175 + Number(quantity > 0) : 1020;
  const item = chemical ? w.chemicals.find(c => c.slot && !c.active)! : createInventoryItem(w, type, quantity, 9, x, y)!;
  if (chemical) {
    const v = new DataView(item.bytes.buffer, item.bytes.byteOffset); v.setUint16(0, type, true);
    item.bytes[2] = 32; item.bytes[5] = x; item.bytes[6] = y;
  }
  d.count++;
  const cell = w.cells[worldIndex(x, y)];
  if (chemical || kind === 'feed') { cell.terrain |= 0x800; cell.overlay = (cell.overlay & 0xf800) | image; }
  else cell.terrain = (cell.terrain & 0xf800) | image;
  return { item, kind, d, image };
}
const selected = (f: ReturnType<typeof setup>, x = 10, y = 10) => {
  const s = checkSupplyPickup(f.world, f.finances, x, y); assert.ok(s.ok); return s;
};

test('supply movement pins original pickup graphics, distinct seed/harvest types, storage grouping and feed thresholds', () => {
  const exe = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x1a5ca, '2683bf00844074082683bf008441750e817ee6a8007c07817ee6bf007e14817ee6c0007d03e91401817ee6d7007e03e90a01');
  exact(0x1a69d, '8a46082688873a84'); exact(0x1a86a, '817ee62c017540');
  exact(0x13a50, '9a8401031383c4048e0688c726a3bcf7c706ca238a74c706cc23'); exact(0x13b6d, '26c706bef70000');
  exact(0x143ea, '2683bfc0d56673248e06a4c7'); exact(0x14427, '2681bfc0d5ce007324');
  exact(0x14465, '2681bfc0d534017322'); exact(0x144a1, '2681bfc0d59a017324'); exact(0x143cc, '9aaa10e624');
  for (let graphic = 74; graphic <= 77; graphic++) assert.equal(exe.readUInt16LE(0x4ec60 + 0x85e + graphic * 2), 915 - graphic + 74);
  for (let id = 0; id < 8; id++) {
    const f = setup(id);
    assert.deepEqual(f.world.seedDefinitions.map(d => d.type), Array.from({ length: 16 }, (_, i) => 192 + i));
    assert.deepEqual(f.world.harvestDefinitions.map(d => d.type), Array.from({ length: 16 }, (_, i) => 168 + i));
    for (const [definitions, start] of [[f.world.seedDefinitions, 832], [f.world.harvestDefinitions, 816]] as const)
      definitions.forEach((d, i) => assert.equal(exe.readUInt16LE(0x4ec60 + 0x85e + d.graphic * 2), start + i));
  }
});

test('every original seed, harvest, chemical and supply moves on all eight farms with exact raw bytes, map words and unchanged finances', () => {
  const types = [...Array.from({ length: 16 }, (_, i) => 168 + i), ...Array.from({ length: 16 }, (_, i) => 192 + i), 220, 221, 222, 223, 299, 300];
  for (let id = 0; id < 8; id++) {
    const f = setup(id), w = f.world;
    for (const type of types) {
      const { item, kind, image } = goods(f, type), raw = Uint8Array.from(item.bytes), s = selected(f);
      const before = JSON.stringify(f.finances), cash = w.farm.cash;
      w.cells[worldIndex(20, 20)].terrain = 0x601f; w.cells[worldIndex(20, 20)].overlay = 0x4800;
      assert.deepEqual(moveManualSupply(w, f.finances, s, 20, 20, -2), { ok: true, kind, slot: item.slot, x: 20, y: 20, buildingSlot: null, deleted: false });
      raw[kind === 'chemical' ? 5 : 8] = 20; raw[kind === 'chemical' ? 6 : 9] = 20; assert.deepEqual(item.bytes, raw);
      const old = w.cells[worldIndex(10, 10)], cell = w.cells[worldIndex(20, 20)];
      assert.equal(old.terrain, kind === 'feed' ? 0xa00f : 0xa01a);
      if (kind === 'chemical') assert.equal(old.overlay, 0x881a);
      if (kind === 'feed') assert.equal(old.overlay, 0x8813);
      assert.equal(cell.terrain, kind === 'chemical' || kind === 'feed' ? 0x681f : 0x6000 | image);
      assert.equal(cell.overlay, kind === 'chemical' || kind === 'feed' ? 0x4800 | image : 0x4800);
      assert.equal(w.farm.cash, cash); assert.equal(JSON.stringify(f.finances), before);
      item.bytes[kind === 'chemical' ? 2 : 10] &= ~32;
      Object.assign(old, { terrain: 0xa00f, overlay: 0x8800 });
    }
  }
});

test('all building types preserve source compatibility; first-fit insertion precedes same-building withdrawal and the byte slot boundary is atomic', () => {
  for (const type of [168, 192, 220]) for (let buildingType = 64; buildingType <= 72; buildingType++) {
    const f = setup(), { world: w, finances: a } = f;
    assert.ok(purchaseBuilding(w, a, buildingType, 20, 20, 0).ok);
    const { item, image } = goods(f, type), s = selected(f);
    const accepts = type === 192 || (type === 168 && buildingType <= 69) || (type === 220 && buildingType >= 66 && buildingType <= 69);
    const before = JSON.stringify([w, a]), result = moveManualSupply(w, a, s, 20, 20, 0);
    assert.equal(result.ok, accepts, `${type} into${buildingType}`);
    if (!result.ok) { assert.equal(result.reason, 'incompatible-storage'); assert.equal(JSON.stringify([w, a]), before); continue; }
    assert.deepEqual([item.x, item.y], [20, 20]); assert.deepEqual(w.buildings[1].content(0), { graphic: image, type, slot: item.slot });
    if (type === 220) assert.equal(item.bytes[2] & 4, 4);
    else assert.equal(item.bytes[10] & 4, 0); // Source crop insertion does not set stored flag.
  }
  const f = setup(), { world: w, finances: a } = f;
  assert.ok(purchaseBuilding(w, a, 65, 20, 20, 0).ok); const { item } = goods(f, 168);
  assert.ok(moveManualSupply(w, a, selected(f), 20, 20, 0).ok); toggleBuildingInterior(w.buildings[1], w);
  assert.ok(moveManualSupply(w, a, selected(f, 20, 20), 21, 21, 0).ok);
  assert.deepEqual([item.x, item.y], [20, 21]); assert.equal(w.buildings[1].content(0).type, -1); assert.equal(w.buildings[1].content(1).slot, item.slot);
  // Full source building cannot count the selected item's cell as free before insertion.
  for (const i of [0, 3, 4]) w.buildings[1].setContent(i, 217, -2, 0);
  const before = JSON.stringify([w, a]); assert.deepEqual(moveManualSupply(w, a, selected(f, 20, 21), 20, 20, 0), { ok: false, reason: 'no-storage-space' });
  assert.equal(JSON.stringify([w, a]), before);
  const second = setup(); for (let i = 1; i < 256; i++) second.world.inventory[i].bytes[10] |= 32;
  const high = goods(second, 192); assert.equal(high.item.slot, 256);
  assert.ok(purchaseBuilding(second.world, second.finances, 64, 20, 20, 0).ok);
  assert.deepEqual(moveManualSupply(second.world, second.finances, selected(second), 20, 20, 0), { ok: false, reason: 'storage-slot-overflow' });
  assert.ok(moveManualSupply(second.world, second.finances, selected(second), 30, 30, 0).ok); // Full inventory index remains valid outdoors.
});

test('feed quantity boundaries choose every original image; empty feed removal preserves other bytes and decrements its count once', () => {
  for (const [quantity, image] of [[0, 19], [1, 1024], [101, 1024], [102, 1023], [205, 1023], [206, 1022], [307, 1022], [308, 1021], [409, 1021], [410, 1020], [65535, 1020]]) {
    const f = setup(), w = f.world, { item, d } = goods(f, 300, 10, 10, quantity), raw = Uint8Array.from(item.bytes);
    const result = moveManualSupply(w, f.finances, selected(f), 20, 20, -128); assert.ok(result.ok);
    assert.equal(result.deleted, quantity === 0); raw[8] = raw[9] = 20; if (!quantity) raw[10] &= ~32;
    assert.deepEqual(item.bytes, raw); assert.equal(d.count, quantity ? 1 : 0);
    assert.equal(w.cells[worldIndex(20, 20)].overlay, 0x8800 | image);
    assert.equal(w.cells[worldIndex(20, 20)].terrain, quantity ? 0xa80f : 0xa013);
  }
});

test('selection and rejected drops are atomic at ownership, image/type, identity, definition and occupied-trough boundaries', () => {
  const f = setup(), w = f.world, { item } = goods(f, 299), s = selected(f);
  const reject = (x: number, y: number, reason: string, selection: SupplyMoveTarget = s) => {
    const before = JSON.stringify(f);
    assert.deepEqual(moveManualSupply(w, f.finances, selection, x, y, 0), { ok: false, reason }); assert.equal(JSON.stringify(f), before);
  };
  for (const [x, y] of [[NaN, 0], [96, 0], [0, -1], [0.1, 0]]) reject(x, y, 'outside-map');
  w.cells[worldIndex(20, 20)].overlay = 0; reject(20, 20, 'not-owned'); w.cells[worldIndex(20, 20)].overlay = 0x800;
  for (let tile = 0; tile < 2048; tile++) {
    w.cells[worldIndex(20, 20)].terrain = tile;
    assert.equal(checkSupplyMove(w, f.finances, s, 20, 20, 0).ok, tile >= 15 && tile <= 31);
  }
  w.cells[worldIndex(20, 20)].terrain = 0x80f; reject(20, 20, 'blocked-terrain');
  w.cells[worldIndex(20, 20)].terrain = 15; reject(20, 20, 'target-changed', { ...s, slot: 2 });
  item.bytes[10] &= ~32; reject(20, 20, 'inconsistent-supply'); item.bytes[10] |= 32;
  const before = JSON.stringify(f); assert.deepEqual(checkSupplyPickup(w, f.finances, 10, 10), s); assert.equal(JSON.stringify(f), before);
  assert.throws(() => moveManualSupply(w, f.finances, s, 20, 20, 128), /soil/); assert.equal(JSON.stringify(f), before);
  f.finances.accounts.otherDefinitions[11].bytes[8] = 2; reject(20, 20, 'inconsistent-supply');
});

test('stored trough/feed departure clears its content only after accepted drop and retains original floor (SF-116)', () => {
  for (const type of [299, 300]) {
    const f = setup(), w = f.world, a = f.finances;
    assert.ok(purchaseBuilding(w, a, 67, 20, 20, 0).ok); const { item, image } = goods(f, type, 20, 20);
    w.buildings[1].setContent(0, image, type, item.slot); toggleBuildingInterior(w.buildings[1], w);
    const before = JSON.stringify(f), s = selected(f, 20, 20); assert.equal(JSON.stringify(f), before);
    assert.deepEqual(moveManualSupply(w, a, s, 20, 20, 0), { ok: false, reason: type === 300 ? 'incompatible-storage' : 'blocked-terrain' });
    assert.equal(JSON.stringify(f), before);
    assert.ok(moveManualSupply(w, a, s, 30, 30, 0).ok); assert.equal(w.buildings[1].content(0).type, -1);
    assert.equal(w.cells[worldIndex(20, 20)].terrain, 217); assert.deepEqual([item.x, item.y], [30, 30]);
  }
});

test('relocated harvest remains sellable and chemicals consumable; original crop-loss flag behavior is retained', () => {
  const f = setup(), w = f.world, a = f.finances;
  assert.ok(purchaseBuilding(w, a, 67, 20, 20, 0).ok);
  const crop = goods(f, 168); assert.ok(moveManualSupply(w, a, selected(f), 20, 20, 0).ok);
  assert.deepEqual([crop.item.x, crop.item.y], [20, 20]); ageInventoryAndRefillTroughs(w); assert.equal(w.inventory[crop.item.slot].loss, 13);
  assert.ok(sellStoredHarvest(w, crop.item.slot, 0).ok); assert.equal(w.buildings[1].content(0).type, -1);
  const chemical = goods(f, 220); assert.ok(moveManualSupply(w, a, selected(f), 20, 20, 0).ok);
  // Chemical point selection is available in a closed building, exactly as the source finder.
  assert.ok(moveManualSupply(w, a, selected(f, 20, 20), 30, 30, 0).ok); assert.equal(chemical.item.bytes[2] & 4, 4);
  assert.deepEqual(consumeChemical(w, 220, 0), { ok: true, source: 'stored', cost: 0 }); assert.equal(w.buildings[1].content(0).type, -1);
});

test('unsupported saved storage graphics fail before insertion or withdrawal changes any canonical state', () => {
  const f = setup(), w = f.world, a = f.finances;
  assert.ok(purchaseBuilding(w, a, 67, 20, 20, 0).ok); goods(f, 220);
  const original = w.buildingDefinitions[3].bytes[0], picked = selected(f);
  w.buildingDefinitions[3].bytes[0] = 255;
  let before = JSON.stringify(f);
  assert.deepEqual(moveManualSupply(w, a, picked, 20, 20, 0), { ok: false, reason: 'inconsistent-supply' });
  assert.equal(JSON.stringify(f), before);
  w.buildingDefinitions[3].bytes[0] = original;
  assert.ok(moveManualSupply(w, a, picked, 20, 20, 0).ok); const stored = selected(f, 20, 20);
  w.buildingDefinitions[3].bytes[0] = 255; before = JSON.stringify(f);
  assert.deepEqual(moveManualSupply(w, a, stored, 30, 30, 0), { ok: false, reason: 'inconsistent-supply' });
  assert.equal(JSON.stringify(f), before);
});

test('original supply warning branches use the shared uhoh helper',()=>{
  const exe=source('SIMFARM.EXE');
  for(const [address,offset] of [[0x13c22,0x2379],[0x13e4d,0x238b],[0x13f99,0x2394],[0x14055,0x239d],[0x14181,0x23a6],[0x1429b,0x23af],[0x142af,0x23b8],[0x144f1,0x23c1]]){
    assert.equal(exe[address],0x68);assert.equal(exe.readUInt16LE(address+1),offset);
    assert.equal(exe.subarray(0x846f0+offset,0x846f0+offset+9).toString(),'uhoh.voc\0');
    assert.equal(exe[address+3],0xe9);assert.equal(address+6+exe.readInt16LE(address+4),0x13728);
  }
  assert.equal(exe.subarray(0x13728,0x1372d).toString('hex'),'9ab6082a21');
  // Chemical and inventory insertion rejection, and explicit feed/storage gate.
  assert.equal(exe.subarray(0x13da7,0x13dae).toString('hex'),'0bc07503e99e00');
  assert.equal(exe.subarray(0x13fd7,0x13fdb).toString('hex'),'0bc07479');
  assert.equal(exe.subarray(0x142a6,0x142ae).toString('hex'),'26833ec0f7007408');
});
