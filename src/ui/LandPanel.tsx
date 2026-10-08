import { useState } from 'react';
import type { CropDefinition } from '../formats/crop';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { quoteLand } from '../simulation/land';
import { checkFieldPlacement } from '../simulation/field-placement';

export type MapTool = 'inspect' | 'land' | 'field' | 'build' | 'irrigation' | 'livestock' | 'equipment';
interface Props {
  tool: MapTool;
  position: { x: number; y: number } | null;
  snapshot: GameSnapshot;
  crops: CropDefinition[];
  onCommand: (command: GameCommand) => void;
}
const messages = {
  'outside-map': 'The entire field must fit inside the map.', 'not-owned': 'Buy all the land under this field first.',
  'blocked-terrain': 'Terrain blocks this field. Enable automatic clearing for trees and fences; buildings and water still block placement.',
  'field-too-close': 'Leave at least one tile between fields.', 'no-field-slots': 'The farm has reached its field limit.',
  'no-seeds': 'No seed in stock. Automatic seed buying is disabled.', 'insufficient-funds': 'There is not enough cash to buy seed.',
  'invalid-crop': 'Select a crop available on this farm.', 'invalid-field': 'Select an available field.', 'field-busy': 'The field is already being worked.',
};

export function LandPanel({ tool, position, snapshot, crops, onCommand }: Props) {
  const [cropSlot, setCropSlot] = useState(0);
  const world = snapshot.scenario;
  const regionX = position ? position.x >> 3 : 0, regionY = position ? position.y >> 3 : 0;
  const quote = position ? quoteLand(world, regionX, regionY, snapshot.weather.soilMoisture) : null;
  const placement = position ? checkFieldPlacement(world, position.x, position.y) : null;
  const storedSeed = world.inventory.some(i => i.active && i.type === 192 + cropSlot);
  const seedCost = storedSeed ? 0 : (world.seedDefinitions[cropSlot].price + 20) & 0xffff;
  const result = snapshot.lastNewFieldResult, landResult = snapshot.lastLandResult;
  return <section className="land-panel">
    <span className="eyebrow">{tool === 'land' ? 'EXPAND YOUR FARM' : 'PLANT A NEW FIELD'}</span>
    {tool === 'land' ? <>
      <p>Click the map to select an 8 × 8 plot. Buying land includes its perimeter fences.</p>
      <p id="land-quote">{quote ? `Plot at ${regionX * 8}, ${regionY * 8} · ${quote.ownership === 1 ? 'Owned by you'
        : quote.ownership !== 0 ? 'Not for sale' : `$${quote.price.toLocaleString('en-US')}`}` : 'Select a plot on the map.'}</p>
      {quote && <p id="land-soil">Soil fertility: {quote.fertility} / 15</p>}
      {quote?.ownership === 0 && quote.price > world.farm.cash && <p>There is not enough cash to buy this plot.</p>}
      <button id="buy-land" disabled={!quote || quote.ownership !== 0 || quote.price > world.farm.cash}
        onClick={() => onCommand({ type: 'buy-land', regionX, regionY })}>Buy plot</button>
    </> : <>
      <p>Click the top-left corner of an 8 × 8 field on your land. Leave one tile between fields.</p>
      <label className="clearing"><input id="auto-clear" type="checkbox" checked={world.farm.autoClear}
        onChange={e => onCommand({ type: 'set-auto-clear', enabled: e.target.checked })} /> Automatically clear trees and fences</label>
      <p id="placement-status">{placement ? placement.ok ? `Ready to plant at ${position!.x}, ${position!.y}.` : messages[placement.reason]
        : 'Select a field location on the map.'}</p>
      <label className="crop-label">New field crop <select id="new-field-crop" value={cropSlot} onChange={e => setCropSlot(Number(e.target.value))}>
        {world.cropFiles.map((file, slot) => <option key={slot} value={slot}>{crops.find(c => `${c.id}.crp` === file)?.name ?? file}</option>)}
      </select></label>
      <p>{storedSeed ? 'Uses seed in stock.' : `Seed: $${seedCost}, including delivery.`}
        {world.farm.autoRent ? ' Missing equipment is rented automatically.' : ' Uses owned equipment only.'}</p>
      <button id="create-field" disabled={!placement?.ok} onClick={() => position && onCommand({ type: 'create-field', ...position, cropSlot })}>Create and plant field</button>
      {result && !result.ok && <p role="status" id="new-field-result">{messages[result.reason]}</p>}
    </>}
    {landResult && <p id="land-result" role="status">{landResult.ok
      ? `Bought plot at ${landResult.regionX * 8}, ${landResult.regionY * 8} for $${landResult.price.toLocaleString('en-US')}.`
      : landResult.reason === 'insufficient-cash' ? 'There is not enough cash to buy this plot.' : 'This plot cannot be purchased.'}</p>}
  </section>;
}
