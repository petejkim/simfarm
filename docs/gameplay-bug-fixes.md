# Requested gameplay corrections

User authorized these twelve native corrections on2026-10-13, one conventional commit per issue. Original executable/data remain immutable; original behavior, addresses and source-pin tests stay in original-bugs.md. Existing checkpoints remain readable and use the corrected rules going forward; no history is replayed.

| Issue | Scope | Status |
| --- | --- | --- |
| SF-071 | Loan arrears settlement | Complete; principal, credit and town allocations settle once for direct/forced payments. |
| SF-074 | Full payoff clears overdue loan state | Complete; repayment clears loan-only debt/countdown, including explicit legacy repair. |
| SF-129 | Wind damage cadence | Complete; one nutrient per exposed field per full game day, with saved clock updates. |
| SF-001 | Regional-condition subtraction | Complete |
| SF-026 | Duplicate crop-income posting | Complete |
| SF-041 | Report expense omissions | Complete |
| SF-042 | Worker expense annual reset | Complete |
| SF-046 | Forced-sale debt expense category | Complete |
| SF-006 | Water-stress warning | Complete |
| SF-007 | Fifth-cycle year-end temperature | Complete |
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


## SF-041 — native correction

Annual report expense totals now include canonical worker and chemical expenses exactly once. Net reflects both charges. Loan principal repayments remain excluded from operating expense totals; unresolved source ledger meanings and prior-tax presentation are not reinterpreted.

Checks: Build/type checking,5 annual-ledger unit cases and1 browser report/payment/reload flow pass. Independent totals include20 workers and30 chemicals and preserve cached checkpoint reports. Unsigned carry/borrow and malformed input are checked. Logs artifacts/bugfix-041-*.log.


## SF-042 — native correction

Worker expenses now reset with other annual costs after tax collection and any pending town choice. The same reset helper also applies to native fresh/restart setup; tax carry, reports and book values retain their existing ownership.

Checks: Build/type checking,11 annual/live unit cases and1 browser annual collection/choice/loan/reload flow pass. Worker costs clear independently and remain zero through continuation. Updated stale annual assertions for the earlier SF-071 principal/town settlement; production loan rules were not changed again. Logs artifacts/bugfix-042-*.log.


## SF-046 — native correction

Every successful forced-sale payment posts to the actual debt: reason36 taxExpenses/category2500, reason39 balancePayments/category1000. Crop, animal, machinery, land and failed-sale retries share that routing. Asset sale proceeds retain their income categories and cash is debited once.

Checks: Build/type checking,31 default/monthly/live-loan unit cases and1 browser direct/forced/mixed notices/default flow pass. Browser independently checks tax and loan liquidation postings. Original swapped-category source pins remain; stale monthly expectations were corrected. Logs artifacts/bugfix-046-*.log.


## SF-006 — native correction

Water warnings and growth share one classification using the recovered growth word tolerances, signed water and exclusive upper bound. Exact-upper water now warns wet; high modifiers no longer wrap warning thresholds as bytes. Random consumption and original stress-byte arithmetic remain unchanged.

Checks: Build/type checking,16 simulation/report unit cases and2 focused Evaluation browser flows pass, including actual grape water28 wet warning and exact reload. Unit boundaries cover all24 definitions plus a synthetic high-word definition and modifier/water extremes. Updated stale SF-041 report totals; initial browser fixture lacked grapes until expanded to all24. Logs artifacts/bugfix-006-*.log.


## SF-007 — native correction

Weekly temperature lookup now wraps the240-entry climate table at the fifth year-end, selecting entry0 instead of the adjacent wind global. Existing month/year phase order and climate-year rotation remain intact; source overread evidence stays documented.

Checks: Build/type checking,2 focused calendar/timing unit cases and1 browser fifth-year rollover/weather/reload case pass. Temperature70 and wind12 independently distinguish the correction. A temporary test-file generation error was fixed before successful checks; no unrelated tests were replaced. Logs artifacts/bugfix-007-*.log.
