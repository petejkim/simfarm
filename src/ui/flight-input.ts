import type { FlightControl } from '../simulation/aircraft-flight';
import { FLIGHT_KEY_REPEAT_MS, flightKeyRepeats } from './flight-keys';

interface FlightTarget {
  dispatch(command: { type: 'flight-control'; control: FlightControl }): void;
  getSnapshot(): { aircraftFlight: { inputs: readonly FlightControl[] } | null };
}
/** Held flight controls, shared by keys and on-screen touch buttons. A source (key code or pointer id) dispatches once
 * on press; a held turn/altitude source repeats every FLIGHT_KEY_REPEAT_MS, but only once the flight has consumed
 * the previous control, so the queue never floods. Spray and End fire once per press. */
export function createFlightInput(target: FlightTarget) {
  const held = new Map<string, ReturnType<typeof setInterval>>();
  const release = (source: string) => { const timer = held.get(source); if (timer !== undefined) { clearInterval(timer); held.delete(source); } };
  const releaseAll = () => { for (const source of [...held.keys()]) release(source); };
  return {
    isHeld: (source: string) => held.has(source),
    press(source: string, control: FlightControl) {
      if (held.has(source) || !target.getSnapshot().aircraftFlight) return;
      target.dispatch({ type: 'flight-control', control });
      if (flightKeyRepeats(control)) held.set(source, setInterval(() => {
        const flight = target.getSnapshot().aircraftFlight;
        if (!flight) { releaseAll(); return; }
        if (!flight.inputs.length) target.dispatch({ type: 'flight-control', control });
      }, FLIGHT_KEY_REPEAT_MS));
    },
    release, releaseAll,
  };
}
export type FlightInput = ReturnType<typeof createFlightInput>;
