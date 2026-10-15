import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { aircraftFixture } from './support/aircraft';
import { purchaseAircraft, serviceAircraft, createAircraftServiceState } from '../src/simulation/aircraft';
import { beginFlight, flightPosition, type FlightControl } from '../src/simulation/aircraft-flight';
import { aircraftFlightView, FLIGHT_HEADINGS } from '../src/simulation/aircraft-view';
import { createFlightInput } from '../src/ui/flight-input';
import { FLIGHT_KEY_REPEAT_MS } from '../src/ui/flight-keys';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function target() {
  const sent: FlightControl[] = [], flight = { inputs: [] as FlightControl[] };
  const state = { flying: true };
  return { sent, flight, state, dispatch: (c: { control: FlightControl }) => { sent.push(c.control); flight.inputs.push(c.control); },
    getSnapshot: () => ({ aircraftFlight: state.flying ? flight : null }) };
}

test('held controls dispatch on press and repeat only after the flight consumed the previous one', async () => {
  const t = target(), input = createFlightInput(t);
  input.press('pointer:1', 'left'); input.press('pointer:1', 'left'); // a second press of a held source is ignored
  assert.deepEqual(t.sent, ['left']);
  await wait(FLIGHT_KEY_REPEAT_MS * 2.5);
  assert.deepEqual(t.sent, ['left'], 'unconsumed control must not repeat');
  t.flight.inputs.length = 0; await wait(FLIGHT_KEY_REPEAT_MS * 1.5);
  assert.deepEqual(t.sent, ['left', 'left']);
  // Two simultaneous sources (e.g. two fingers) each hold independently.
  t.flight.inputs.length = 0; input.press('pointer:2', 'climb'); assert.deepEqual(t.sent.slice(-1), ['climb']);
  input.release('pointer:1'); input.release('pointer:2'); assert.equal(input.isHeld('pointer:1'), false);
  t.flight.inputs.length = 0; const before = t.sent.length; await wait(FLIGHT_KEY_REPEAT_MS * 2.5);
  assert.equal(t.sent.length, before, 'released sources stop repeating');
});

test('spray and End fire once per press; nothing is sent or held without a flight, and flight end releases holds', async () => {
  const t = target(), input = createFlightInput(t);
  for (const control of ['spray-toggle', 'end'] as const) { input.press(control, control); assert.equal(input.isHeld(control), false); }
  assert.deepEqual(t.sent, ['spray-toggle', 'end']);
  input.press('pointer:3', 'right'); t.state.flying = false; await wait(FLIGHT_KEY_REPEAT_MS * 1.5);
  assert.equal(input.isHeld('pointer:3'), false);
  input.press('pointer:4', 'right'); assert.deepEqual(t.sent, ['spray-toggle', 'end', 'right']);
  input.releaseAll();
});

test('flight readouts report record values, heading names and whether ending lands or crashes', () => {
  const f = aircraftFixture(), w = f.state.scenario, a = f.state.finances, service = createAircraftServiceState();
  const p = purchaseAircraft(w, a); assert.ok(p.ok);
  for (const kind of ['fuel', 'load'] as const) assert.ok(serviceAircraft(w, a, service, p.slot, { kind }).ok);
  const result = beginFlight(w, a, p.slot, 20, 16, 0, true); assert.ok(result.ok);
  const flight = result.flight;
  assert.deepEqual(aircraftFlightView(w, flight), { altitude: 10, heading: 'W', fuel: 255, payload: 255, chemical: 221,
    damage: w.equipment[p.slot].condition, spraying: false, overAirport: true });
  assert.deepEqual(FLIGHT_HEADINGS.map((_, heading) => aircraftFlightView(w, { ...flight, heading }).heading), ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
  // Away from the airport region (low nibble5) the same position test as finishFlight reports a crash.
  const away = { ...flight, cameraX: 60, cameraY: 60 }, q = flightPosition(away);
  assert.notEqual(w.regionalConditions[((q.x >> 3) * 12 + (q.y >> 3)) * 7] & 15, 5);
  assert.equal(aircraftFlightView(w, away).overAirport, false);
});
