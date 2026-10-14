# Requested gameplay corrections

User authorized these twelve native corrections on2026-10-13, one conventional commit per issue. Original executable/data remain immutable; original behavior, addresses and source-pin tests stay in original-bugs.md. Existing checkpoints remain readable and use the corrected rules going forward; no history is replayed.

| Issue | Scope | Status |
| --- | --- | --- |
| SF-071 | Loan arrears settlement | Complete; principal, credit and town allocations settle once for direct/forced payments. |
| SF-074 | Full payoff clears overdue loan state | Complete; repayment clears loan-only debt/countdown, including explicit legacy repair. |
| SF-129 | Wind damage cadence | Complete; one nutrient per exposed field per full game day, with saved clock updates. |
| SF-001 | Regional-condition subtraction | Complete |
| SF-026 | Duplicate crop-income posting | Complete |
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


## SF-129 — wind damage clock

Accepted wind start now captures its animation tick; rejected starts keep the previous clock. Each accepted damage interval advances the canonical windReferenceTick. Native policy is one nutrient unit per exposed active field per full game day (`elapsed>dayDelay`), not each animation call. Retains the source tree protection threshold, sparse-record guard and unsigned16-bit elapsed/wrap. This is an explicitly authorized native cadence correction, not proof of original intent or absence of all indirect DOS writers. Uses the existing checkpoint field; loading does not reset it or replay damage.

Checks: build/type checking;10wind/live-disaster cases(1.89s);1browser cadence/load scenario(2.4s). The first draft test overlooked odd-day soil recovery+1 and read fields from the serialized envelope rather than the decoded scenario; corrected only those assertions, then all passed. Paired no-wind baseline establishes exactly one unit of damage despite recovery; pause/save/restore/wrap and rejected starts are covered. Logs artifacts/bugfix-129-*.log.


## SF-001 — native correction

Regional toxicity, disease, pests, weeds and nutrient reductions now saturate at zero, matching local field subtraction. The reversed original branches and examples remain preservation evidence; unknown channels and unrelated nutrient modes remain unchanged.

Checks: Build/type checking,22 focused simulation/treatment/weekly tests and1 browser all-treatment flow pass. Exhaustive256×256 reductions cover all five affected channels; unrelated regional bytes remain intact. Logs artifacts/bugfix-001-*.log.


## SF-026 — native correction

Stored harvest sales now post income once through creditHarvest, matching cash and taxable sales. Removal validation, storage release, cash cap and unsigned ledger wrap remain intact; prior duplicated history is not rewritten.

Checks: Build/type checking,21 harvest/default unit cases and1 browser all24-crop sale/reload flow pass. Independent browser assertions equate income and sales increments to proceeds. The forced-sale test expectation was updated after its retained double-post assertion failed. Logs artifacts/bugfix-026-*.log.
