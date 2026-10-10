import type { CropDefinition } from '../formats/crop';
import type { Scenario } from '../formats/scenario';
import type { HarvestSaleResult } from '../simulation/harvest-sale';

interface Props {
  scenario: Scenario;
  crops: CropDefinition[];
  values: readonly (number | null)[];
  result: HarvestSaleResult | null;
  onSell: (slot: number) => void;
}

export function HarvestInventory({ scenario, crops, values, result, onSell }: Props) {
  const items = scenario.inventory.filter(i => i.active && i.type >= 168 && i.type < 168 + scenario.cropFiles.length);
  return <section className="harvest-inventory">
    <span className="eyebrow">HARVEST IN STORAGE</span>
    <p id="harvest-stock">{items.length ? `${items.length} stored harvest${items.length === 1 ? '' : 's'}` : 'No stored harvests.'}</p>
    {items.length > 0 && <>
      <ul id="harvest-items">{items.map(item => {
        const file = scenario.cropFiles[item.type - 168];
        const name = crops.find(c => `${c.id}.crp` === file)?.name ?? file;
        return <li key={item.slot}>{name} · Quantity {item.quantity} · Loss {Math.floor(item.loss * 100 / 65535)}%
          <button className="sell-harvest" onClick={() => onSell(item.slot)} aria-label={`Sell ${name}, lot ${item.slot}, for $${values[item.slot] ?? 0}`}>
            Sell for ${(values[item.slot] ?? 0).toLocaleString('en-US')}</button>
        </li>;
      })}</ul>
    </>}
    {result && <p id="sale-result" role="status">{result.ok ? `Harvest sold for $${result.value.toLocaleString('en-US')}.`
      : result.reason === 'invalid-item' ? 'This harvest is no longer available.' : 'Cannot sell: the inventory and storage records do not match.'}</p>}
  </section>;
}
