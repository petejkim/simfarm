import type { GameSnapshot } from '../simulation/game';

const names = ['Horse', 'Cow', 'Pig', 'Sheep'];
const notices: Record<number, string> = { 56: 'died from lack of feed.', 57: 'needs water.', 58: 'died from lack of water.',
  59: 'needs feed.', 67: 'broke through a fence.' };

export function LivestockPanel({ snapshot }: { snapshot: GameSnapshot }) {
  const animals = snapshot.scenario.animals.filter(a => a.active);
  return <details id="livestock-panel" className="loan-panel">
    <summary>Livestock · {animals.length} {animals.length === 1 ? 'animal' : 'animals'}</summary>
    <table className="livestock-counts" aria-label="Livestock counts"><thead><tr><th>Animal</th><th>Count</th></tr></thead><tbody>
      {names.map((name, index) => <tr key={name}><th scope="row">{name}</th><td>{animals.filter(a => a.type === index + 160).length}</td></tr>)}
    </tbody></table>
    {snapshot.animalNotices.length > 0 && <div id="livestock-notices" role="status"><p>Recent livestock notices</p><ul>
      {snapshot.animalNotices.map((notice, index) => <li key={index}>
        {names[snapshot.scenario.animals[notice.slot]?.type - 160] ?? 'Animal'} {notice.slot} {notices[notice.id] ?? 'needs attention.'}
      </li>)}
    </ul></div>}
  </details>;
}
