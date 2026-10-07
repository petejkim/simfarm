import { useState } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { loanInstallment } from '../simulation/loan';

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const failures = { 'invalid-amount': 'Enter a positive whole-dollar amount.', 'no-credit': 'No borrowing credit is available.',
  'cash-limit': 'Cash is already at its limit.', 'no-loan': 'There is no loan to repay.', 'insufficient-cash': 'There is not enough cash to pay off this loan.' };
const notices: Record<number, string> = { 166: 'The scheduled installment is overdue.', 168: 'Assets were sold to pay the overdue installment.',
  169: 'The overdue installment is still unpaid.', 170: 'The overdue installment has been paid.' };

export function LoanPanel({ snapshot, onCommand, onRestart }: {
  snapshot: GameSnapshot; onCommand: (command: GameCommand) => void; onRestart: () => void;
}) {
  const [amount, setAmount] = useState('1000');
  const { finances: f, availableLoan, lastLoanResult: result } = snapshot, decision = f.defaultDecision;
  const requested = Number(amount), valid = Number.isInteger(requested) && requested > 0 && requested <= availableLoan;
  const installment = valid ? loanInstallment(requested, f.loanRate) : null;
  return <>
    {decision && <section className="default-panel" role="alert" aria-label="Financial default">
      <h2>{decision.status === 'pending' ? 'Unable to pay debts' : 'Farm session ended'}</h2>
      <p>Available assets could not cover the debt. Your homestead remains yours. Time and farm actions are stopped.</p>
      {decision.status === 'pending' ? <div>
        <button id="default-restart" onClick={() => { onCommand({ type: 'resolve-default', choice: 'restart' }); onRestart(); }}>Restart this farm</button>
        <button id="default-exit" onClick={() => onCommand({ type: 'resolve-default', choice: 'exit' })}>End session</button>
      </div> : <button onClick={onRestart}>Start this farm again</button>}
      <p>You can also load a saved farm or choose another scenario above.</p>
    </section>}
    <details id="loan-panel" className="loan-panel">
      <summary>Loans</summary>
      <dl>
        <div><dt>Loan balance</dt><dd id="loan-balance">{money(f.loan.principal)}</dd></div>
        <div><dt>Scheduled installment</dt><dd id="loan-installment">{money(f.loan.scheduledPayment)}</dd></div>
        <div><dt>Available to borrow</dt><dd id="loan-credit">{money(availableLoan)}</dd></div>
        <div><dt>Current loan rate</dt><dd>{f.loanRate}%</dd></div>
      </dl>
      <p>Installments are collected at the start of January, March, July and October.</p>
      {f.debt.balanceDue > 0 && <p id="loan-overdue">Overdue installment: {money(f.debt.balanceDue)} · {f.debt.balanceCountdown} monthly retries remaining.
        {' '}Paying off the main loan leaves this overdue installment payable separately.</p>}
      <form onSubmit={event => { event.preventDefault(); if (valid) onCommand({ type: 'borrow', amount: requested }); }}>
        <label htmlFor="loan-amount">Amount to borrow</label>
        <input id="loan-amount" type="number" min="1" max={availableLoan} step="1" required value={amount}
          disabled={Boolean(decision)} onChange={event => setAmount(event.target.value)} />
        <span id="loan-quote">{installment === null ? 'Enter an amount within your available credit.' : `Adds ${money(installment)} to each scheduled installment.`}</span>
        <button id="borrow-loan" disabled={!valid || Boolean(decision)}>Borrow</button>
        <button id="repay-loan" type="button" disabled={Boolean(decision) || !f.loan.principal || f.loan.principal > snapshot.scenario.farm.cash}
          onClick={() => onCommand({ type: 'repay-loan' })}>Pay off loan</button>
      </form>
      <p id="loan-result" role="status">{result && (result.ok ? result.kind === 'borrow'
        ? `Borrowed ${money(result.amount)}.` : `Paid off ${money(result.amount)}.` : failures[result.reason])}</p>
      <p id="loan-notices" role="status">{snapshot.financeNotices.map(id => notices[id]).filter(Boolean).join(' ')}</p>
    </details>
  </>;
}
