import type { GameSnapshot } from '../simulation/game';
import { storedWater } from '../simulation/water-storage';

const names = ['Horse', 'Cow', 'Pig', 'Sheep'];
const notices: Record<number, string> = { 56: 'died from lack of feed.', 57: 'needs water.', 58: 'died from lack of water.',
  59: 'needs feed.', 67: 'broke through a fence.' };

export function LivestockPanel({ snapshot, onShop }: { snapshot: GameSnapshot; onShop: () => void }) {
  const animals = snapshot.scenario.animals.filter(a => a.active);
  const stores = snapshot.scenario.buildings.filter(b => b.active && b.type === 72);
  const worn = stores.filter(b => b.bytes[6] === 255);
  return <details id="livestock-panel" className="loan-panel">
    <summary>Livestock · {animals.length} {animals.length === 1 ? 'animal' : 'animals'}</summary>
    <table className="livestock-counts" aria-label="Livestock counts"><thead><tr><th>Animal</th><th>Count</th></tr></thead><tbody>
      {names.map((name, index) => <tr key={name}><th scope="row">{name}</th><td>{animals.filter(a => a.type === index + 160).length}</td></tr>)}
    </tbody></table>
    <p id="livestock-stored-water">Stored water: {stores.reduce((sum, b) => sum + storedWater(b), 0)} units across {stores.length} water {stores.length === 1 ? 'store' : 'stores'}. Empty troughs refill weekly while water is available.</p>
    {worn.length > 0 && <p id="water-storage-worn" role="status">Water storage worn out at {worn.map(b => `${b.x}, ${b.y}`).join(' · ')}. Build additional water storage to keep collecting.</p>}
    <button id="open-livestock-shop" onClick={onShop}>Buy animals and supplies</button>
    {snapshot.animalNotices.length > 0 && <div id="livestock-notices" role="status"><p>Recent livestock notices</p><ul>
      {snapshot.animalNotices.map((notice, index) => <li key={index}>
        {names[snapshot.scenario.animals[notice.slot]?.type - 160] ?? 'Animal'} {notice.slot} {notices[notice.id] ?? 'needs attention.'}
      </li>)}
    </ul></div>}
  </details>;
}
