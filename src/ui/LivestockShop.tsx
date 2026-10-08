import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkLivestockPurchase, LIVESTOCK_PRODUCTS } from '../simulation/livestock-purchase';

const messages = {
  'unsupported-animal': 'Choose an animal or supply from the list.', 'unsupported-supply': 'Choose a supply from the list.',
  'outside-map': 'Choose a tile inside the map.', 'not-owned': 'Choose land you own, away from the town.',
  'occupied': 'This tile is occupied. Choose another location.',
  'blocked-terrain': 'Choose clear grass or a road. Automatic clearing can remove trees.',
  'no-animal-slots': 'The farm has no room for more animals.', 'no-inventory-slots': 'The inventory is full.',
  'insufficient-cash': 'There is not enough cash for this purchase.',
};
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
export function LivestockShop({ snapshot, position, productType, onTypeChange, onCommand }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null; productType: number;
  onTypeChange: (type: number) => void; onCommand: (command: GameCommand) => void;
}) {
  const world = snapshot.scenario, finances = snapshot.finances;
  const quote = position ? checkLivestockPurchase(world, finances, productType, position.x, position.y, snapshot.weather.soilMoisture) : null;
  const result = snapshot.lastLivestockResult, label = LIVESTOCK_PRODUCTS.find(p => p.type === productType)!.name;
  const supplies = world.inventory.filter(i => i.active && (i.type === 299 || i.type === 300));
  return <section id="livestock-shop" className="land-panel">
    <span className="eyebrow">ANIMALS & SUPPLIES</span>
    <p>Choose an animal or supply, click its location on the map, then buy it below.</p>
    <label className="crop-label">Purchase <select id="livestock-product" value={productType} onChange={e => onTypeChange(Number(e.target.value))}>
      {LIVESTOCK_PRODUCTS.map(p => {
        const def = p.type < 164 ? finances.accounts.assets.animalDefinitions[p.type - 160] : finances.accounts.otherDefinitions[p.type - 288];
        return <option key={p.type} value={p.type}>{p.name} · {money((def.price << 16 >> 16) >>> 0)}</option>;
      })}
    </select></label>
    <p>Place feed and water near your animals. Each trough starts with 256 units of water; each feed pile holds 512 units.</p>
    <p>Automatic trough refills are not available yet. Replace depleted feed by buying a new pile; place another trough when water runs out.</p>
    <p id="livestock-supplies">Water remaining: {supplies.filter(i => i.type === 299).reduce((n, i) => n + i.quantity, 0)} units · Feed remaining: {supplies.filter(i => i.type === 300).reduce((n, i) => n + i.quantity, 0)} units</p>
    <label className="clearing"><input id="livestock-auto-clear" type="checkbox" checked={world.farm.autoClear}
      onChange={e => onCommand({ type: 'set-auto-clear', enabled: e.target.checked })} /> Automatically clear trees</label>
    <p id="livestock-placement-status">{quote ? quote.ok
      ? `Ready at ${position!.x}, ${position!.y} · ${money(quote.price + quote.clearingCost)}${quote.clearingCost ? ` (${money(quote.clearingCost)} clearing)` : ''}.`
      : messages[quote.reason] : 'Select a location on the map.'}</p>
    <button id="buy-livestock" disabled={!quote?.ok} onClick={() => position && onCommand({ type: 'buy-livestock', productType, ...position })}>Buy {label.toLowerCase()}</button>
    {result && <p id="livestock-purchase-result" role="status">{result.ok
      ? `${LIVESTOCK_PRODUCTS.find(p => p.type === result.productType)!.name} purchased for ${money(result.price + result.clearingCost)}.` : messages[result.reason]}</p>}
  </section>;
}
