import type { GameSnapshot } from '../simulation/game';

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function MachineryPanel({ snapshot, onMove }: { snapshot: GameSnapshot; onMove: () => void }) {
  const machines = snapshot.scenario.equipment.filter(e => e.active);
  return <details id="machinery-panel" className="loan-panel">
    <summary>Machinery · {machines.length}</summary>
    <p id="machinery-summary">Owned: {machines.filter(e => !(e.flags & 64)).length} · Rented: {machines.filter(e => e.flags & 64).length}</p>
    <p>Time and travel wear machinery. Worn-out owned machines are automatically sold when available; rentals are excluded.</p>
    <button id="open-equipment-move" onClick={onMove}>Move machinery</button>
    <table className="livestock-counts" aria-label="Machinery wear"><thead><tr><th>Machine</th><th>Wear</th><th>Ownership</th></tr></thead><tbody>
      {machines.map(e => <tr key={e.slot}><th scope="row">Machine {e.slot}</th><td>{Math.floor(e.condition * 100 / 255)}%</td>
        <td>{e.flags & 64 ? 'Rented' : 'Owned'}</td></tr>)}
    </tbody></table>
    {snapshot.equipmentAgingNotices.length > 0 && <div id="machinery-notices" role="status"><ul>
      {snapshot.equipmentAgingNotices.map((n, i) => <li key={i}>{n.kind === 'sold'
        ? `Worn-out machine ${n.slot} was sold for ${money(n.value)}.`
        : `Machine ${n.slot} is worn out and could not be sold${n.reason === 'asset-busy' ? ' while in use' : ''}.`}</li>)}
    </ul></div>}
  </details>;
}
