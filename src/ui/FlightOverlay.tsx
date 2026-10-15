import { useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { Scenario } from '../formats/scenario';
import type { AircraftFlight, FlightControl } from '../simulation/aircraft-flight';
import { aircraftFlightView, FLIGHT_HEADINGS } from '../simulation/aircraft-view';
import { CHEMICAL_NAMES } from './AircraftWindow';
import type { FlightInput } from './flight-input';
import { useCoarsePointer } from './phone';

const percent = (n: number) => `${Math.round(Math.min(255, n) / 255 * 100)}%`;
// Widest possible text of each changing readout, so a change (W → NW, 9% → 10%, Spray → Spraying) never shifts the row.
const SPRAY_SIZES = ['Empty', ...Object.values(CHEMICAL_NAMES).map(name => `${name} 100%`), 'Chemical 100%'];
const SIZES = { altitude: ['100'], heading: [...FLIGHT_HEADINGS], percent: ['100%'], spray: SPRAY_SIZES, sprayLabel: ['Spray', 'Spraying'] };

/** Native in-flight overlay (user request; the original flew by keyboard only and drew no panel). A fixed translucent
 * layer over the terrain, outside window stacking and saves: status readouts at the top; key hints with a fine
 * pointer, or hold-to-repeat touch buttons with a coarse one (climb/descend above turn left/right bottom-left, spray/End bottom-right).
 * Only the touch buttons take pointer input; touches elsewhere (readouts included) reach the terrain. */
export function FlightOverlay({ world, flight, input }: { world: Scenario; flight: AircraftFlight; input: FlightInput }) {
  const touch = useCoarsePointer(), view = aircraftFlightView(world, flight);
  const spray = view.payload ? `${CHEMICAL_NAMES[view.chemical] ?? 'Chemical'} ${percent(view.payload)}` : 'Empty';
  return <div id="flight-overlay" className="flight-overlay" data-touch={touch || undefined}>
    <dl className="flight-readouts" aria-label="Flight status">
      <Readout id="altitude" label="Alt" sizes={SIZES.altitude}>{view.altitude}</Readout>
      <Readout id="heading" label="Hdg" sizes={SIZES.heading}>{view.heading}</Readout>
      <Readout id="fuel" label="Fuel" sizes={SIZES.percent}>{percent(view.fuel)}</Readout>
      <Readout id="payload" label={<Fixed id="flight-payload-label" sizes={SIZES.sprayLabel}>{view.spraying ? 'Spraying' : 'Spray'}</Fixed>} sizes={SIZES.spray}>{spray}</Readout>
      <Readout id="damage" label="Damage" sizes={SIZES.percent}>{percent(view.damage)}</Readout>
      <Readout id="landing" label="End">{view.overAirport ? 'lands at airport' : 'crashes plane'}</Readout>
    </dl>
    {touch
      ? <>
        <div className="flight-pad flight-pad-steer">
          <FlightButton input={input} control="climb" label="Climb"><Arrow turn={0}/></FlightButton>
          <FlightButton input={input} control="descend" label="Descend"><Arrow turn={180}/></FlightButton>
          <FlightButton input={input} control="left" label="Turn left"><Arrow turn={270}/></FlightButton>
          <FlightButton input={input} control="right" label="Turn right"><Arrow turn={90}/></FlightButton>
        </div>
        <div className="flight-pad flight-pad-actions">
          <FlightButton input={input} control="spray-toggle" label="Spray" pressed={view.spraying} disabled={!view.payload && !view.spraying}>Spray</FlightButton>
          <FlightButton input={input} control="end" label="End flight" className="flight-end">End</FlightButton>
        </div>
      </>
      : <p className="flight-keys" aria-label="Flight keys">
        <kbd>A</kbd>/<kbd>D</kbd> turn · <kbd>S</kbd> climb · <kbd>W</kbd> descend · <kbd>Space</kbd> spray · <kbd>E</kbd> end
      </p>}
  </div>;
}

/** One drawn triangle for every arrow: text glyphs (◀ ▶ ▲ ▼) render as mixed emoji and plain symbols on phones. */
function Arrow({ turn }: { turn: number }) {
  return <svg className="flight-arrow" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${turn}deg)` }}><path d="M8 3 14 13H2Z" fill="currentColor"/></svg>;
}

function Readout({ id, label, sizes, children }: { id: string; label: ReactNode; sizes?: readonly string[]; children: ReactNode }) {
  return <div className="flight-readout"><dt>{label}</dt>
    <dd>{sizes ? <Fixed id={`flight-${id}`} sizes={sizes}>{children}</Fixed> : <span id={`flight-${id}`}>{children}</span>}</dd></div>;
}
/** Text in a box as wide as the widest of `sizes`: hidden copies share its grid cell (no font-metric guesses). */
function Fixed({ id, sizes, children }: { id?: string; sizes: readonly string[]; children: ReactNode }) {
  return <span className="flight-fixed">{sizes.map(size => <span key={size} className="flight-sizer" aria-hidden="true">{size}</span>)}<span id={id}>{children}</span></span>;
}

/** Pointer-captured hold button. It never takes focus (so Space keeps toggling spray and the terrain keeps focus).
 * Keyboard/assistive activation (a click without a pointer press) sends one control. */
function FlightButton({ input, control, label, pressed, disabled, className, children }: {
  input: FlightInput; control: FlightControl; label: string; pressed?: boolean; disabled?: boolean; className?: string; children: ReactNode;
}) {
  // Held look is state, not :active: touch browsers drop :active on a held or default-prevented press.
  const [held, setHeld] = useState(false);
  const source = (event: PointerEvent) => `pointer:${event.pointerId}`;
  const up = (event: PointerEvent<HTMLButtonElement>) => { setHeld(false); input.release(source(event)); };
  return <button type="button" tabIndex={-1} className={`flight-button${held ? ' is-held' : ''}${className ? ` ${className}` : ''}`} aria-label={label}
    aria-pressed={pressed} disabled={disabled} data-flight-control={control}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      setHeld(true); input.press(source(event), control);
    }}
    onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
    onContextMenu={event => event.preventDefault()}
    onClick={(event: MouseEvent) => { if (event.detail === 0) { input.press('click', control); input.release('click'); } }}>
    {children}
  </button>;
}
