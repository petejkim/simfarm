import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkEquipmentPurchase, PURCHASABLE_EQUIPMENT } from '../simulation/equipment-purchase';

// Native role labels where field dispatch establishes them; original shop names remain pending.
const names = ['Tractor', 'Plow', 'Planter', 'Sprayer', 'Harvester', 'Machine type 5', 'Machine type 6', 'Harvest truck'];
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const messages = {
  'unsupported-equipment': 'Choose an available machine.', 'outside-map': 'The entire machine must fit inside the map.',
  'not-owned': 'Choose a location on your land.', 'blocked-terrain': 'Choose clear grass, a road or equipment storage. Automatic clearing can remove trees.',
  'no-equipment-slots': 'The farm has reached its machinery limit.',
  'no-storage-space': 'This building cannot store the machine or has no room. Choose equipment storage with free space.',
  'insufficient-cash': 'There is not enough cash. Two-tile machines require cash above their price; clearing may need more.',
};
export function EquipmentShop({ snapshot, position, equipmentType, onTypeChange, onCommand }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null; equipmentType: number;
  onTypeChange: (type: number) => void; onCommand: (command: GameCommand) => void;
}) {
  const world = snapshot.scenario, def = world.equipmentDefinitions[equipmentType];
  const quote = position ? checkEquipmentPurchase(world, equipmentType, position.x, position.y, snapshot.weather.soilMoisture) : null;
  const result = snapshot.lastEquipmentPurchaseResult;
  return <section id="equipment-shop" className="land-panel">
    <span className="eyebrow">BUY MACHINERY</span>
    <p>Choose a machine, then click clear ground or an equipment storage building on the map.</p>
    <label className="crop-label">Machine <select id="equipment-type" value={equipmentType} onChange={e => onTypeChange(Number(e.target.value))}>
      {PURCHASABLE_EQUIPMENT.map(type => <option key={type} value={type}>{names[type]} · {money(world.equipmentDefinitions[type].price)}</option>)}
    </select></label>
    <p>{def.width} × {def.height} tiles · {money(def.price)}. Owned machinery is used automatically when field work needs it. Storage chooses a free space that fits.</p>
    <label className="clearing"><input id="equipment-auto-clear" type="checkbox" checked={world.farm.autoClear}
      onChange={e => onCommand({ type: 'set-auto-clear', enabled: e.target.checked })} /> Automatically clear trees</label>
    <p id="equipment-placement-status">{quote ? quote.ok
      ? `Ready at ${position!.x}, ${position!.y} · ${money(quote.price + quote.clearingCost)} total${quote.clearingCost ? ` (${money(quote.clearingCost)} clearing)` : ''}${quote.buildingSlot !== null ? ' · Will enter equipment storage' : ''}.`
      : messages[quote.reason] : 'Select a machinery location on the map.'}</p>
    <button id="buy-equipment" disabled={!quote?.ok} onClick={() => position && onCommand({ type: 'buy-equipment', equipmentType, ...position })}>Buy machinery</button>
    {result && <p id="equipment-purchase-result" role="status">{result.ok
      ? `${names[result.equipmentType]} purchased for ${money(result.price + result.clearingCost)}${result.buildingSlot !== null ? ' and placed in storage' : ''}.`
      : messages[result.reason]}</p>}
  </section>;
}
