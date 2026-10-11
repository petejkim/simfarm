import { AssetSaleControls } from './AssetSaleControls';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { storedWater } from '../simulation/water-storage';
import { ANIMAL_ADULT_WEEKS } from '../simulation/animal-allocation';

const names = ['Horse', 'Cow', 'Pig', 'Sheep'];
const notices: Record<number, string> = { 56: 'died from lack of feed.', 57: 'needs water.', 58: 'died from lack of water.',
  59: 'needs feed.', 67: 'broke through a fence.' };

export function LivestockPanel({ snapshot, onMoveSupplies, onCommand, onLocate }: { snapshot: GameSnapshot; onMoveSupplies: () => void; onCommand: (command: GameCommand) => void; onLocate: (x: number, y: number) => void }) {
  const animals = snapshot.scenario.animals.filter(a => a.active);
  const supplies = snapshot.scenario.inventory.filter(i => i.active && (i.type === 299 || i.type === 300));
  const stores = snapshot.scenario.buildings.filter(b => b.active && b.type === 72);
  const worn = stores.filter(b => b.bytes[6] === 255);
  return <details id="livestock-panel" className="loan-panel">
    <summary>Livestock · {animals.length} {animals.length === 1 ? 'animal' : 'animals'}</summary>
    <table className="livestock-counts" aria-label="Livestock counts"><thead><tr><th>Animal</th><th>Count</th></tr></thead><tbody>
      {names.map((name, index) => <tr key={name}><th scope="row">{name}</th><td>{animals.filter(a => a.type === index + 160).length}</td></tr>)}
    </tbody></table>
    <p id="livestock-life-summary">Adults: {animals.filter(a => a.ageWeeks > ANIMAL_ADULT_WEEKS[a.type - 160]).length} · Expecting: {animals.filter(a => (a.flags & 3) === 3).length}. Healthy eligible adults begin breeding each month.</p>
    <details id="animal-ages"><summary>Animal ages and breeding</summary>
      <table className="livestock-counts" aria-label="Animal ages and breeding"><thead><tr><th>Animal</th><th>Age (weeks)</th><th>Breeding</th></tr></thead><tbody>
        {animals.map(a => <tr key={a.slot}><th scope="row">{names[a.type - 160]} {a.slot}</th><td>{a.ageWeeks}</td>
          <td>{(a.flags & 3) === 3 ? `Expecting · week ${a.bytes[28]}` : '—'}</td></tr>)}
      </tbody></table>
    </details>
    {snapshot.animalLifecycleNotices.length > 0 && <div id="animal-lifecycle-notices" role="status"><ul>
      {snapshot.animalLifecycleNotices.map((notice, index) => <li key={index}>
        {notice.kind === 'born' ? `${names[notice.animalType - 160]} ${notice.slot} was born to animal ${notice.parentSlot}.`
          : notice.kind === 'old-age' ? `${names[notice.animalType - 160]} ${notice.slot} died of old age.`
          : `${names[notice.animalType - 160]} ${notice.slot} could not add a newborn because the farm has reached its animal limit.`}
      </li>)}
    </ul></div>}
    <p id="livestock-supplies">Water remaining: {supplies.filter(i => i.type === 299).reduce((n, i) => n + i.quantity, 0)} units · Feed remaining: {supplies.filter(i => i.type === 300).reduce((n, i) => n + i.quantity, 0)} units</p>
    <p id="livestock-stored-water">Stored water: {stores.reduce((sum, b) => sum + storedWater(b), 0)} units across {stores.length} water {stores.length === 1 ? 'store' : 'stores'}. Empty troughs refill weekly while water is available.</p>
    {worn.length > 0 && <p id="water-storage-worn" role="status">Water storage worn out at {worn.map(b => `${b.x}, ${b.y}`).join(' · ')}. Build additional water storage to keep collecting.</p>}
    <button id="open-supply-move" onClick={onMoveSupplies}>Move supplies</button>
    {snapshot.animalNotices.length > 0 && <div id="livestock-notices" role="status"><p>Recent livestock notices</p><ul>
      {snapshot.animalNotices.map((notice, index) => <li key={index}>
        {names[notice.animalType - 160] ?? 'Animal'} {notice.slot} {notices[notice.id] ?? 'needs attention.'}
      </li>)}
    </ul></div>}
    <AssetSaleControls kind="animal" snapshot={snapshot} onCommand={onCommand} onLocate={onLocate} />
  </details>;
}
