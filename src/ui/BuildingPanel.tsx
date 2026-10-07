import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkBuildingPlacement, PURCHASABLE_BUILDINGS } from '../simulation/building-placement';

// Descriptive native labels; original purchase-window text is not decoded yet.
const names = ['Small crop storage', 'Large crop storage', 'Storage · 3 × 2', 'Storage · 3 × 3 (A)', 'Storage · 3 × 3 (B)', 'Storage · 4 × 3'];
const messages = {
  'unsupported-building': 'Choose an available building.', 'outside-map': 'The entire building must fit inside the map.',
  'not-owned': 'Place the building on your land.', 'occupied': 'Another building occupies this space.',
  'blocked-terrain': 'Ground or an object blocks this building. Automatic clearing can remove trees.',
  'no-building-slots': 'The farm has reached its building limit.',
  'insufficient-cash': 'There is not enough cash for this placement. Larger buildings require cash above their price; tree clearing may need more.',
};
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
export function BuildingPanel({ snapshot, position, buildingType, onTypeChange, onCommand }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null; buildingType: number;
  onTypeChange: (type: number) => void; onCommand: (command: GameCommand) => void;
}) {
  const world = snapshot.scenario, def = world.buildingDefinitions[buildingType - 64];
  const quote = position ? checkBuildingPlacement(world, buildingType, position.x, position.y, snapshot.weather.soilMoisture) : null;
  const result = snapshot.lastBuildingResult;
  return <section className="land-panel">
    <span className="eyebrow">BUILD STORAGE</span>
    <p>Choose a building, then click its top-left corner on the map.</p>
    <label className="crop-label">Building <select id="building-type" value={buildingType} onChange={e => onTypeChange(Number(e.target.value))}>
      {PURCHASABLE_BUILDINGS.map(type => <option key={type} value={type}>{names[type - 64]} · {money(world.buildingDefinitions[type - 64].price)}</option>)}
    </select></label>
    <p>{def.width} × {def.height} tiles · {money(def.price)}. {buildingType <= 65
      ? `Holds ${def.width * def.height} harvested crop ${buildingType === 64 ? 'lot' : 'lots'}. Trucks use free space automatically.`
      : 'Stores equipment. Returning machines can use available space.'}</p>
    <label className="clearing"><input id="building-auto-clear" type="checkbox" checked={world.farm.autoClear}
      onChange={e => onCommand({ type: 'set-auto-clear', enabled: e.target.checked })} /> Automatically clear trees</label>
    <p id="building-placement-status">{quote ? quote.ok ? `Ready at ${position!.x}, ${position!.y} · ${money(quote.price + quote.clearingCost)} total${quote.clearingCost ? ` (${money(quote.clearingCost)} clearing)` : ''}.`
      : messages[quote.reason] : 'Select a building location on the map.'}</p>
    <button id="build-building" disabled={!quote?.ok} onClick={() => position && onCommand({ type: 'build', buildingType, ...position })}>Build storage</button>
    {result && <p id="building-result" role="status">{result.ok
      ? `Built storage for ${money(result.price + result.clearingCost)}.` : messages[result.reason]}</p>}
  </section>;
}
