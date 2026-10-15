import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { aircraftFixture } from './support/aircraft';
import { purchaseAircraft, serviceAircraft, createAircraftServiceState, aircraftChemical, aircraftPayload, AIRCRAFT_CHEMICALS } from '../src/simulation/aircraft';
import { advanceFlight, beginFlight } from '../src/simulation/aircraft-flight';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';

/** Native aerial fertilizer (user request; docs/aircraft.md "Aerial fertilizer"). */
test('fertilizer loads like the original chemicals: shared selection, full-load price and refund at the prior selection price', () => {
  const f = aircraftFixture(), w = f.state.scenario, a = f.state.finances, s = createAircraftServiceState();
  assert.deepEqual([...AIRCRAFT_CHEMICALS], [220, 221, 222, 223]);
  const p = purchaseAircraft(w, a); assert.ok(p.ok); const e = w.equipment[p.slot];
  assert.ok(serviceAircraft(w, a, s, p.slot, { kind: 'chemical', chemicalType: 220 }).ok); assert.equal(s.selectedChemical, 220);
  const unit = Math.floor(w.chemicalDefinitions[0].price / 10), cash = w.farm.cash;
  const load = serviceAircraft(w, a, s, p.slot, { kind: 'load' }); assert.ok(load.ok);
  assert.equal(load.price, 255 * unit); assert.equal(w.farm.cash, cash - 255 * unit);
  assert.equal(aircraftPayload(e), 255); assert.equal(aircraftChemical(e), 220);
  const back = serviceAircraft(w, a, s, p.slot, { kind: 'chemical', chemicalType: 221 }); assert.ok(back.ok);
  assert.equal(back.refund, (255 * unit) & 65535); assert.equal(aircraftPayload(e), 0);
});

test('each spraying hit applies the full ground fertilizer effect, capped at255, with no toxicity, pest or pressure change', () => {
  const f = aircraftFixture(), w = f.state.scenario, a = f.state.finances;
  const p = purchaseAircraft(w, a); assert.ok(p.ok); const e = w.equipment[p.slot], v = new DataView(e.bytes.buffer, e.bytes.byteOffset, e.bytes.length);
  v.setUint16(20, 255, true); v.setUint16(32, 255, true); v.setUint16(34, 220, true);
  const start = beginFlight(w, a, e.slot, 20, 16, 2, true); assert.ok(start.ok);
  const flight = start.flight, crops = f.crops.map(c => [...c.rawDefinition]), field = w.fields[1];
  field.bytes[7] |= 1; field.bytes[10] = 20; field.bytes[11] = 16; field.bytes[12] = 8; field.bytes[13] = 8; field.bytes[14] = 0;
  field.bytes.set([10, 20, 30], 29); field.bytes.set([100, 90, 80], 20); field.bytes.set([101, 102, 103], 60); field.bytes[32] = 10;
  const region = (3 * 12 + 2) * 7 + 6; w.regionalConditions[region] = 40; // field centre 24,20 → region3,2 fertility
  flight.heading = 2; flight.inputs.push('spray-on');
  const others = () => [...field.bytes.slice(20, 23), field.bytes[32], ...field.bytes.slice(60, 63)];
  const before = others(), cash = w.farm.cash;
  for (const tick of [2, 4, 6]) advanceFlight(w, a, crops, flight, tick);
  assert.deepEqual([...field.bytes.slice(29, 32)], [10, 20, 30]);
  advanceFlight(w, a, crops, flight, 8);
  assert.deepEqual([...field.bytes.slice(29, 32)], [255, 255, 255]); assert.equal(w.regionalConditions[region], 255);
  assert.deepEqual(others(), before); assert.equal(w.farm.cash, cash);
  for (const tick of [10, 12, 14, 16]) advanceFlight(w, a, crops, flight, tick); // a second hit stays capped
  assert.deepEqual([...field.bytes.slice(29, 32)], [255, 255, 255]); assert.deepEqual(others(), before);
});

test('checkpoints accept the fertilizer selection and still reject types outside220..223', () => {
  const f = aircraftFixture();
  for (const [selected, ok] of [[220, true], [223, true], [219, false], [224, false]] as const) {
    f.state.aircraftService = { selectedChemical: selected };
    const text = writeNativeSave(f.state, 4);
    if (ok) assert.equal(readNativeSave(text).state.aircraftService.selectedChemical, selected);
    else assert.throws(() => readNativeSave(text), /aircraft chemical/);
  }
});
