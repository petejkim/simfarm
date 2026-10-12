# Original Balance Sheet

Evidence uses immutable SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Hexadecimal addresses are file offsets; initialized DS begins846f0. Static byte/disassembly reconstruction only. This increment replaces the interim combined financial disclosure with the original400×224 cashflow.bmp interior, real React text and the shared movable16-pixel wooden titlebar. No DOS/x86 code runs.

## Window and text

DSaaf8 flags0061 sets128,96 with400×240 outer size. DSaa3a is BALANCE SHEET and DSaa48 cashflow.bmp. Manager stubs2840c/28416 select overlay21 (base41610); paint08ee/file41efe forwards to41610, and button0918/file41f28 requests DSab66 click.voc. The sole control DSaae2 has words0,328,200,48,24,1,8,3,14,0,0: client Close at328,184/48×24, event1. Native title Close, client CLOSE and Escape request existing PCM click audio. Original callback scheduling/stacking/audio arbitration remain incomplete.

Paint41610 handles event17 (full report) and0dac (cash-only update). All numbers use scratch string2d9f:c4e4. DSaa55..aae0 stores28 five-byte printf strings, explicitly pinned in tests. Source formatting requests seven or eight characters, truncating wider results. Native keeps signed/unsigned semantics but displays the complete numeral right-aligned in the original56/64-pixel box, with reduced font size for extreme values. All labels, section headings and Close are actual text. Import masks original black/white glyph pixels only, retaining stripes, paper edge, holes, bevels and wood. The original Leased Machines and TOTAL EXPENSES lettering extends into the start of the numeric column; masking covers those final pixels too.

Client coordinates subtract16 from source y. Asset rows are144,24+8×row (five rows); annual revenue144,120+8×row (five); expenditures320,24+8×row (eleven). Total Assets is136,88; Total Revenue136,168; Total Expenses312,152; Profit/Loss312,168. Estimated Taxes is192,184 and Quarterly Loan Payment192,192. Total boxes are64 pixels wide; ordinary rows56; the native tax box uses the source eight-character drawing width64 despite its minimum-seven printf format. The title and frame remain1×, without mobile rearrangement.

## Values and source widths

| Source label | Source storage/helper | Native display |
|---|---|---|
|Cash|DS3e48|signed dword|
|Machinery|11a12 recomputation, then caller4170b CWD overwrites DX; DS3e50|signed low word of the accumulated owned-machine quotes|
|Land|manager10c8/ownedLandValue, DS3e4c|unsigned dword, same land value already calculated in the tax snapshot|
|Futures|4b23a, active fields with nonzero word+48; DS3e58|sum of signed low words returned by fieldHarvestValue/1c092|
|Livestock|1366a, active animals; DS3e5c|sum of full DX:AX values from12958|
|Total Assets|cash + machinery + land + futures + livestock, wrapped into DS3eb8|unsigned dword; buildings/loan principal are not additional terms in this report|
|Crop/Machinery/Land/Futures/Animal Sales|DS3e60/64/68/6c/74|unsigned dwords|
|Seed/Machinery/Land Purchases/Futures Losses|DS3e78/7c/80/84|signed dwords|
|Structures/Livestock/Chemicals/Loan Interest/Leased Machines|DS3e90/98/a0/a4/a8|signed dwords|
|Taxes|DS3e40, carried prior tax payments|unsigned dword, unlike the surrounding expenses|
|Miscellaneous|DS3eac|signed dword|
|Total Revenue/Total Expenses/Profit-Loss|1d460 recomputation into DS3ebc/3ec0 and2d9f:fa18|signed dwords, using existing canonical report projection|
|Estimated Taxes|1d520/assessAnnualTax|signed dword|
|Quarterly Loan Payment|DSb3b2|signed dword|

Machinery11a12 visits active records and excludes rentals40h. Each1192e depreciation quote is sign-extended into a wrapping dword sum; Balance Sheet then truncates/sign-extends the entire result again at4170b. Native bounds traversal to actual slots1..126. Fields4b23a similarly scan active records with a contract price at+48, call1c092 and sign-extend AX into the total; native uses bounded slots1..97 and all24 crop definitions. Current price fallback inside1c092 is not reached for the selected contract fields. Source maturity/loss/value arithmetic remains in the existing harvest-value module.

Livestock1366a sums active records using the **full** return from12958, unlike sale callers that keep only AX and sign-extend it. The existing quote calculation now exposes `animalFullQuote`; `animalSaleQuote` still masks to16 bits, preserving all previous sale behavior. Species160..164, word-truncated age multipliers3/5/3/2/0, unsigned dword price addition and condition shift are unchanged. Native bounds traversal to real slots1..255 rather than trusting the original declared count.

The tax row uses last year's carried payments, and Loan Interest names the full balance-payment ledger, including principal. The original total expense formula omits worker/chemical/payment ledgers while including other retained accounts and both tax ledgers (SF-041). Therefore adding the visible rows is not guaranteed to match Total Expenses. These source quirks are preserved and recorded in SF-168, not silently replaced with cleaner accounting.

## Native ownership and access

Original full paint writes DS3e4c/50/58/5c/3eb8 and report caches. Native display derives these values from canonical snapshots without overwriting saved financial caches/book values, consuming RNG or posting transactions. The existing annual/tax/loan/sale commands retain their state ownership and rules. The original dependence of later financial consumers on display-time cache refresh remains a documented fidelity gap; this UI increment does not claim that broader lifecycle solved.

The old FarmReport component is removed. Field-condition indicators are in Evaluation. The interim TaxPanel and its added transparent Estimated Taxes button have now been removed: the original Balance Sheet already displays the estimate and prior-year tax payments, and source financial Message dialogs supply failed-assessment, reminder, paid and forced-sale notices (financial-messages.md). TaxPanel contained no gameplay commands. Debt/countdown diagnostics are checked through real saved records rather than another native window. Both toolbar and Windows menu focus the report. Viewing, moving, closing and reopening leave checkpoint contents unchanged.

## Hashes and verification

|Resource/range (end exclusive)|Bytes|SHA-256|
|---|---:|---|
|cashflow.bmp|44808|ca4766300bd98d207038618656bbac75927f510ab4a000d8d936f83744251778|
|41610..41efe, paint||fad64499014f2d374781335b1aa349781e48e7a413e8a5353860b1d2ef304384|
|41efe..41fd0, callbacks||cfcf920431e3d743f76e76c29e408ba9f746d627d8a9bcc17e0a678c3568c2a5|
|11a12..11a76, machinery sum||61811a8829181b8dee4a437c29593a67a0565c22d5f38de768cf24f0d9859bc1|
|1366a..136c6, livestock sum||b9913a7d410a5adbab29a8aeb960ce890f55d348afd4c52d371c0c168ddd8ddf|
|4b23a..4b29e, futures sum||acaaa1a10cd96e953f770bcf2b265b7b40d244b53fba6dd080e963f22bb58117|

Confidence is high for these source branches/geometry/formats, without an original runtime capture. Unit tests pin source ranges/descriptor/format strings, compare all original/import pixels, reject every truncated bitmap prefix, verify all eight supplied farms, exercise signed/unsigned/word boundaries, full livestock versus sale values, every displayed ledger mapping and unchanged caches. Browser checks cover geometry, real text, full extreme numerals, title movement/Close, estimated/prior tax rows, annual collection/town choice, borrowing/repayment, exact saves, missing resources and existing report/annual flows. Final results are in progress.md. No dependency installation, supplied-distribution modification, pacing change, crop swapping or MIDI-policy change.

## Rebuilt as a ledger on shared chrome (2026-10-12)

User request (ui-components.md). Balance Sheet is a framed `GameWindow` around a 384×216 ledger. It no longer shows `cashflow.bmp` with text over it.
- **Rows:** 22 rows of 8px from source y8, striped grey (palette 12) and white across both halves. Each row has a left (176px) and right (168px) cell.
- **Bars:** section headers are green bars (palette 8) and totals dark bars (palette 13), both with white lettering. Values are right-aligned in their cell.
- **Footer:** Estimated Taxes and Quarterly Loan Payment sit beside the CLOSE `BevelButton`.
- **Margins:** the punch-hole margins are source sprites (pure decoration).

Every label starts at its source x/y. Lettering is 9px and clipped to its 8px row (not pixel-identical to the source font). Ids and values are unchanged.

Also fixed: the generic window-button exclusion now uses `:where(:not(.bevel-button))`, so it keeps its old specificity. The earlier form had broken Town Choice's pressed-image rule.
