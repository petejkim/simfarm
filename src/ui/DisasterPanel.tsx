import type { GameSnapshot } from '../simulation/game';

export function DisasterPanel({ snapshot: s, onLocate }: {
  snapshot: GameSnapshot; onLocate: (x: number, y: number) => void;
}) {
  const d = s.disasters;
  const active = d.flags & 1 ? 'tornado' : d.flags & 32 ? 'swarm' : null;
  const names = [[1, 'Tornado'], [32, 'Locust swarm'], [2, 'Drought'], [4, 'Flood'], [8, 'High winds'], [16, 'Frost'], [64, 'Crop circles'], [128, 'Toxic-land warning']] as const;
  const activeNames = names.filter(([flag]) => d.flags & flag).map(([, name]) => name);
  const shoreline = s.scenario.cells.findIndex(c => c.terrain & 0x1000);
  const circle = s.scenario.cells.findIndex(c => (c.terrain & 2047) === 213);
  const result = s.lastDisasterResult;
  return <details id="disasters-panel" className="disasters-panel">
    <summary>Disasters{activeNames.length ? ` · ${activeNames.join(', ')} active` : ''}</summary>
    <p>Disabling new disasters lets an existing event run its course. High winds can strip nutrients from fields; nearby trees offer protection.</p>
    <p>Start an event from the Disasters menu. Tornadoes can destroy buildings and their contents; locusts damage crops.</p>
    <p>Floods spread beside permanent water and can destroy fields and buildings. Droughts dry shallow shoreline water. Advance time to let events run their course.</p>
    <div className="disaster-actions">
      {circle >= 0 && <button id="locate-circles" onClick={() => onLocate(Math.floor(circle / 96), circle % 96)}>Locate crop circles</button>}
      {active && <button id="locate-disaster" onClick={() => onLocate(d[active].x, d[active].y)}>Locate {active === 'swarm' ? 'locusts' : 'tornado'}</button>}
      {Boolean(d.flags & 6) && shoreline >= 0 && <button id="locate-shoreline" onClick={() => onLocate(Math.floor(shoreline / 96), shoreline % 96)}>Locate shoreline</button>}
    </div>
    <p id="disaster-state" role="status">{active ? `${active === 'swarm' ? 'Locust swarm' : 'Tornado'} at ${d[active].x}, ${d[active].y}${s.paused ? ' · Paused' : ''}` : 'No tornado or locust swarm active.'}{d.flags & 8 ? ' High winds active.' : ''}</p>
    {Boolean(d.flags & 6) && <p id="water-disaster-state" role="status">{d.flags & 2 ? 'Drought active. ' : ''}{d.flags & 4 ? `Flood active · ${s.waterDisasters.scanning ? 'Water is spreading.' : 'Floodwater remains.'}` : ''}{s.paused ? ' Paused.' : ''}</p>}
    {Boolean(d.flags & 16) && <p id="frost-state" role="status">Frost active.{s.paused ? ' Paused.' : ''}</p>}
    {Boolean(d.flags & 128) && <p id="toxic-warning-state" role="status">Toxic-land warning recorded.</p>}
    {result && !result.ok && <p id="disaster-error" role="status">{result.reason === 'no-fields' ? 'Create a field before starting this event.' : result.reason === 'ineligible-crop' ? 'The randomly chosen field is not suitable for crop circles.' : result.reason === 'disabled' ? 'Enable new disasters first.' : 'That event cannot start while the current disaster is active.'}</p>}
    {s.disasterNotices.length > 0 && <ul id="disaster-notices">{s.disasterNotices.map((n, i) => <li key={i}>{n}</li>)}</ul>}
  </details>;
}
