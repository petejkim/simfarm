import type { CropDefinition } from '../formats/crop';
import type { Scenario } from '../formats/scenario';

export function HarvestInventory({ scenario, crops }: { scenario: Scenario; crops: CropDefinition[] }) {
  const items = scenario.inventory.filter(i => i.active && i.type >= 168 && i.type < 184);
  return <section className="harvest-inventory">
    <span className="eyebrow">HARVEST IN STORAGE</span>
    <p id="harvest-stock">{items.length ? `${items.length} stored harvest${items.length === 1 ? '' : 's'}` : 'No stored harvests.'}</p>
    {items.length > 0 && <>
      <ul id="harvest-items">{items.map(item => {
        const file = scenario.cropFiles[item.type - 168];
        const name = crops.find(c => `${c.id}.crp` === file)?.name ?? file;
        return <li key={item.slot}>{name} · Quantity {item.quantity} · Loss {Math.floor(item.loss * 100 / 65535)}%</li>;
      })}</ul>
      <p>Stored-crop sales are not available yet.</p>
    </>}
  </section>;
}
