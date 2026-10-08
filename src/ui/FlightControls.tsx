import type { KeyboardEvent } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { flightPosition, MAX_FLIGHT_INPUTS, type FlightControl } from '../simulation/aircraft-flight';
import { aircraftFuel, aircraftPayload } from '../simulation/aircraft';
const keys: Record<string, FlightControl> = {
  ArrowLeft: 'left', ArrowRight: 'right', PageUp: 'climb', PageDown: 'descend', Home: 'spray-toggle', End: 'end',
};
export function flightKey(event: KeyboardEvent, onControl: (control: FlightControl) => void): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const control = keys[event.key];
  if (control) { event.preventDefault(); event.stopPropagation(); onControl(control); }
}
export function FlightControls({ snapshot, onCommand }: { snapshot: GameSnapshot; onCommand: (command: GameCommand) => void }) {
  const f = snapshot.aircraftFlight;
  if (!f) return snapshot.lastFlightEnd && <p id="flight-result" role="status" className="flight-result">
    {snapshot.lastFlightEnd.kind === 'landed' ? 'Aircraft returned to its airport parking space.'
      : `Aircraft crashed at ${snapshot.lastFlightEnd.x}, ${snapshot.lastFlightEnd.y} and was lost.`}
    {snapshot.lastFlightEnd.cause === 'fuel' ? ' Fuel ran out.' : snapshot.lastFlightEnd.cause === 'wear' ? ' Aircraft wear exceeded its limit.' : ''}
  </p>;
  const plane = snapshot.scenario.equipment[f.slot], p = flightPosition(f);
  const control = (control: FlightControl) => onCommand({ type: 'flight-control', control });
  return <section id="flight-controls" className="flight-controls" aria-label="Aircraft flight" onKeyDown={e => flightKey(e, control)}>
    <strong>Flying aircraft {f.slot}</strong>
    <p id="flight-status">Position: {p.x}, {p.y} · Heading: {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][f.heading]} · Altitude: {f.altitude}
      {' · '}Fuel: {aircraftFuel(plane)} / 255 · Payload: {aircraftPayload(plane)} / 255 · Wear: {Math.floor(plane.condition * 100 / 255)}%</p>
    <div className="flight-buttons">
      {(['left', 'right', 'climb', 'descend', 'spray-toggle', 'end'] as const).map(c => <button key={c} id={`flight-${c}`}
        disabled={f.inputs.length >= MAX_FLIGHT_INPUTS} aria-pressed={c === 'spray-toggle' ? f.spraying : undefined} onClick={() => control(c)}>
        {c === 'left' ? 'Turn left' : c === 'right' ? 'Turn right' : c === 'climb' ? 'Climb' : c === 'descend' ? 'Descend'
          : c === 'spray-toggle' ? f.spraying ? 'Stop spraying' : 'Start spraying' : 'Land / end flight'}
      </button>)}
      <button id="flight-pause" onClick={() => onCommand({ type: 'set-paused', paused: !snapshot.paused })}>{snapshot.paused ? 'Resume flight' : 'Pause flight'}</button>
      <button id="flight-step" disabled={!snapshot.paused} onClick={() => onCommand({ type: 'step-flight' })}>Step flight</button>
    </div>
    <p id="flight-input-status" role="status">{snapshot.paused ? 'Paused' : 'Flying'} · {f.spraying ? 'Spraying' : 'Spray off'} · {f.inputs.length} queued controls</p>
    <p>End over an airport to land. Ending elsewhere crashes the aircraft.</p>
    <details><summary>Flight help</summary><p>Farm work and the calendar are suspended during flight.</p><p>With the map or a flight button focused: ← / → turn, Page Up / Down change altitude, Home toggles spray, End ends flight. Controls take effect on the next flight step.</p></details>
  </section>;
}
