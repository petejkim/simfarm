import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readAssetSaleState } from '../src/formats/asset-sale';
import { readAnimalDefinitions } from '../src/formats/animal';
import { animalSaleQuote, equipmentSaleQuote, sellAnimal, sellEquipment } from '../src/simulation/asset-sale';
import { findBuilding } from '../src/simulation/building-storage';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const word = (bytes: Uint8Array, offset: number, value: number) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(offset, value, true);
function setup(id = 4) { const bytes = source(`SCEN${id}.SSM`); return { bytes, world: readScenario(bytes), state: readAssetSaleState(bytes) }; }
function loose(kind: 'animal' | 'equipment' = 'equipment') {
  const result = setup(), { world, state } = result;
  world.buildings.forEach(b => b.flags &= ~32); world.equipment.forEach(e => e.flags &= ~32);
  const e = world.equipment[1], a = world.animals[1]; e.bytes.fill(0); a.bytes.fill(0);
  e.flags = 0xa0; e.bytes[5] = 40; e.bytes[6] = 40;
  a.flags = 0xa0; a.bytes[0] = 40; a.bytes[1] = 40; word(a.bytes, 6, 160); a.bytes[8] = 255;
  world.equipmentDefinitions[0].ownedCount = 1; state.animalDefinitions[0].count = 1;
  if (kind === 'animal') e.flags = 0;
  for (const c of world.cells) { c.terrain = 0xb80f; c.overlay = 0xa351; c.attribute = 40; }
  return { ...result, e, a };
}

test('asset definitions and ledgers match bounded source records and exact valuation/sale instructions', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x458f3, '05e270'); exact(0x45905, '837ef005');
  exact(0x45c83, '68503e'); exact(0x45d13, '68643e'); exact(0x45d5b, '68743e');
  exact(0x11946, 'c0e806'); exact(0x1195a, 'd3ea'); exact(0x1299a, 'c0e806');
  exact(0x4c502, '99'); exact(0x4c5a5, '99'); exact(0x4c4e7, 'f6c109');
  exact(0x3a086, 'ff8fbc6d'); exact(0x3a131, 'ff8fa665'); exact(0x31a98, '2680a79c94df');
  for (let id = 0; id < 8; id++) {
    const { bytes, state } = setup(id);
    assert.equal(state.equipmentBookValue, bytes.readUInt32LE(0x2167c));
    assert.equal(state.equipmentIncome, bytes.readUInt32LE(0x21694)); assert.equal(state.livestockIncome, bytes.readUInt32LE(0x216a0));
    state.animalDefinitions.forEach((def, i) => assert.deepEqual(Buffer.from(def.bytes), bytes.subarray(0x20cbe + i * 18, 0x20cbe + (i + 1) * 18)));
    assert.equal(state.animalDefinitions[4].type, 163); // Preserve the duplicate source type.
    state.animalDefinitions[0].bytes.fill(255); assert.notEqual(bytes[0x20cbe], 255);
  }
  assert.throws(() => readAnimalDefinitions(new Uint8Array(0x20d17)));
  assert.throws(() => readAssetSaleState(new Uint8Array(0x216a3)));
});

test('equipment depreciation and livestock valuation cover all condition bytes and word arithmetic boundaries', () => {
  const { world, state, e, a } = loose();
  for (const price of [0, 1, 32767, 32768, 65535]) for (let c = 0; c < 256; c++) {
    word(world.equipmentDefinitions[0].bytes, 6, price); e.bytes[17] = c;
    assert.deepEqual(equipmentSaleQuote(e, world.equipmentDefinitions), { value: price >>> (c >>> 6), conditionBand: 3 - (c >>> 6) });
  }
  for (let type = 160; type <= 164; type++) for (const units of [0, 1, 13107, 13108, 21846, 32768, 65535]) for (const price of [0, 880, 65535]) {
    word(a.bytes, 6, type); word(a.bytes, 10, units); state.animalDefinitions[type - 160].price = price;
    for (let c = 0; c < 256; c++) {
      a.bytes[8] = c;
      const bonus = (units * [3, 5, 3, 2, 0][type - 160]) % 65536;
      assert.deepEqual(animalSaleQuote(a, state.animalDefinitions), { value: Math.floor((price + bonus) / 2 ** (3 - (c >>> 6))) % 65536, conditionBand: c >>> 6 });
    }
  }
  word(a.bytes, 6, 165); assert.throws(() => animalSaleQuote(a, state.animalDefinitions));
});

test('every original animal and equipment asset can be sold with source ledgers, storage cleanup and retained unknown bytes', () => {
  let animals = 0, machines = 0, stored = 0;
  for (let id = 0; id < 8; id++) {
    const original = setup(id).world;
    for (const animal of original.animals.filter(a => a.active)) {
      const { world, state } = setup(id), a = world.animals[animal.slot], before = Uint8Array.from(a.bytes);
      const quote = animalSaleQuote(a, state.animalDefinitions).value, count = state.animalDefinitions[a.type - 160].count;
      const b = findBuilding(world, a.x, a.y), flags = b?.flags, index = b ? (a.x - b.x) * 3 + a.y - b.y : 0;
      const c = { ...world.cells[worldIndex(a.x, a.y)] };
      assert.deepEqual(sellAnimal(world, state, a.slot), { ok: true, slot: a.slot, value: quote });
      assert.equal(world.farm.cash, original.farm.cash + quote); assert.equal(state.livestockIncome, quote);
      assert.equal(world.farm.salesAccumulator, original.farm.salesAccumulator + quote);
      assert.equal(state.animalDefinitions[a.type - 160].count, count - 1);
      before[2] &= ~32; assert.deepEqual(a.bytes, before);
      if (b) { stored++; assert.equal(b.content(index).type, -1); assert.equal(b.flags, flags); }
      else { assert.equal(world.cells[worldIndex(a.x, a.y)].terrain, c.terrain & 0xf7ff); assert.equal(world.cells[worldIndex(a.x, a.y)].overlay, c.overlay); }
      assert.equal(sellAnimal(world, state, a.slot).ok, false); animals++;
    }
    for (const machine of original.equipment.filter(e => e.active)) {
      const { world, state } = setup(id), e = world.equipment[machine.slot], before = Uint8Array.from(e.bytes);
      const def = world.equipmentDefinitions[e.type], count = def.ownedCount, book = state.equipmentBookValue;
      const quote = equipmentSaleQuote(e, world.equipmentDefinitions).value;
      assert.deepEqual(sellEquipment(world, state, e.slot, 8), { ok: true, slot: e.slot, value: quote });
      assert.equal(world.farm.cash, original.farm.cash + quote); assert.equal(state.equipmentIncome, quote);
      assert.equal(world.farm.salesAccumulator, original.farm.salesAccumulator + quote);
      assert.equal(def.ownedCount, count - 1); assert.equal(state.equipmentBookValue, (book - def.price) >>> 0);
      before[2] &= ~32; assert.deepEqual(e.bytes, before); machines++;
    }
  }
  assert.ok(animals > 80 && machines > 100 && stored > 0);
});

test('sale callers preserve signed word proceeds, cash cap and dword wrapping instead of crop-style unsigned credit', () => {
  for (const kind of ['animal', 'equipment'] as const) for (const price of [0, 32767, 32768, 65535]) for (const cash of [0, 40000, 9_999_999]) {
    const { world, state, e, a } = loose(kind);
    e.bytes[17] = 0; a.bytes[8] = 255;
    if (kind === 'animal') state.animalDefinitions[0].price = price; else word(world.equipmentDefinitions[0].bytes, 6, price);
    world.farm.cash = cash; world.farm.salesAccumulator = 0xffffffff;
    state.equipmentIncome = state.livestockIncome = 0xfffffff0;
    const value = price << 16 >> 16;
    assert.deepEqual(kind === 'animal' ? sellAnimal(world, state, 1) : sellEquipment(world, state, 1, 8), { ok: true, slot: 1, value });
    assert.equal(world.farm.cash, Math.min(9_999_999, (cash + value) >>> 0));
    assert.equal(world.farm.salesAccumulator, (0xffffffff + value) >>> 0);
    assert.equal(kind === 'animal' ? state.livestockIncome : state.equipmentIncome, (0xfffffff0 + value) >>> 0);
  }
});

test('equipment sale eligibility uses reserved/field-work bits and rentals retain owned count and book value', () => {
  for (const flags of [0x20, 0x22, 0x21, 0x28, 0x60]) {
    const { world, state, e } = loose(); e.flags = flags;
    const before = JSON.stringify([world, state]), book = state.equipmentBookValue;
    const result = sellEquipment(world, state, 1, 8);
    if (flags & 9) { assert.deepEqual(result, { ok: false, reason: 'asset-busy' }); assert.equal(JSON.stringify([world, state]), before); }
    else { assert.equal(result.ok, true); if (flags & 0x40) { assert.equal(world.equipmentDefinitions[0].ownedCount, 1); assert.equal(state.equipmentBookValue, book); } }
  }
});

test('aircraft removal restores the two-by-two home and only its source regional flag', () => {
  for (const hx of [3, 5, 7]) {
    const { world, state, e } = loose(); word(e.bytes, 0, 8);
    const def = world.equipmentDefinitions[8]; def.ownedCount = 1;
    e.bytes[50] = hx; e.bytes[51] = 10;
    world.regionalConditions[(0 * 12 + 1) * 7] = 0xe5;
    const quote = equipmentSaleQuote(e, world.equipmentDefinitions).value;
    assert.deepEqual(sellEquipment(world, state, 1, 2), { ok: true, slot: 1, value: quote });
    for (let x = hx; x < hx + 2; x++) for (let y = 10; y < 12; y++) assert.equal(world.cells[worldIndex(x, y)].terrain, 0xb817);
    assert.equal(world.regionalConditions[7], hx === 3 ? 0xc5 : hx === 5 ? 0xa5 : 0xe5);
    assert.equal(world.cells[worldIndex(40, 40)].terrain, 0xb81b); // 15 + moisture 2 + attribute/4 10.
  }
});

test('inconsistent counts, storage, links, coordinates and unsupported types reject sales before credit or mutation', () => {
  const cases: ((s: ReturnType<typeof loose>) => void)[] = [
    s => { s.world.equipmentDefinitions[0].ownedCount = 0; },
    s => { s.e.bytes[5] = 96; }, s => { s.e.attachment = 2; },
    s => { const other = s.world.equipment[2]; other.flags = 32; other.attachment = 1; },
    s => { word(s.e.bytes, 0, 8); s.world.equipmentDefinitions[8].ownedCount = 1; s.e.bytes[50] = 95; },
  ];
  for (const modify of cases) { const s = loose(); modify(s); const before = JSON.stringify(s); assert.equal(sellEquipment(s.world, s.state, 1, 8).ok, false); assert.equal(JSON.stringify(s), before); }
  for (const kind of ['animal', 'equipment'] as const) {
    const s = loose(kind); if (kind === 'animal') s.state.animalDefinitions[0].count = 0; else s.world.equipmentDefinitions[0].ownedCount = 0;
    const before = JSON.stringify(s);
    assert.equal((kind === 'animal' ? sellAnimal(s.world, s.state, 1) : sellEquipment(s.world, s.state, 1, 8)).ok, false);
    assert.equal(JSON.stringify(s), before);
  }
  const s = setup(5), a = s.world.animals.find(a => a.active && (a.flags & 4))!;
  word(a.bytes, 16, 0); const before = JSON.stringify(s);
  assert.deepEqual(sellAnimal(s.world, s.state, a.slot), { ok: false, reason: 'inconsistent-asset' }); assert.equal(JSON.stringify(s), before);
  for (const type of [159, 165, 255, 65535]) { const s = loose('animal'); word(s.a.bytes, 6, type); assert.equal(sellAnimal(s.world, s.state, 1).ok, false); }
});
