import type { GameSnapshot } from '../simulation/game';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export function FarmReport({ snapshot }: { snapshot: GameSnapshot }) {
  const { farmReport: r, finances: f, scenario: { farm } } = snapshot, fields = r.fields;
  return <details id="farm-report" className="loan-panel">
    <summary>Farm report</summary>
    <dl>
      <div><dt>Reported income</dt><dd id="report-income">{money(r.income)}</dd></div>
      <div><dt>Reported expenses</dt><dd id="report-expenses">{money(r.expenses)}</dd></div>
      <div><dt>Reported net</dt><dd id="report-net">{money(r.net | 0)}</dd></div>
    </dl>
    <p>The original report includes carried-over taxes. Worker, chemical and loan payments are tracked separately and excluded from these totals.</p>
    <dl>
      <div><dt>Worker expenses</dt><dd id="report-workers">{money(farm.workerExpenses)}</dd></div>
      <div><dt>Chemical expenses</dt><dd id="report-chemicals">{money(farm.chemicalExpenses)}</dd></div>
      <div><dt>Loan payments</dt><dd id="report-loans">{money(f.accounts.balancePayments)}</dd></div>
    </dl>
    <h2>Field conditions</h2>
    <dl>
      <div><dt>Active fields</dt><dd id="report-fields">{fields.activeFields}</dd></div>
      <div><dt>Fields low in nutrients</dt><dd id="report-nutrients">{fields.nutrientDeficientFields}</dd></div>
      <div><dt>Fields with chemical stress</dt><dd id="report-toxicity">{fields.chemicallyStressedFields}</dd></div>
      <div><dt>Distinct field alerts</dt><dd id="report-alerts">{fields.distinctStatuses}</dd></div>
    </dl>
    <p>These counts use each field's latest recorded condition check. Select a field on the map to inspect it and order treatment.</p>
  </details>;
}
