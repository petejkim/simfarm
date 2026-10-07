import type { GameSnapshot } from '../simulation/game';
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const notices: Record<number, string> = {
  159: 'Annual taxes could not be paid. The debt will be retried monthly.',
  161: 'Your estimated annual tax exceeds your available cash.',
  162: 'Taxes remain unpaid.', 163: 'The overdue tax has been paid.', 165: 'Assets were sold to pay overdue tax.',
};
export function TaxPanel({ snapshot }: { snapshot: GameSnapshot }) {
  const { finances: f, taxAssessment: quote, lastTaxSettlement: last } = snapshot;
  return <details id="tax-panel" className="loan-panel">
    <summary>Taxes</summary>
    <dl>
      <div><dt>Estimated next annual tax</dt><dd id="tax-estimate">{money(quote.total)}</dd></div>
      <div><dt>Unpaid taxes</dt><dd id="tax-debt">{money(f.debt.unpaidTaxes)}</dd></div>
      <div><dt>Tax payments this year</dt><dd>{money(f.accounts.taxExpenses)}</dd></div>
      <div><dt>Previous year's tax payments</dt><dd id="tax-prior">{money(f.annual.priorTaxExpenses)}</dd></div>
    </dl>
    <p>Taxes are collected at year-end. The estimate includes sales tax, owned land and any unpaid tax; it changes as your farm changes.</p>
    {f.debt.taxCountdown > 0 && <p id="tax-retries">{f.debt.taxCountdown} monthly retries remaining before assets may be sold to cover the debt.</p>}
    <p id="tax-result" role="status">{last && `${last.paid ? 'Paid' : 'Unable to pay'} ${money(last.assessment.total)} in annual tax.`}</p>
    <p id="tax-notices" role="status">{snapshot.financeNotices.map(id => notices[id]).filter(Boolean).join(' ')}</p>
  </details>;
}
