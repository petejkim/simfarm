# Original finances

Evidence refers to supplied `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets. Analysis is static; no DOS code is executed. The provisional monthly `$40 + debt*0.005` charge in `../simfarm2/src/simulation.js` is not original-game evidence and is not used here.

## Tax assessment — implemented primitive, high confidence

Resident `1a66:0cc0`, file `0x1d520..0x1d5c2`, calculates annual payment. Its cash comparisons are unsigned; division helper `0084:33f8` / `0x5e38` is signed long division, truncating toward zero.

| Cash (`6190:3e48`) | Divisor applied to sales (`6190:3e44`) |
| --- | --- |
| Below 150,000 | 10 |
| 150,000 through 499,999 | 5 |
| 500,000 and above | 3 |

The dword result is `trunc(signed32(sales)/divisor) + unpaidTaxes + trunc(playerLandValue/99)`, with 32-bit addition wrapping. It uses the sales accumulator, not crop-income ledger `3e60` or net profit. SF-026's stored-sale double posting therefore does not itself double this sales component. Unpaid taxes are `6190:7518`, restored from SSM `0x21726` by `0x4622e..0x46243`. Countdown byte `4d9f:fed7` follows at SSM `0x2172a`. The calculator reads debt regardless of countdown. Debug strings at `0x8e3ad`, `0x8e3e1` and `0x8e408` corroborate the tax interpretation.

Land value comes through manager `24e6:10c8`, thunk file `0x28128`, to overlay 15:2008 / `0x3cba8..0x3cc1f`. It scans the 12×12 table, summing only ownership code **1** through existing valuation `0x3c766`. Other ownership codes do not contribute plots, but all nonzero codes increase the common per-plot base. Each quote clears DX at `0x3c83b`; summation uses ADD/ADC. Fertility, current signed soil moisture and first-map-word bit `0x1000` affect taxation as they affect buying land.

`src/simulation/tax.ts` ports valuation and assessment. Arrears are explicit input until payment state is integrated. This primitive neither resets sales nor charges cash. Tests pin source instructions, both thresholds, signed/unsigned boundaries, separate truncation, ownership codes, map corners, all supplied farms and non-mutation. SF-043 records signed-sales overflow without claiming ordinary-play reachability.

## Calendar and payment dependencies — traced, not integrated

Monthly `0xcc40..0xccee` retries a balance at `2d9f:d5ba` while countdown `4d9f:fed6` is nonzero, through debit category 1000. Tax retries `0xccee..0xcd9a` use countdown `fed7`, debt `6190:7518` and category 2500. Failed attempts decrement the countdown and eventually call forced-sale routine `1a66:0f06` / `0x1d766` with reason 39 or 36. The full default/forced-sale behavior and first balance's origination remain to be recovered; no flat monthly upkeep or interest rate is established.

Months 6 and 9 (zero-based, after increment) warn when assessment exceeds cash with no active tax countdown (`0xcd9a..0xcddd`). At year-end, after old-plan row 48 executes and month resets, `0xcdf4` calls annual collection `0x1d5c4`, `0xcdf9` calls ledger reset `0x1d396`, then `0xcdfe` projects crop plans. The native clock currently implements only those schedule operations.

Annual collection calculates tax, clears sales first, attempts debit category 2500, then recomputes total town residential level through manager `10dc` → overlay 15:067a / `0x3b21a`. This scans town-owned regions (code 2) through counter `0x3c5c8` (the high nibble of the first regional byte, not a population count). Failed payment adjusts existing debt, increments `6190:3eed`, writes negative assessment to `6190:758a`, emits notice 159 and sets the countdown to three (`0x1d615..0x1d67e`). The debt formula includes both old debt and the assessment, which already includes old debt; retain that observation pending the complete lifecycle before judging intent.

Successful payment allocates receipts between town balances `758a/758e` using a low-word `residentialLevels*200` threshold and signed dword comparisons (`0x1d684..0x1d765`). Some branches invoke town development through manager `10d2` → overlay 15:13da / `0x3bf7a`. These balances/callbacks need reconstruction and checkpointing before connecting annual collection. A standalone tax debit would omit original town behavior.

## Ledger evidence

Dispatcher `0x1c88e..0x1ca27` checks unsigned affordability and adds expenses with uint32 wrap. Verified destinations: seeds 192–215 → `3e78`, chemicals 220–223 → `3ea0`, workers 500–503 → `3e88`, balance payment 1000 → `3ea4`, rentals 1500 → `3ea8`, land 2000 → `3e80`, taxes 2500 → `3eb4`, category -1 → `3eac`. Import retains the duplicate land destination, SF-014. Unexplained ledger meanings remain unnamed.

Report `0x1d460..0x1d51e` sums income from `3e6c,3e64,3e68,3e60,3e74,3e70`; expenses from `3eac,3ea8,3e9c,3e98,3e94,3e90,3e8c,3eb4,3e40,3e84,3e80,3e7c,3e78`. Totals go to `3ebc/3ec0`, their difference to `2d9f:fa18`. Worker and chemical expenses are omitted (SF-041). Payment ledger `3ea4` is also absent, although excluding principal may be intentional.

Reset `0x1d396..0x1d456` clears `3e60..3e84` and `3e8c..3eac`, skipping worker expenses `3e88` (SF-042). It clears `2412`, moves tax ledger `3eb4` to `3e40`, then clears `3eb4`. Do not substitute clearing every finance field: tax carry and the worker omission are distinct source behavior. Report/reset integration and saved-state migration remain pending.

Next recover town receipt/development and forced-sale/default dependencies, map live finance state and checkpoint migration, then integrate original payment/reset ordering and expose finances in React. Full finances and the overall game remain incomplete.

## Annual settlement and town expansion reservation — implemented primitives

`settleAnnualTax` now implements the financial branches of `0x1d5c4..0x1d765`. Its explicit account stores raw dword bits for unpaid taxes, tax expenses, town revenue and expansion funds, plus byte failure/countdown fields. It validates all account inputs before mutation, clears sales before attempted payment, and posts successful payment to the tax ledger. This account is not yet part of live GameSimulation/checkpoints; no saved field meanings are guessed.

Failure computes `oldDebt + (oldDebt >>> 2) + (signed32(assessment) >> 2) + assessment`, retaining 32 bits; increments the failure byte with wrapping; sets revenue to negative assessment and countdown to three. A zero assessment takes this branch too (SF-044). Success intentionally leaves debt/countdown unchanged, matching the original; the implications across the monthly retry lifecycle remain to be tested. Tax-ledger addition wraps as before.

Town maintenance is the low word of `totalResidentialLevels * 200` (SF-045). Let R be revenue after adding the payment, F be expansion funds, and M maintenance. If signed R < M, combined signed `(R+F)` below M leaves revenue `R+F-M` and zero funds; otherwise the reserve covers the shortfall, leaving zero revenue and funds `R+F-M`. Neither branch offers expansion. Otherwise a signed arithmetic quarter of the **payment**, not total revenue, moves to expansion funds; revenue decreases by that quarter plus maintenance, then the town-expansion routine is requested. The return flag is an explicit dependency, not a constructed district.

`townStatistics` ports `0x3b21a` and `0x3c5c8`. Loader `0x45a96..0x45abf` proves regional channel 0 maps to `6190:949c`: low nibble is district type and high nibble its level. Count/sum includes only ownership 2. Debug text at DS `9d50` calls the sum “Total Residential Level”; its displayed maintenance multiplier 8 differs from actual annual allocation’s 200, so the display string must not supply the simulation rule.

`findTownExpansionSite` ports `0x3c3e6..0x3c4f7`: radii 1–11 around saved town origin, scanning each inclusive square x-first, y-second. It skips coordinates outside 0–11, nonzero ownership and any plot tile with **terrain** bits `0x3000`. It does not impose adjacency, use Euclidean distance or check overlay flags. `beginTownExpansion` ports the pre-choice operations of `0x3bf7a`: if signed expansion funds afford 15,000 and a site exists, deduct that amount and set ownership 2, returning a pending site without changing player cash or map tiles. The original town quote `0x3c840` averages two locals that remain zero, so only base `6190:7516` contributes.

Inspected imported original `public/assets/twnchoic.bmp.png` (archive member `twnchoic.bmp`, generated asset remains ignored). The four choices are Residential (types 6–13), Commercial (types 1–3), Airport (type 5) and Recreational (type 4). They call district constructor `0x3aba0`. Timeout `0x3c37f..0x3c3a3` selects `below(14)+1`; interactive variants consume the original simulation RNG differently. Choice resolution, constructor/road connections, recreation restrictions, airport effects and the town growth/degradation tick remain pending. The browser implementation must retain a pending choice in simulation state and native checkpoints, with React sending the selection.

## Default path findings — not implemented

Forced-sale `0x1d766..0x1db7e` attempts stored crops, livestock, non-rented equipment, then player land, retrying the entire debt after sales. Land handling removes overlapping fields first. It ends with a game-over/restart choice if still unable to pay. Generic sale thunk `24e6:0fe2`, animal/equipment valuations, land sale and terminal state still require reconstruction. Source count-controlled scans need bounded native record access. Crop-sale retries swap the tax/other-payment ledger categories (SF-046); later categories use category zero. Do not claim default complete by selling only crops or by silently discarding remaining debt.

Validation: all thirteen tax/town tests pass, covering source bytes, all-eight-farm regional decoding, settlement branch thresholds, word/dword/byte arithmetic, preserved annual debt/countdown, invalid-input atomicity, original plot scan order and ownership reservation. Full suite/build/browser gates are recorded in progress.
