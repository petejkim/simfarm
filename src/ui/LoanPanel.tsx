import { useState, type Ref } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { BANK_BUTTONS } from '../formats/bank-artwork';
import { loanInstallment } from '../simulation/loan';

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const failures = { 'invalid-amount': 'Enter a positive whole-dollar amount.', 'no-credit': 'No borrowing credit is available.',
  'cash-limit': 'Cash is already at its limit.', 'no-loan': 'There is no loan to repay.', 'insufficient-cash': 'There is not enough cash to pay off this loan.' };
const notices: Record<number, string> = { 166: 'The scheduled installment is overdue.', 168: 'Assets were sold to pay the overdue installment.',
  169: 'The overdue installment is still unpaid.', 170: 'The overdue installment has been paid.' };

export function LoanPanel({ snapshot, onCommand, onRestart, artwork, onClose, panelRef }: {
  snapshot: GameSnapshot; onCommand: (command: GameCommand) => void; onRestart: () => void;
  artwork: HTMLImageElement; onClose: () => void; panelRef: Ref<HTMLElement>;
}) {
  const [amount, setAmount] = useState(String(snapshot.finances.loan.selectedAmount)), [help, setHelp] = useState(false);
  const { finances: f, availableLoan, lastLoanResult: result } = snapshot, decision = f.defaultDecision;
  const requested = Number(amount), valid = /^\d+$/.test(amount) && Number.isSafeInteger(requested) && requested <= availableLoan;
  const blocked = Boolean(decision || snapshot.pendingTown || snapshot.aircraftFlight);
  function enter(value: string) {
    if (blocked) return;
    if (/^\d*$/.test(value)) setAmount(value === '' ? '' : String(Math.min(Number(value), availableLoan)));
  }
  function confirm() {
    if (blocked || !valid) return;
    if (!requested) { onClose(); return; }
    onCommand({ type: 'borrow', amount: requested }); setAmount('0');
  }
  function key(label: string) {
    if (label === 'C') setAmount('0');
    else if (label === '?') setHelp(value => !value);
    else if (label === 'CLOSE') onClose();
    else if (label === 'OK') confirm();
    else if (label === 'REPAY') onCommand({ type: 'repay-loan' });
    else enter(amount + label);
  }
  const installment = valid ? loanInstallment(requested, f.loanRate) : null;
  return <>
    {decision && <section className="default-panel" role="alert" aria-label="Financial default">
      <h2>{decision.status === 'pending' ? 'Unable to pay debts' : 'Farm session ended'}</h2>
      <p>Available assets could not cover the debt. Your homestead remains yours. Time and farm actions are stopped.</p>
      {decision.status === 'pending' ? <div>
        <button id="default-restart" onClick={() => { onCommand({ type: 'resolve-default', choice: 'restart' }); onRestart(); }}>Choose another farm</button>
        <button id="default-exit" onClick={() => onCommand({ type: 'resolve-default', choice: 'exit' })}>End session</button>
      </div> : <button onClick={onRestart}>Choose another farm</button>}
      <p>You can also load a saved farm or choose another scenario above.</p>
    </section>}
    <section id="loan-panel" className="bank-terminal" ref={panelRef} tabIndex={-1} aria-label="Loans"
      onKeyDown={event => {
        if (blocked || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement) return;
        if (/^[0-9]$/.test(event.key)) { event.preventDefault(); enter(amount + event.key); }
        else if (event.key === '.' || event.key.toLowerCase() === 'c') { event.preventDefault(); setAmount('0'); }
        else if (event.key === 'Backspace') { event.preventDefault(); enter(amount.slice(0, -1) || '0'); }
        else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); confirm(); }
      }}>
      <img src={artwork.src} width="288" height="224" alt="" draggable={false} />
      <span className="bank-label" style={{ left: 40, top: 23 }}>›CASH AVAILABLE :</span>
      <output className="bank-value" style={{ top: 23 }}>{money(snapshot.scenario.farm.cash)}</output>
      <span className="bank-label" style={{ left: 40, top: 39 }}>›TOTAL DEBTS :</span>
      <output id="loan-balance" className="bank-value" style={{ top: 39 }}>{money(f.loan.principal)}</output>
      <span className="bank-label" style={{ left: 40, top: 55 }}>›CREDIT LIMIT :</span>
      <output id="loan-credit" className="bank-value" style={{ top: 55 }}>{money(snapshot.loanCreditLimit)}</output>
      <span className="bank-label" style={{ left: 48, top: 71 }}>INTEREST RATE :</span>
      <output className="bank-value" style={{ top: 71 }}>{f.loanRate}%</output>
      <span className="bank-label" style={{ left: 48, top: 87 }}>QUARTERLY PAYMENT:</span>
      <output id="loan-installment" className="bank-value" style={{ top: 87 }}>{money(f.loan.scheduledPayment)}</output>
      <span className="bank-label" style={{ left: 40, top: 111 }}>›Use keypad to enter amount</span>
      <form onSubmit={event => { event.preventDefault(); confirm(); }}>
        <label className="bank-label" htmlFor="loan-amount" style={{ left: 80, top: 127 }}>LOAN AMOUNT</label>
        <input id="loan-amount" aria-label="Amount to borrow" type="text" inputMode="numeric" pattern="[0-9]+" autoComplete="off"
          value={amount} disabled={blocked} onChange={event => enter(event.target.value)} aria-describedby="loan-quote"
          title={installment === null ? 'Enter an amount within your available credit.' : `Adds ${money(installment)} to each scheduled installment.`}
          onKeyDown={event => { if (event.key === '.') { event.preventDefault(); setAmount('0'); } }} />
        {BANK_BUTTONS.map(button => <button key={button.id} type="button" className="bank-key"
          id={button.id === 13 ? 'borrow-loan' : button.id === 18 ? 'repay-loan' : undefined}
          style={{ left: button.x, top: button.y, width: button.width, height: button.height }}
          aria-label={button.id === 1 ? 'Clear loan amount' : button.id === 3 ? 'Bank help' : button.id === 13 ? 'Borrow' : button.id === 17 ? 'Close Bank terminal' : button.id === 18 ? 'Pay off loan' : button.label}
          aria-expanded={button.id === 3 ? help : undefined}
          disabled={button.id === 17 || button.id === 3 ? false : blocked || (button.id === 13 && !valid) || (button.id === 18 && (!f.loan.principal || f.loan.principal > snapshot.scenario.farm.cash))}
          onClick={() => key(button.label)}>{button.label}</button>)}
      </form>
      {help && <div className="bank-help" role="note"><span>Loan Amount<br />Entry Pad</span><span>Borrow<br />Amount</span><span>Repay<br />Loan<br />In Full</span></div>}
    </section>
    <div className="bank-feedback">
      <span id="loan-quote" className="bank-accessible">{installment === null ? 'Enter an amount within your available credit.' : `Adds ${money(installment)} to each scheduled installment.`}</span>
      {help && <p>Enter an amount, then OK to borrow. C clears the amount. OK with zero or Close returns to your farm. Installments are collected in January, March, July and October.</p>}
      {f.debt.balanceDue > 0 && <p id="loan-overdue">Overdue installment: {money(f.debt.balanceDue)} · {f.debt.balanceCountdown} monthly retries remaining.
        {' '}Paying off the main loan leaves this overdue installment payable separately.</p>}
      <p id="loan-result" role="status">{result && (result.ok ? result.kind === 'borrow'
        ? `Borrowed ${money(result.amount)}.` : `Paid off ${money(result.amount)}.` : failures[result.reason])}</p>
      <p id="loan-notices" role="status">{snapshot.financeNotices.map(id => notices[id]).filter(Boolean).join(' ')}</p>
    </div>
  </>;
}
