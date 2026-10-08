import type { GameCommand, GameSnapshot } from '../simulation/game';

export function DisasterPanel({ snapshot: s, onCommand, onLocate }: {
  snapshot: GameSnapshot; onCommand: (command: GameCommand) => void; onLocate: (x: number, y: number) => void;
}) {
  const d = s.disasters, blocked = Boolean(s.pendingTown || s.finances.defaultDecision || s.aircraftFlight);
  const active = d.flags & 1 ? 'tornado' : d.flags & 32 ? 'swarm' : null;
  const result = s.lastDisasterResult;
  return <details id="disasters-panel" className="disasters-panel">
    <summary>Disasters{active ? ` · ${active === 'swarm' ? 'Locust swarm' : 'Tornado'} active` : ''}</summary>
    <label><input id="disasters-enabled" type="checkbox" checked={d.enabled} disabled={blocked}
      onChange={e => onCommand({ type: 'set-disasters-enabled', enabled: e.currentTarget.checked })} /> Allow new disasters</label>
    <p>Disabling new disasters lets an existing event run its course. High winds can strip nutrients from fields; nearby trees offer protection.</p>
    <p>Start an event manually below. Tornadoes can destroy buildings and their contents; locusts damage crops.</p>
    <div className="disaster-actions">
      <button id="start-tornado" disabled={blocked || !d.enabled || Boolean(d.flags & 1)} onClick={() => onCommand({ type: 'start-disaster', kind: 'tornado' })}>Start tornado</button>
      <button id="start-swarm" disabled={blocked || !d.enabled || Boolean(d.flags & 33) || !s.scenario.fields.some(f => f.active)} onClick={() => onCommand({ type: 'start-disaster', kind: 'swarm' })}>Start locust swarm</button>
      {active && <button id="locate-disaster" onClick={() => onLocate(d[active].x, d[active].y)}>Locate {active === 'swarm' ? 'locusts' : 'tornado'}</button>}
    </div>
    <p id="disaster-state" role="status">{active ? `${active === 'swarm' ? 'Locust swarm' : 'Tornado'} at ${d[active].x}, ${d[active].y}${s.paused ? ' · Paused' : ''}` : 'No tornado or locust swarm active.'}{d.flags & 8 ? ' High winds active.' : ''}</p>
    {result && !result.ok && <p id="disaster-error" role="status">{result.reason === 'no-fields' ? 'Create a field before starting locusts.' : result.reason === 'disabled' ? 'Enable new disasters first.' : 'That event cannot start while the current disaster is active.'}</p>}
    {s.disasterNotices.length > 0 && <ul id="disaster-notices">{s.disasterNotices.map((n, i) => <li key={i}>{n}</li>)}</ul>}
  </details>;
}
