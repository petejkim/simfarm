import { useState } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkManualAssetSale, type AssetSaleKind } from '../simulation/manual-asset-sale';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const reasons = {
  'rented-equipment': 'Rented machinery cannot be sold.', 'invalid-asset': 'The selected asset is no longer available.',
  'asset-busy': 'This machine is in use. Finish its work before selling.',
  'inconsistent-asset': 'This asset has inconsistent storage, ownership or links and cannot be sold.',
};
export function AssetSaleControls({ kind, snapshot, onCommand, onLocate }: {
  kind: AssetSaleKind; snapshot: GameSnapshot; onCommand: (command: GameCommand) => void; onLocate: (x: number, y: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const records = kind === 'animal' ? snapshot.scenario.animals.filter(a => a.active)
    : snapshot.scenario.equipment.filter(e => e.active && !(e.flags & 64));
  const record = records.find(r => r.slot === selected) ?? records[0];
  const quote = record ? checkManualAssetSale(snapshot.scenario, snapshot.finances, kind, record.slot, snapshot.weather.soilMoisture) : null;
  const label = kind === 'animal' ? 'animal' : 'machine';
  const name = (type: number) => kind === 'animal' ? ['Horse', 'Cow', 'Pig', 'Sheep'][type - 160] ?? `Animal type ${type}` : type === 8 ? 'Aircraft' : `Machine type ${type}`;
  const result = snapshot.lastAssetSaleResult?.kind === kind ? snapshot.lastAssetSaleResult : null;
  return <div className="asset-sale">
    <fieldset className="farm-actions" disabled={Boolean(snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight)}>
      <legend>Sell {kind === 'animal' ? 'livestock' : 'machinery'}</legend>
      {record ? <>
        <label>Choose {label} <select id={`sale-${kind}-selection`} value={record.slot} onChange={e => setSelected(Number(e.target.value))}>
          {records.map(r => <option key={r.slot} value={r.slot}>{name(r.type)} {r.slot} · {r.x}, {r.y}</option>)}
        </select></label>
        <p id={`sale-${kind}-quote`}>{quote?.ok ? `Sale amount: ${money(quote.value)}` : quote && reasons[quote.reason]}</p>
        <div className="asset-sale-buttons">
          <button id={`sell-${kind}`} disabled={!quote?.ok} onClick={() => onCommand({ type: 'sell-asset', kind, slot: record.slot })}>
            Sell {label}{quote?.ok ? ` for ${money(quote.value)}` : ''}
          </button>
          <button id={`locate-sale-${kind}`} onClick={() => onLocate(record.x, record.y)}>Show on map</button>
        </div>
        {quote?.ok && quote.value < 0 && <p>This original valuation deducts money when sold.</p>}
      </> : <p>No {kind === 'animal' ? 'animals' : 'owned machines'} available to sell.</p>}
      {kind === 'equipment' && <p>Rented machinery cannot be sold.</p>}
    </fieldset>
    {result && <p id={`sale-${kind}-result`} role="status">{result.ok
      ? `${kind === 'animal' ? 'Animal' : 'Machine'} ${result.slot} sold for ${money(result.value)}.` : reasons[result.reason]}</p>}
  </div>;
}
