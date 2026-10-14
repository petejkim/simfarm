# Requested gameplay corrections

User authorized these twelve native corrections on2026-10-13, one conventional commit per issue. Original executable/data remain immutable; original behavior, addresses and source-pin tests stay in original-bugs.md. Existing checkpoints remain readable and use the corrected rules going forward; no history is replayed.

| Issue | Scope | Status |
| --- | --- | --- |
| SF-071 | Loan arrears settlement | Complete; principal, credit and town allocations settle once for direct/forced payments. |
| SF-074 | Full payoff clears overdue loan state | Complete; repayment clears loan-only debt/countdown, including explicit legacy repair. |
| SF-129 | Wind damage cadence | Pending |
| SF-001 | Regional-condition subtraction | Pending |
| SF-026 | Duplicate crop-income posting | Pending |
| SF-041 | Report expense omissions | Pending |
| SF-042 | Worker expense annual reset | Pending |
| SF-046 | Forced-sale debt expense category | Pending |
| SF-006 | Water-stress warning | Pending |
| SF-007 | Fifth-cycle year-end temperature | Pending |
| SF-119 | Stored crop loss-rate flag | Pending |
| SF-051 | Recreation/airport demolition bookkeeping | Pending |

## SF-071 — loan arrears settlement

Monthly debt processing reports a successfully paid loan amount, including forced-sale proceeds. GameSimulation applies settleLoanArrears to the canonical loan/town owners after the monthly phase and before exposing any pending default. This reduces principal, clears the scheduled installment if fully settled, restores cached credit and allocates the same half/quarter town shares as on-time payment. The existing debit/expense posting occurs once. Failed/no payments do not settle anything; paying loan arrears before a tax default still settles the loan. Scheduled payment arithmetic and unrelated arrears replacement behavior are unchanged in this commit.

Checks:21unit cases covering loan/monthly/live phases, direct cash and liquidation, one-time settlement, next installment ordering and exact checkpoint continuation; one browser scenario covers direct/forced repayment notices, independent principal expectations, mixed tax/loan debt and terminal defaults. Type checking/build pass. Installed the two missing locked font dependencies locally after the merged checkout initially failed to resolve them; no package/lock change. Logs artifacts/bugfix-071-{unit,build,browser}.log. No new save schema or UI layout.


## SF-074 — full payoff clears loan arrears

Full payoff validates and clears the canonical overdue amount/countdown with principal/installment. Tax debt remains independent. Repay is available when an older checkpoint has zero principal but stale loan arrears/countdown; that explicit action clears the stale state for$0 without refunding history or mutating accounts. Unaffordable/malformed repayment fails before changes. No load-time repair, new schema or duplicate debit is introduced.

Checks: type checking/build,19loan/live unit cases(3.15s),3Bank browser cases(6.4s). Independent browser assertions cover ordinary payoff and zero-principal legacy state, exact principal/cash/debt, and a subsequent month with no stale installment collection. Unit checks retain tax debt, accounts and failed-payment atomicity. Logs artifacts/bugfix-074-*.log.
