import type { Ref } from 'react';
import type { CropDefinition } from '../formats/crop';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkCropSupplyPurchase } from '../simulation/crop-supply-purchase';
import { findBuilding } from '../simulation/building-storage';
import { worldIndex } from '../formats/scenario';

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const chemicals = ['Fertilizer', 'Pesticide', 'Herbicide', 'Fungicide'];
const messages = {
  'unsupported-supply': 'Choose an available supply.', 'outside-map': 'Choose a storage building inside the map.',
  'not-owned': 'Choose storage on your own land.', 'blocked-terrain': 'Choose an empty floor tile or close this building before buying.',
  'storage-required': 'Supplies must be delivered into storage. Choose a storage building below or build one.',
  'incompatible-storage': 'Chemicals need equipment storage. Crop storage accepts seeds.',
  'no-storage-space': 'This building is full. Choose another store or move its contents.',
  'no-inventory-slots': 'The farm has reached its supply limit.', 'no-chemical-slots': 'The farm has reached its chemical limit.',
  'storage-slot-overflow': 'Storage cannot accept more supply records. Use existing stock first.',
  'insufficient-cash': 'There is not enough cash for this purchase.',
};
export function CropSupplyShop({ snapshot: s, crops, position, productType, onTypeChange, onCommand, headingRef, onChooseMap, onBuild, onChooseStorage }: {
  snapshot: GameSnapshot; crops: CropDefinition[]; position: { x: number; y: number } | null; productType: number;
  onTypeChange: (type: number) => void; onCommand: (command: GameCommand) => void; headingRef: Ref<HTMLHeadingElement>;
  onChooseMap: () => void; onBuild: () => void; onChooseStorage: (x: number, y: number) => void;
}) {
  const w = s.scenario, chemical = productType >= 220;
  const name = (type: number) => type >= 220 ? chemicals[type - 220] : `${crops.find(c => `${c.id}.crp` === w.cropFiles[type - 192])?.name ?? w.cropFiles[type - 192]} seeds`;
  const price = (type: number) => ((type >= 220 ? w.chemicalDefinitions[type - 220] : w.seedDefinitions[type - 192]).price << 16 >> 16) >>> 0;
  const stores = w.buildings.filter(b => b.slot && b.active && b.type >= (chemical ? 66 : 64) && b.type <= 69);
  const selected = position ? findBuilding(w, position.x, position.y) : undefined;
  const quote = position ? checkCropSupplyPurchase(w, productType, position.x, position.y, s.weather.soilMoisture) : null;
  const stock = chemical ? w.chemicals.filter(c => c.active && c.type === productType).length : w.inventory.filter(i => i.active && i.type === productType).length;
  const result = s.lastCropSupplyPurchaseResult;
  return <section id="crop-supply-shop" className="land-panel">
    <h2 ref={headingRef} tabIndex={-1}>Seeds &amp; chemicals</h2>
    <p>Buy supplies in advance and deliver them into storage. Planting and field treatments use your stock automatically.</p>
    <label className="crop-label">Supply <select id="crop-supply-type" value={productType} onChange={e => onTypeChange(Number(e.target.value))}>
      {[...w.cropFiles.map((_, i) => 192 + i), 220, 221, 222, 223].map(type => <option key={type} value={type}>{name(type)} · {money(price(type))}</option>)}
    </select></label>
    <p id="crop-supply-stock">In stock: {stock} · {money(price(productType))} per purchase.</p>
    <p>{chemical ? 'Chemicals need equipment storage.' : 'Seeds fit in crop or equipment storage.'} One purchase supplies one planting or treatment application. Stored supplies can deteriorate over time.</p>
    <label className="crop-label">Deliver to <select id="crop-supply-storage" value={stores.some(b => b.slot === selected?.slot) ? selected!.slot : ''}
      onChange={e => {
        const b = stores.find(b => b.slot === Number(e.target.value)); if (!b) return;
        const d = w.buildingDefinitions[b.type - 64];
        for (let x = b.x; x < b.x + d.width; x++) for (let y = b.y; y < b.y + d.height; y++)
          if (!(w.cells[worldIndex(x, y)].terrain & 0x800)) { onChooseStorage(x, y); return; }
        onChooseStorage(b.x, b.y);
      }}>
      <option value="">Choose storage…</option>
      {stores.map(b => <option key={b.slot} value={b.slot}>Building {b.slot} · {b.x}, {b.y} · {Array.from({ length: w.buildingDefinitions[b.type - 64].width }, (_, x) => Array.from({ length: w.buildingDefinitions[b.type - 64].height }, (_, y) => b.content(x * 3 + y))).flat().filter(c => c.type === -1).length} free spaces</option>)}
    </select></label>
    {!stores.length && <p>No compatible storage yet. Build equipment storage for seeds and all four chemicals.</p>}
    <button onClick={onChooseMap}>Choose on map</button> <button onClick={onBuild}>Build storage</button>
    <p id="crop-supply-quote" role="status">{quote ? quote.ok
      ? `${name(productType)} · ${money(quote.price + quote.clearingCost)} total · Delivery to building ${quote.buildingSlot} at ${quote.x}, ${quote.y}.`
      : messages[quote.reason] : 'Choose a storage building to review the purchase.'}</p>
    <button id="buy-crop-supply" disabled={!quote?.ok} onClick={() => position && onCommand({ type: 'buy-crop-supply', productType, ...position })}>Buy supply</button>
    {result && <p id="crop-supply-result" role="status">{result.ok ? `${name(result.productType)} purchased for ${money(result.price + result.clearingCost)} and placed in building ${result.buildingSlot}.` : messages[result.reason]}</p>}
  </section>;
}
