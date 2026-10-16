import { useState, type Ref } from 'react';
import { WindowContents } from './GameWindow';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { BANK_BUTTONS } from '../formats/bank-artwork';
import { BevelButton } from './chrome/BevelButton';
import { loanInstallment } from '../simulation/loan';

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
/** Original bank terminal (bankterm.bmp) rebuilt in CSS: a raised bezel around a deep recess holding the dark
 * screen (green readouts) and, below a ledge, the keypad bay with shared BevelButtons. No artwork is drawn. */
export function LoanPanel(props: Parameters<typeof LoanPanelBody>[0]) {
  return <WindowContents windowKey="bank"><LoanPanelBody {...props} /></WindowContents>;
}
function LoanPanelBody({ snapshot, onCommand, onClose, panelRef }: {
  snapshot: GameSnapshot; onCommand: (command: GameCommand) => void;
  onClose: () => void; panelRef: Ref<HTMLElement>;
}) {
  const [amount, setAmount] = useState(String(snapshot.finances.loan.selectedAmount)), [help, setHelp] = useState(false);
  const { finances: f, availableLoan } = snapshot, decision = f.defaultDecision;
  const requested = Number(amount), valid = /^\d+$/.test(amount) && Number.isSafeInteger(requested) && requested <= availableLoan;
  const blocked = Boolean(decision || snapshot.pendingTown || snapshot.townEvent.pending || snapshot.aircraftFlight);
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
  const keys = new Map<string, (typeof BANK_BUTTONS)[number]>(BANK_BUTTONS.map(b => [b.label, b]));
  const keyButton = (label: string, className: string) => { const b = keys.get(label)!;
    return <BevelButton key={b.id} className={`bank-key ${className}`} id={b.id === 13 ? 'borrow-loan' : b.id === 18 ? 'repay-loan' : undefined}
      aria-label={b.id === 1 ? 'Clear loan amount' : b.id === 3 ? 'Bank help' : b.id === 13 ? 'Borrow' : b.id === 17 ? 'Close Bank terminal' : b.id === 18 ? 'Pay off loan' : b.label}
      aria-expanded={b.id === 3 ? help : undefined}
      disabled={b.id === 17 || b.id === 3 ? false : blocked || (b.id === 13 && !valid) || (b.id === 18 && ((!f.loan.principal&&!f.debt.balanceDue&&!f.debt.balanceCountdown) || f.loan.principal > snapshot.scenario.farm.cash))}
      onClick={() => key(b.label)}>{b.label}</BevelButton>; };
  return <>
    <section id="loan-panel" className="bank-terminal" ref={panelRef} tabIndex={-1} aria-label="Loans"
      onKeyDown={event => {
        if (blocked || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement) return;
        if (/^[0-9]$/.test(event.key)) { event.preventDefault(); enter(amount + event.key); }
        else if (event.key === '.' || event.key.toLowerCase() === 'c') { event.preventDefault(); setAmount('0'); }
        else if (event.key === 'Backspace') { event.preventDefault(); enter(amount.slice(0, -1) || '0'); }
        else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); confirm(); }
      }}>
      <div className="bank-bezel"><div className="bank-recess">
        <div className="bank-screen">
          <div className="bank-readouts">
            <span className="bank-label">›CASH AVAILABLE :</span><output className="bank-value">{money(snapshot.scenario.farm.cash)}</output>
            <span className="bank-label">›TOTAL DEBTS :</span><output id="loan-balance" className="bank-value">{money(f.loan.principal)}</output>
            <span className="bank-label">›CREDIT LIMIT :</span><output id="loan-credit" className="bank-value">{money(snapshot.loanCreditLimit)}</output>
          </div>
          <div className="bank-readouts bank-box">
            <span className="bank-label">INTEREST RATE :</span><output className="bank-value">{f.loanRate}%</output>
            <span className="bank-label">QUARTERLY PAYMENT:</span><output id="loan-installment" className="bank-value">{money(f.loan.scheduledPayment)}</output>
          </div>
          {help ? <div className="bank-help" role="note"><span>Loan Amount<br />Entry Pad</span><span>Borrow<br />Amount</span><span>Repay<br />Loan<br />In Full</span></div> : <>
            <span className="bank-label bank-prompt">›Use keypad to enter amount</span>
            <div className="bank-amount">
              <label className="bank-label" htmlFor="loan-amount">LOAN AMOUNT</label>
              <input id="loan-amount" className="bank-box" aria-label="Amount to borrow" type="text" inputMode="numeric" pattern="[0-9]+" autoComplete="off"
                value={amount} disabled={blocked} onChange={event => enter(event.target.value)}
                title={installment === null ? 'Enter an amount within your available credit.' : `Adds ${money(installment)} to each scheduled installment.`}
                onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); confirm(); }
                  else if (event.key === '.') { event.preventDefault(); setAmount('0'); }
                }} />
            </div>
          </>}
        </div>
        <div className="bank-ledge" aria-hidden="true" />
        <div className="bank-bay">
          <div className="bank-keypad">{['7','8','9','C','4','5','6','?','1','2','3','0'].map(label => keyButton(label, 'bank-digit'))}</div>
          <div className="bank-actions">{keyButton('REPAY', 'bank-repay')}<div className="bank-action-row">{keyButton('OK', 'bank-ok')}{keyButton('CLOSE', 'bank-close')}</div></div>
        </div>
      </div></div>
    </section>
  </>;
}
