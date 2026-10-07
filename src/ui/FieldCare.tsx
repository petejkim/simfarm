import { useState } from 'react';
import type { FieldRecord } from '../formats/field';
import type { Scenario } from '../formats/scenario';
import { TREATMENTS, type Treatment, type TreatmentResult } from '../simulation/field-treatment';

interface Props {
  scenario: Scenario;
  field: FieldRecord;
  result: TreatmentResult | null;
  onTreat: (fieldSlot: number, treatment: Treatment) => void;
}
const names: Record<Treatment, string> = { fertilizer: 'Fertilizer', pesticide: 'Pesticide', herbicide: 'Herbicide', fungicide: 'Fungicide' };
const effects: Record<Treatment, string> = { fertilizer: 'Restores soil nutrients.', pesticide: 'Removes current pests and reduces their return.',
  herbicide: 'Removes current weeds and reduces their return.', fungicide: 'Removes current fungus and reduces its return.' };
const failures = { 'invalid-field': 'Select a field first.', 'invalid-treatment': 'Choose a treatment.',
  'field-busy': 'Wait for the current field work to finish.', 'no-supplies': 'No supply in stock. Automatic supply buying is disabled.',
  'insufficient-funds': 'There is not enough cash to buy this supply.', 'inconsistent-stock': 'Stored supplies could not be removed.' };

export function FieldCare({ scenario, field, result, onTreat }: Props) {
  const [treatment, setTreatment] = useState<Treatment>('fertilizer');
  const type = 220 + TREATMENTS.indexOf(treatment);
  const stock = scenario.chemicals.filter(c => c.active && c.type === type).length;
  const busy = ![0, 4].includes(field.state) || Boolean(field.equipment || field.pendingEquipment);
  const treating = field.state >= 6 && field.state <= 9;
  return <div className="field-care">
    <label className="crop-label">Field care <select id="field-treatment" value={treatment} onChange={e => setTreatment(e.target.value as Treatment)}>
      {TREATMENTS.map(t => <option value={t} key={t}>{names[t]}</option>)}
    </select></label>
    <p id="treatment-quote">{stock ? `${stock} in stock · Uses one supply.` : 'Supply: $275, including delivery.'}
      {scenario.farm.autoRent ? ' Missing equipment is rented automatically.' : ' Uses owned equipment only.'}</p>
    <p>{effects[treatment]}{treatment !== 'fertilizer' && ' Spraying also increases soil toxicity.'}</p>
    <button id="treat-field" disabled={busy} onClick={() => onTreat(field.slot, treatment)}>Apply {treatment}</button>
    {treating && <p id="treatment-progress" role="status">{field.step <= 2 ? 'Preparing treatment equipment…'
      : field.step <= 4 ? 'Bringing the sprayer to the field…' : 'Treating the field…'}</p>}
    {result && (!result.ok || result.fieldSlot === field.slot) && <p id="treatment-result" role="status">{result.ok
      ? `${names[result.treatment]} ordered. ${result.source === 'stored' ? 'Used one supply in stock.' : `Supply cost: $${result.cost}.`} Press Play or Next day to advance work.`
      : failures[result.reason]}</p>}
    <p id="field-health">Pests: {field.bytes[20]} · Weeds: {field.bytes[21]} · Fungus: {field.bytes[22]}<br />Soil toxicity: {field.bytes[32]} / 255</p>
  </div>;
}
