import type { CropDefinition } from '../formats/crop';
import type { Scenario } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';
import { useState } from 'react';
import type { PlantResult } from '../simulation/plant-order';

interface Props {
  scenario: Scenario;
  crops: CropDefinition[];
  field?: FieldRecord;
  onSelect: (slot: number | null) => void;
  onPlant: (fieldSlot: number, cropSlot: number) => void;
  plantResult: PlantResult | null;
}
export function FieldPanel({ scenario, crops, field, onSelect, onPlant, plantResult }: Props) {
  const [cropSlot, setCropSlot] = useState(0);
  const fields = scenario.fields.filter(f => f.active);
  const cropName = (f: FieldRecord) => crops.find(c => `${c.id}.crp` === scenario.cropFiles[f.cropSlot])?.name ?? scenario.cropFiles[f.cropSlot];
  const seedAvailable = scenario.inventory.some(i => i.active && i.type === 192 + cropSlot);
  const seedCost = seedAvailable ? 0 : (scenario.seedDefinitions[cropSlot].price + 20) & 0xffff;
  const busy = field && (![0, 2, 4].includes(field.state) || field.equipment !== 0 || field.pendingEquipment !== 0);
  const messages = { 'invalid-field': 'Select a field first.', 'field-busy': 'This field is already being worked.',
    'invalid-crop': 'Select a crop available on this farm.', 'no-seeds': 'No seed in stock. Automatic seed buying is disabled.',
    'insufficient-funds': 'There is not enough cash to buy seed.' };
  return <section className="field-panel">
    <span className="eyebrow">YOUR FIELDS</span>
    <label className="crop-label">Locate a field <select id="field" value={field?.slot ?? ''}
      onChange={e => onSelect(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Choose a field…</option>
      {fields.map(f => <option key={f.slot} value={f.slot}>Field {f.number} · {cropName(f)}</option>)}
    </select></label>
    <p id="field-status">{field
      ? `Field ${field.number} · ${field.status} · ${field.width} × ${field.height} tiles at ${field.x}, ${field.y}`
      : `${fields.length} fields in this farm. Select a field to inspect it.`}</p>
    {field && <p id="field-growth">{field.state === 4 ? `Crop age: ${field.bytes[34]} weeks · ` : ''}
      Water: {field.bytes[24] | field.bytes[25] << 8} · Fertility: {field.bytes[29]} / 255</p>}
    {field && <div className="plant-controls">
      <label className="crop-label">Crop to plant <select id="plant-crop" value={cropSlot} onChange={e => setCropSlot(Number(e.target.value))}>
        {scenario.cropFiles.map((file, slot) => <option key={slot} value={slot}>{crops.find(c => `${c.id}.crp` === file)?.name ?? file}</option>)}
      </select></label>
      <p>{seedAvailable ? 'Uses seed in stock.' : `Seed: $${seedCost}, including delivery.`}
        {scenario.farm.autoRent ? ' Missing equipment is rented automatically.' : ' Uses owned equipment only.'}
        {field.state === 4 ? ' Replaces the current crop.' : ''}</p>
      <button id="plant-field" disabled={Boolean(busy)} onClick={() => onPlant(field.slot, cropSlot)}>Plant crop</button>
      {field.state === 3 && <p id="plant-progress">{field.step <= 2 || field.step === 7 ? 'Preparing machinery…'
        : field.step <= 6 ? 'Preparing the field…' : 'Sowing seed…'}</p>}
    </div>}
    {plantResult && <p id="plant-result" role="status">{plantResult.ok
      ? `Planting ordered. ${plantResult.source === 'stored' ? 'Used seed in stock.' : `Seed cost: $${plantResult.cost}.`} Press Play or Next day to advance work.`
      : messages[plantResult.reason]}</p>}
  </section>;
}
