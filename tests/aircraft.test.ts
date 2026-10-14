import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { aircraftChemical, aircraftFuel, aircraftPayload, checkAircraftPurchase, checkAircraftService,
  createAircraftServiceState, purchaseAircraft, serviceAircraft, type AircraftServiceAction } from '../src/simulation/aircraft';
import { sellEquipment } from '../src/simulation/asset-sale';
import { constructTownDistrict } from '../src/simulation/town-construction';
import { originalTownLayouts } from './support/game';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes), service = createAircraftServiceState();
  for (const e of world.equipment) e.flags = 0;
  world.equipmentDefinitions[8].ownedCount = 0; world.regionalConditions.fill(0);
  world.farm.cash = 100000; finances.town.airportCount = 1;
  world.regionalConditions[(1 * 12 + 1) * 7] = 5; world.regionalConditions[(1 * 12 + 1) * 7 + 1] = 2;
  return { world, finances, service };
}
function buy(f: ReturnType<typeof setup>) {
  const p = purchaseAircraft(f.world, f.finances); assert.ok(p.ok); return f.world.equipment[p.slot];
}

test('aircraft source pins airport scan, separate plane painting, service rates and distinct product widths', () => {
  const b = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(b.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x30dd3, '803ec66400'); exact(0x30e70, '9ab410e624');
  exact(0x30ea1, '26c7873004470026c787f004480026c78732046f0026c787f2047000');
  exact(0x309c1, 'b8ff008e06b4ca262b0650faf726f6656a00506aff');
  exact(0x30d4d, 'a0f865988bc88e06b2ca26a14efaf7e16a00506aff');
  exact(0x30cef, 'b8ff008e06b6ca262b0652fa8e06acca26f7264cfa52506aff');
  exact(0x30a21, '268b87daa68e06acca26f7264cfa6a00506aff9ac801661a');
  exact(0x846f0 + 0x65f6, '01000a00dd008e739061');
  exact(0x1ca5e, '837e06ff750a2906ac3e1916ae3ec9cb');
});

test('all source farms purchase airport aircraft with original records, parking order, ledgers and saved unknown bytes', () => {
  for (let id = 0; id < 8; id++) {
    const f = setup(id), { world: w, finances: a } = f;
    const before = w.cells.map(c => ({ ...c })); w.equipment[1].bytes.fill(0xa5); w.equipment[1].flags = 0;
    w.farm.timerTicks = 4321; w.equipmentDefinitions[8].ownedCount = 65535;
    a.accounts.equipmentExpenses = a.accounts.assets.equipmentBookValue = 0xfffffff0;
    const e = buy(f); assert.deepEqual([e.type, e.flags, e.x, e.y, e.timestamp], [8, 160, 11, 14, 4321]);
    assert.deepEqual([...e.bytes.slice(50)], [11, 14, 0, 2, 2, 0]);
    assert.equal(e.bytes[7], 0xa5); assert.equal(e.bytes[23], 0xa5); assert.equal(aircraftFuel(e), 0); assert.equal(aircraftPayload(e), 0);
    assert.equal(aircraftChemical(e), 0); assert.equal(w.equipmentDefinitions[8].ownedCount, 0);
    assert.equal(a.accounts.equipmentExpenses, 5984); assert.equal(a.accounts.assets.equipmentBookValue, 5984);
    assert.equal(w.farm.cash, 94000); assert.equal(w.regionalConditions[13 * 7], 0x25);
    for (const [x, y, tile] of [[11, 14, 71], [12, 14, 72], [11, 15, 111], [12, 15, 112]]) before[worldIndex(x, y)].terrain = tile;
    assert.deepEqual(w.cells, before);
    const next = buy(f); assert.deepEqual([next.x, next.y], [13, 14]); assert.equal(w.regionalConditions[13 * 7], 0x65);
    assert.deepEqual(checkAircraftPurchase(w, a), { ok: false, reason: 'no-parking' });
  }
});

test('airport construction flags, first-fit region order, capacity and rejected cash/parking state are respected', () => {
  const f = setup(), { world: w, finances: a } = f;
  w.regionalConditions.fill(0); a.town.airportCount = 0;
  assert.deepEqual(checkAircraftPurchase(w, a), { ok: false, reason: 'no-airport' });
  assert.ok(constructTownDistrict(w, a.town, originalTownLayouts, { regionX: 11, regionY: 11 }, 5).ok);
  assert.equal(w.regionalConditions[143 * 7], 0xa5); // Original new airport already sets bit0x20; do not invent a second free pad.
  w.farm.cash = 5999; const before = JSON.stringify(f);
  assert.deepEqual(purchaseAircraft(w, a), { ok: false, reason: 'insufficient-cash' }); assert.equal(JSON.stringify(f), before);
  w.farm.cash = 6000; const e = buy(f); assert.deepEqual([e.x, e.y], [93, 94]); assert.equal(w.farm.cash, 0);
  w.farm.cash = 100000; assert.ok(sellEquipment(w, a.accounts.assets, e.slot, 0).ok); // Sale releases this pad.
  const rebought = buy(f); assert.deepEqual([rebought.x, rebought.y], [93, 94]);
  w.regionalConditions[143 * 7] &= ~0x40;
  assert.deepEqual(checkAircraftPurchase(w, a), { ok: false, reason: 'parking-conflict' });
  w.regionalConditions[13 * 7] = 5; w.regionalConditions[12 * 7] = 5; w.regionalConditions[13 * 7+1] = w.regionalConditions[12 * 7+1] = 2;
  assert.equal(checkAircraftPurchase(w, a).ok, true); const earlier = buy(f); assert.deepEqual([earlier.x, earlier.y], [11, 6]);
  for (const e of w.equipment.slice(1)) e.flags |= 32;
  assert.deepEqual(checkAircraftPurchase(w, a), { ok: false, reason: 'no-equipment-slots' });
});

test('fuel, repair, all three payload choices, refunds and unchanged actions use original accounts and retained bytes', () => {
  const f = setup(), e = buy(f), { world: w, finances: a, service: s } = f;
  const v = new DataView(e.bytes.buffer); e.bytes[17] = 200; v.setUint16(18, 4, true); a.annual.otherExpenses = 0;
  const run = (action: AircraftServiceAction) => serviceAircraft(w, a, s, e.slot, action);
  assert.deepEqual(run({ kind: 'fuel' }), { ok: true, slot: 1, price: 255, refund: 0, changed: true }); assert.equal(aircraftFuel(e), 255);
  assert.ok(run({ kind: 'repair' }).ok); assert.equal(e.condition, 0); assert.equal(v.getUint16(18, true), 4);
  assert.equal(a.annual.otherExpenses, 2255);
  for (const type of [221, 222, 223]) {
    const result = run({ kind: 'chemical', chemicalType: type }); assert.ok(result.ok);
    assert.equal(result.refund, type === 221 ? 0 : 5100);
    assert.ok(run({ kind: 'load' }).ok); assert.equal(aircraftPayload(e), 255); assert.equal(aircraftChemical(e), type);
    assert.equal(a.annual.otherExpenses, 7355);
    assert.deepEqual(run({ kind: 'load' }), { ok: true, slot: 1, price: 0, refund: 0, changed: false });
  }
  assert.equal(w.farm.cash, 94000 - 7355);
  assert.equal(w.farm.chemicalExpenses, setup().world.farm.chemicalExpenses); // Aircraft services post to other expenses, not field supplies.
  v.setUint16(32, 3, true); w.chemicalDefinitions[3].price = 65535; w.farm.cash = 9_999_990; a.annual.otherExpenses = 0;
  assert.deepEqual(run({ kind: 'chemical', chemicalType: 221 }), { ok: true, slot: 1, price: 0, refund: 19659, changed: true });
  assert.equal(w.farm.cash, 9_999_999); assert.equal(a.annual.otherExpenses, (-19659) >>> 0); assert.equal(aircraftChemical(e), 223);
  w.chemicalDefinitions[1].price = 0;
  assert.deepEqual(run({ kind: 'load' }), { ok: true, slot: 1, price: 0, refund: 0, changed: false }); assert.equal(aircraftPayload(e), 0);
});

test('service failures are atomic and selector price remains shared across planes, independently of loaded type', () => {
  const f = setup(), first = buy(f), second = buy(f), { world: w, finances: a, service: s } = f;
  const reject = (slot: number, action: AircraftServiceAction, reason: string) => {
    const before = JSON.stringify(f); assert.deepEqual(serviceAircraft(w, a, s, slot, action), { ok: false, reason }); assert.equal(JSON.stringify(f), before);
  };
  reject(0, { kind: 'repair' }, 'not-aircraft'); reject(first.slot, { kind: 'chemical', chemicalType: 220 }, 'invalid-service');
  first.flags |= 2; reject(first.slot, { kind: 'fuel' }, 'not-parked'); first.flags &= ~2;
  const v = new DataView(first.bytes.buffer); v.setUint16(20, 256, true); reject(first.slot, { kind: 'fuel' }, 'invalid-supplies'); v.setUint16(20, 0, true);
  w.farm.cash = 254; reject(first.slot, { kind: 'fuel' }, 'insufficient-cash'); w.farm.cash = 100000;
  assert.ok(serviceAircraft(w, a, s, first.slot, { kind: 'load' }).ok);
  assert.ok(serviceAircraft(w, a, s, second.slot, { kind: 'chemical', chemicalType: 223 }).ok);
  w.chemicalDefinitions[3].price = 65535;
  // Source refund uses the shared223 price even though plane1 still carries221; high word is discarded.
  assert.deepEqual(serviceAircraft(w, a, s, first.slot, { kind: 'chemical', chemicalType: 222 }),
    { ok: true, slot: 1, price: 0, refund: (255 * 6553) & 65535, changed: true });
  assert.equal(aircraftPayload(first), 0); assert.equal(aircraftChemical(first), 221);
  w.chemicalDefinitions[2].price = 65535; w.farm.cash = 2_000_000;
  assert.deepEqual(checkAircraftService(w, a, s, first.slot, { kind: 'load' }), { ok: true, slot: 1, price: 255 * 6553, refund: 0, changed: true });
});


test('aircraft purchase excludes demolished airport remnants even while another airport exists',()=>{
  const {world,finances}=setup();world.regionalConditions[13*7+1]=0;
  world.regionalConditions[26*7]=5;world.regionalConditions[26*7+1]=2;
  const result=checkAircraftPurchase(world,finances);assert.ok(result.ok);assert.deepEqual([result.x,result.y],[19,22]);
  world.regionalConditions[26*7+1]=0;assert.deepEqual(checkAircraftPurchase(world,finances),{ok:false,reason:'no-parking'});
});
