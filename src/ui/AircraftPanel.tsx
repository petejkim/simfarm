import { useState } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { AIRCRAFT_CHEMICALS, aircraftChemical, aircraftFuel, aircraftPayload, checkAircraftPurchase, checkAircraftService,
  type AircraftServiceAction } from '../simulation/aircraft';
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const names: Record<number, string> = { 221: 'Pesticide', 222: 'Herbicide', 223: 'Fungicide' };
const messages = {
  'no-airport': 'An airport is needed. You can approve an airport when the town offers expansion.',
  'no-parking': 'No airport parking space is available.', 'no-equipment-slots': 'The farm has reached its machinery limit.',
  'insufficient-cash': 'There is not enough cash.', 'parking-conflict': 'Airport parking conflicts with an existing aircraft.',
  'not-aircraft': 'Choose an aircraft.', 'not-parked': 'The aircraft must be parked at its airport for service.',
  'invalid-service': 'Choose an available service.', 'invalid-supplies': 'This aircraft has invalid fuel or payload quantities.',
};
export function AircraftPanel({ snapshot, onCommand, onLocate, onFly }: {
  snapshot: GameSnapshot; onCommand: (command: GameCommand) => void; onLocate: (x: number, y: number) => void; onFly: (slot: number) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const planes = snapshot.scenario.equipment.filter(e => e.active && e.type === 8);
  const plane = planes.find(e => e.slot === selectedSlot) ?? planes[0];
  const quote = checkAircraftPurchase(snapshot.scenario, snapshot.finances), purchase = snapshot.lastAircraftPurchaseResult;
  const result = snapshot.lastAircraftServiceResult;
  const serviceQuote = (action: AircraftServiceAction) => plane
    ? checkAircraftService(snapshot.scenario, snapshot.finances, snapshot.aircraftService, plane.slot, action) : null;
  const service = (action: AircraftServiceAction) => plane && onCommand({ type: 'service-aircraft', slot: plane.slot, action });
  const base = serviceQuote({ kind: 'fuel' });
  return <details id="aircraft-panel" className="loan-panel" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Aircraft · {planes.length}</summary>
    <p>Aircraft are purchased at an available airport. Fuel, chemical loading and repairs are available here. Choose Fly to steer the aircraft and spray its loaded chemicals.</p>
    <fieldset className="farm-actions" disabled={Boolean(snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight)}>
      <p id="aircraft-purchase-status">{quote.ok ? `Aircraft: ${money(quote.price)} · Parking at ${quote.x}, ${quote.y}.` : messages[quote.reason]}</p>
      <button id="buy-aircraft" disabled={!quote.ok} onClick={() => onCommand({ type: 'buy-aircraft' })}>Buy aircraft · {money(snapshot.scenario.equipmentDefinitions[8].price)}</button>
      {purchase && <p id="aircraft-purchase-result" role="status">{purchase.ok ? `Aircraft ${purchase.slot} purchased for ${money(purchase.price)} at ${purchase.x}, ${purchase.y}.` : messages[purchase.reason]}</p>}
      {plane && <>
        <label className="aircraft-selector">Service aircraft <select id="aircraft-selection" value={plane.slot} onChange={e => setSelectedSlot(Number(e.target.value))}>
          {planes.map(e => <option value={e.slot} key={e.slot}>Aircraft {e.slot} · {e.x}, {e.y}</option>)}
        </select></label>
        <p id="aircraft-status">Fuel: {aircraftFuel(plane)} / 255 · Payload: {aircraftPayload(plane)} / 255{aircraftPayload(plane) ? ` (${names[aircraftChemical(plane)] ?? 'Unknown chemical'})` : ''} · Wear: {Math.floor(plane.condition * 100 / 255)}%</p>
        <button id="fly-aircraft" disabled={Boolean(base && !base.ok && base.reason !== 'insufficient-cash')} onClick={() => { if (onFly(plane.slot)) setOpen(false); }}>Fly aircraft</button>
        <button id="locate-aircraft" onClick={() => onLocate(plane.x, plane.y)}>Show on map</button>
        {base && !base.ok && base.reason !== 'insufficient-cash' && <p>{messages[base.reason]}</p>}
        <div className="aircraft-actions">{(['fuel', 'repair', 'load'] as const).map(kind => {
          const q = serviceQuote({ kind });
          return <span key={kind}><button id={`aircraft-${kind}`} disabled={!q?.ok || !q.changed} onClick={() => service({ kind })}>
            {kind === 'fuel' ? 'Refuel' : kind === 'repair' ? 'Repair' : 'Load chemicals'}{q?.ok ? ` · ${money(q.price)}` : ''}
          </button>{q && !q.ok && <span role="status"> {messages[q.reason]}</span>}</span>;
        })}</div>
        <label>Loading chemical <select id="aircraft-chemical" value={snapshot.aircraftService.selectedChemical}
          onChange={e => service({ kind: 'chemical', chemicalType: Number(e.target.value) })}>
          {AIRCRAFT_CHEMICALS.map(type => <option key={type} value={type}>{names[type]}</option>)}
        </select></label>
        <p>Changing the chemical sells this aircraft’s remaining payload. The loading choice is shared by all aircraft.</p>
        {result && <p id="aircraft-service-result" role="status">{result.ok ? result.changed
          ? result.refund ? `Payload sold for ${money(result.refund)}. Loading chemical changed.` : `Service completed for ${money(result.price)}.`
          : 'No service was needed.' : messages[result.reason]}</p>}
      </>}
    </fieldset>
    {snapshot.lastFlightStartResult && !snapshot.lastFlightStartResult.ok && <p id="flight-start-error" role="status">
      {snapshot.lastFlightStartResult.reason === 'invalid-viewport' ? 'The map is too small to start a flight.'
        : snapshot.lastFlightStartResult.reason === 'not-parked' ? 'The aircraft must be parked before takeoff.' : 'The aircraft or its airport parking is inconsistent.'}
    </p>}
  </details>;
}
