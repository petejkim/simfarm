import type { CropDefinition } from '../formats/crop';
import type { Scenario } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';

interface Props {
  scenario: Scenario;
  crops: CropDefinition[];
  field?: FieldRecord;
  onSelect: (slot: number | null) => void;
}
export function FieldPanel({ scenario, crops, field, onSelect }: Props) {
  const fields = scenario.fields.filter(f => f.active);
  const cropName = (f: FieldRecord) => crops.find(c => `${c.id}.crp` === scenario.cropFiles[f.cropSlot])?.name ?? scenario.cropFiles[f.cropSlot];
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
  </section>;
}
