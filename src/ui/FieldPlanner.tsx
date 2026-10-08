import { useState, type Ref } from 'react';
import type { CropDefinition } from '../formats/crop';
import type { FieldRecord } from '../formats/field';
import type { Scenario } from '../formats/scenario';
import { describeScheduleEntry } from '../formats/field-schedule';
import type { FieldPlanEdit, FieldPlanEditResult } from '../simulation/field-plan-edit';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const actions = ['plant', 'fertilizer', 'pesticide', 'herbicide', 'fungicide', 'harvest', 'clear', 'contract'] as const;
const labels = { plant: 'Plant crop', fertilizer: 'Fertilize', pesticide: 'Apply pesticide', herbicide: 'Apply herbicide',
  fungicide: 'Apply fungicide', harvest: 'Harvest crop', clear: 'Clear remaining plan', contract: 'Lock crop price' };
const failures = { 'invalid-field': 'This field is unavailable.', 'invalid-week': 'Choose a week in the five-year plan.',
  'invalid-action': 'Choose a planning action.', 'invalid-crop': 'This crop cannot be scheduled.',
  'future-week-required': 'Choose a future week.', 'contract-current-week': 'Choose the current week to lock the crop price.',
  'not-growing': 'A growing crop is needed to lock a price.', 'already-contracted': 'This crop already has a price contract.',
  'protected-order': 'That week already has planting, harvest or a contract. Choose another week.',
  'fixed-harvest-week': 'This crop has a fixed annual harvest week.' };

interface EditorProps {
  scenario: Scenario; crops: CropDefinition[]; field: FieldRecord;
  result: (FieldPlanEditResult & { fieldSlot: number; week: number }) | null;
  onEdit: (fieldSlot: number, week: number, action: FieldPlanEdit) => void;
}

export function FieldPlanner({ scenario, crops, field, result, onEdit, open, onOpenChange, summaryRef, onSelect, onNewField }: Omit<EditorProps, 'field'> & {
  field?: FieldRecord; open: boolean; onOpenChange: (open: boolean) => void; summaryRef: Ref<HTMLElement>;
  onSelect: (slot: number | null) => void; onNewField: () => void;
}) {
  const fields = scenario.fields.filter(f => f.active);
  return <details id="field-planner" className="field-planner" open={open} onToggle={e => onOpenChange(e.currentTarget.open)}>
    <summary ref={summaryRef}>Crop plan{field ? ` · Field ${field.number}` : ''}</summary>
    <p>Plans run at the start of each week. Choose a field, then select a week to inspect or change it.</p>
    {fields.length ? <label className="crop-label">Plan for field <select id="planner-field" value={field?.slot ?? ''}
      onChange={e => onSelect(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Choose a field…</option>
      {fields.map(f => <option key={f.slot} value={f.slot}>Field {f.number} · {crops.find(c => `${c.id}.crp` === scenario.cropFiles[f.cropSlot])?.name ?? 'Unknown crop'}</option>)}
    </select></label> : <>
      <p>This farm has no fields yet. Create and plant a field to start planning.</p>
      <button onClick={onNewField}>Create a field</button>
    </>}
    {field && <PlannerEditor key={`${field.slot}-${scenario.farm.calendar.year}`} scenario={scenario} crops={crops} field={field} result={result} onEdit={onEdit} />}
  </details>;
}

function PlannerEditor({ scenario, crops, field, result, onEdit }: EditorProps) {
  const now = scenario.farm.calendar.month * 4 + scenario.farm.calendar.week;
  const [week, setWeek] = useState(now + 1), [kind, setKind] = useState<typeof actions[number]>('plant'), [cropSlot, setCropSlot] = useState(field.cropSlot);
  const yearOffset = Math.floor(week / 48), year = (scenario.farm.calendar.year + yearOffset) & 65535;
  const crop = (slot: number) => crops.find(c => `${c.id}.crp` === scenario.cropFiles[slot]);
  const cropName = (slot: number) => crop(slot)?.name ?? 'Unknown crop';
  const date = (row: number) => `${months[Math.floor(row % 48 / 4)]} ${(row % 4) * 7 + 1}–${(row % 4 + 1) * 7}, ${(scenario.farm.calendar.year + Math.floor(row / 48)) & 65535}`;
  const description = (row: number) => {
    const entry = describeScheduleEntry(scenario.schedule.get(row, field.slot - 1));
    switch (entry.kind) {
      case 'plant': return `Plant ${cropName(entry.cropSlot)}`;
      case 'crop-stage': return `${cropName(entry.cropSlot)} growing`;
      case 'harvest': case 'alternate-harvest': return 'Harvest';
      case 'fallow': return 'Fallow';
      case 'contract': return 'Price contract';
      case 'plow': return 'Plow';
      case 'unknown': return 'Unrecognized entry';
      default: return labels[entry.kind];
    }
  };
  const contracted = field.bytes[48] | field.bytes[49] << 8;
  const fixedHarvest = Boolean(crop(field.cropSlot)?.rawDefinition[76]);
  const blocked = kind === 'contract' ? week !== now || field.state !== 4 || Boolean(contracted)
    : week <= now || kind === 'harvest' && fixedHarvest;
  const feedback = result?.fieldSlot === field.slot ? result : null;
  return <>
    <label className="crop-label">Plan year <select id="plan-year" value={yearOffset} onChange={e => setWeek(Number(e.target.value) * 48 + week % 48)}>
      {Array.from({ length: 5 }, (_, i) => <option key={i} value={i}>{(scenario.farm.calendar.year + i) & 65535}</option>)}
    </select></label>
    <table className="plan-calendar" aria-label={`Field ${field.number} crop plan for ${year}`}>
      <thead><tr><th scope="col">Month</th>{[1, 2, 3, 4].map(n => <th scope="col" key={n}>W{n}</th>)}</tr></thead>
      <tbody>{months.map((month, m) => <tr key={month}><th scope="row">{month.slice(0, 3)}</th>
        {[0, 1, 2, 3].map(w => { const row = yearOffset * 48 + m * 4 + w;
          return <td key={w}><button type="button" aria-pressed={row === week} aria-current={row === now ? 'date' : undefined}
            aria-label={`${date(row)}: ${description(row)}`} title={description(row)} data-plan-week={row}
            onClick={() => setWeek(row)}>{w * 7 + 1}<span>{description(row)}</span></button></td>;
        })}</tr>)}</tbody>
    </table>
    <p id="plan-selection"><strong>{date(week)}</strong><br />{description(week)}{week === now ? ' · Current week' : week < now ? ' · Past week' : ''}</p>
    <label className="crop-label">Plan action <select id="plan-action" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
      {actions.map(action => <option key={action} value={action}>{labels[action]}</option>)}
    </select></label>
    {kind === 'plant' && <label className="crop-label">Planned crop <select id="plan-crop" value={cropSlot} onChange={e => setCropSlot(Number(e.target.value))}>
      {scenario.cropFiles.map((_, slot) => <option key={slot} value={slot}>{cropName(slot)}</option>)}
    </select></label>}
    {kind === 'plant' && <p>Replaces the plan from this week onward. Earlier weeks stay as they are.</p>}
    {kind === 'clear' && <p>Leaves the field fallow from this week through the end of the plan.</p>}
    {kind === 'contract' && <p>{contracted ? `Current price contract: $${contracted}.` : `Lock the current ${cropName(field.cropSlot)} price of $${scenario.cropDefinitions[field.cropSlot].price}. Choose the current week while the crop is growing.`}</p>}
    {kind === 'harvest' && fixedHarvest && <p>This crop has a fixed annual harvest week.</p>}
    {kind !== 'contract' && week <= now && <p>Choose a future week to change its plan.</p>}
    <button id="apply-plan" disabled={blocked} onClick={() => onEdit(field.slot, week, kind === 'plant' ? { kind, cropSlot } : { kind })}>Apply plan change</button>
    {feedback && <p id="plan-result" role="status">{feedback.ok ? `Plan updated for ${date(feedback.week)}.` : failures[feedback.reason]}</p>}
  </>;
}
