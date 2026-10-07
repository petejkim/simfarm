# Original field calendar reconstruction

Evidence is from `SIMFARM.EXE` SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce` and the eight supplied SSMs. No original files were modified or executed.

## Verified storage and addressing

The scenario loader copies 23,520 words at `0x45734..0x4576a` to the runtime file named **schedual.his** (the executable's spelling). The input cursor starts at SSM `0x9b04`: inventory ends at `0x9a83`, followed by one byte and sixteen eight-byte records. The schedule ends at `0x152c4`, exactly where the decoded world begins. This is a 47,040-byte, week-major image with 240 weeks × 98 columns × two bytes. Every word, including unknown codes and the final column, is preserved.

Overlay 25 loads at segment `27ce`, file `0x486c0`. Manager thunks `24e6:11cc` and `24e6:11d6` route to get `27ce:044c` / `0x48b0c` and set `27ce:02a4` / `0x48964`. Their file position is `month*784 + week*196 + column*2`; the caller can pass absolute week with month zero. Field dispatcher `0x2f6c6..0x2f6d0` passes field **slot minus one**, not its display number. There are only 97 usable field slots; the 98th serialized column is retained rather than reinterpreted. Whole-column read/write routines `0x48a7a` / `0x489e8` use 196-byte steps across 240 weeks.

Examples from original files, zero-based week and column 0 (field slot 1): SCEN4 has corn planting 832 at week 14, graphic 688 at week 15, harvest 440 at week 27, and another planting at week 28. SCEN0 has grape planting 833 at week 28, harvest 440 at week 36, then graphic 696 at week 37. These are actual saved plans; no new crop schedule is inferred from real-world growing seasons.

## Verified codes

The dispatcher `0x2f66a..0x2fb12` distinguishes the following words. Crop-stage graphics are timeline markers, not repeated planting orders.

| Word | Recovered meaning |
| --- | --- |
| 832–847 | Plant crop slot 0–15 (`0x2f7de`). |
| 688–815 | Crop-stage tile: `688 + cropSlot*8 + stage`. Tile-base table `2be7:0882`, file `0x4f4e2`, confirms all 16 bases. |
| 198 | Lock a Growing field's contract to its current crop trade price if it has no contract (`0x2f72e`). |
| 209 | Fallow/abandon (`0x2f704` calls `0x1c2a8`). |
| 231 | Alternate harvest path: state 5, step 0, clear field +7 bit 1 (`0x2f7c0`). Its full output semantics remain to be traced; do not call it a crop-disposal rule yet. |
| 440 | Standard harvest, Growing guard, set +7 bit 1; worker selection uses crop +57 (`0x2f776`). |
| 852 | Plowing state 2, step 0 (`0x2f718`). |
| 912 / 913 / 914 / 915 | Fungicide / herbicide / pesticide / fertilizer, respectively; save current state/substep and enter treatment step 0 (`0x2fa58..0x2fb0c`). |

Zero, 1–3 and all other words remain explicit unknowns. Zero is not silently converted to 209: the dispatcher ignores zero, while 209 invokes a real crop/soil operation. Editing code treats some small words as occupied planning markers; their full meaning is not established here.

## Dispatcher dependencies and next work

Weekly entry `0x2f66a` computes `month*4 + week`. For week ≥1 it first calls `0x2e93a` with the previous week; this force-completes or cancels outstanding planting/harvest/treatment work before issuing the new week's order. The completed trace shows that this routine does not write schedule history and never reads the supplied previous-week argument. That path includes equipment returns, contract settlement, storage and partial treatment effects. Simply calling the existing immediate UI commands on a weekly timer would omit original behavior and strand jobs.

At year rollover, calendar call `0xcdfe` routes through manager `24e6:1032` to `0x48d08`. That routine seeks past one year (`0x24c0` bytes at `0x48d9e`), reads the remaining 192 weeks (`0x4980` words at `0x48dc4`), then regenerates the final 48 weeks. It ultimately writes the full 23,520-word file and replaces the old history (`0x49158..0x491ac`). Its crop-based continuation generation is now ported below; it is not a simple annual repeat.

The initial format increment decoded the table, validated native access, preserved it in detached simulation snapshots and version-2 native checkpoints, and identified work codes. Subsequent increments below recover forced completion, order dispatch, year projection and manual plan recording. The final clock-integration section records the current automatic behavior; an editable planner remains outstanding.

The forced-completion jump table at `0x2f640` maps Planting (3) to `0x2f19a`, Growing (4) to the no-op exit `0x2f64e`, Harvest (5) to `0x2e970`, and treatments 6–9 to `0x2f4d4`, `0x2f536`, `0x2f57c`, `0x2f5c0`. Retain that order when porting; do not treat the dispatch-table words as x86 instructions. Projection division hazards are tracked separately as SF-031 in `original-bugs.md`; supplied definitions avoid zero divisors; both implemented plan generators now validate those divisors.

## Weekly forced completion implementation

`src/simulation/field-weekly.ts` now ports `0x2e93a..0x2f668` independently of the clock. The complete disassembly corrects the initial history hypothesis: the function never reads its previous-week argument and never calls a schedule writer. It visits active fields in slot order and leaves states 0–2 and 4 alone.

Planting returns both referenced machines and attachments to their saved homes, clears flags with `0xe9fc`, parks owned machines, releases rentals, enters Growing, resets age/stress accumulators, refreshes status and fills the field with `688 + cropSlot*8`. It preserves the original badge exclusion 539–634 and clears overlay-enable bits throughout the field. Unlike normal planting completion, this path does not initialize field +33 or +36.

Treatments use the same immediate equipment return, apply the full effect, then restore the saved state/substep and clear backup bytes only when the saved state is nonzero. A saved Waiting state instead resets current state/substep to zero and retains its backup substep byte. No badge refresh, age reset or payment is added. SF-032 records completion even when no supplies or machinery were acquired.

Harvest completion preserves contract settlement, existing/new storage reservation, full original yield/loss calculation, inventory creation or sale fallback, annual/perennial reset and the fixed 8×8 overlay clear. That clear intentionally retains the original broad overlay destruction; SF-025 already records the analogous ordinary worker behavior. Failed storage releases its reservation under the existing SF-021/022 native guards. Already-paid machinery sale step 7 is finalized without paying again. SF-033 and SF-034 document native corrections for the omitted pending header and worker-sale step 16, respectively. The remaining equipment cleanup uses the existing SF-010 chain-detachment fix.

Tests sample every actual planting phase on all eight farms, every treatment phase, and both harvest methods' actual phases; they check machine release, payment/storage, no repeated completion, source/schedule preservation, badge/terrain handling and the differences between ordinary and forced completion. The order dispatcher below uses it, and the later clock-integration increment connects both to GameSimulation.


## Weekly order dispatcher implementation

`src/simulation/field-calendar.ts` implements `0x2f66a..0x2fb12`. It computes absolute week after the week counter increments but before month normalization, invokes forced completion only for week ≥1, then scans active fields in slot order and reads schedule column `slot−1`. Planting uses the recovered seed/rotation/price/RNG path; a failed seed order stops the whole scan. The native SF-018 correction preserves the failed field's existing crop/contract rather than clearing it, while subsequent fields still wait as in DOS.

Standard harvest accepts only Growing and selects workers from crop +57. Alternate code 231 unconditionally enters machinery harvest step zero with field +7 bit 1 cleared; no disposal semantics are invented. Contracts capture the live crop trade price only when Growing and not already contracted, then increment the contract count. Treatment orders save state/substep and enter their corresponding step zero without buying supplies yet. Unknown words and stage graphics do nothing; code 209 invokes actual fallow cleanup, including its repeated nutrient effect.

Plowing was found to be an inert original state: the main dispatcher at `0x18c98` sends states 0/1/2 directly to its exit. Code 852 retains that behavior, documented as SF-035. There is no justification to invent a native plowing work loop from its label alone.

Seven focused tests verify actual planting weeks on all eight supplied plans, ordering of completion and new work, January week-zero behavior, deferred supply consumption, contracts, both harvest variants, unknown graphics, fallow and seed-failure scan termination. The later clock-integration increment connects this dispatcher to the browser clock; it has no provisional annual-repeat fallback.

## Year projection implementation

`src/simulation/field-projection.ts` ports overlay 25:0648 / file `0x48d08..0x491ce` as an atomic schedule mutation. The existing executable SHA-256 remains `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Initialized DS pointers `6190:cf50/cf52/cf54/cf56` resolve to segments `6190/6190/2d9f/2be7`, confirming field, crop and tile references. The harvest word at `2be7:086a` is 440; planting table `2be7:090c` contains 832–847.

The original seeks 9,408 bytes into the old history and reads 18,816 words into `4d9f:0000`, moving weeks 48–239 into weeks 0–191. For each active field, it copies that column into a local array and initializes weeks 192–239 to 209. It searches backward for 440 if the **current field crop** is perennial, otherwise for the last planting word 832–847. The annual branch chooses the future crop from that word, even when it differs from the field's current crop or is itself perennial.

From that last marker onward, including the retained four-year section after it, the generator replaces every word with repeated crop cycles. Each pattern begins with harvest (perennial search) or the selected planting word (annual search), then has `crop[56]` graphic weeks, then harvest 440. Graphic week `i` is `u16(688 + cropSlot*8 + cropWord26 + floor(i / trunc((crop[56]+crop[66]-2)/crop[66])))`. Annual crops repeat from pattern index zero. Perennials repeat from `signedByte(crop[18])+1`, skipping the initial marker and already-grown stages. This is not a fixed 48-week repetition; for example SCEN4 corn has 14-word cycles, while SCEN0 grapes retain their last harvest at shifted week 180 and next harvest at week 228. Source confidence is high from the complete static trace and supplied definitions; no emulated execution comparison is claimed.

Unknown/inactive columns shift with the file read. The original does not initialize their final 48 weeks in the shared buffer; exact contents depend on prior buffer use, not solely the file. Native code explicitly retains their old trailing bytes, including column 97, instead of guessing those transient DOS bytes. Active markerless columns preserve the shifted portion and retain the new fallow tail, returning their slots as diagnostics. These bounded, deterministic choices are native policy, not claims about DOS behavior. SF-031 and SF-036–038 record divisor, search, pattern-stack and restart hazards; errors leave the entire original schedule intact.

Seven tests check exact executable constants, all eight original plans, annual/perennial sequences and cross-crop selection, repeated rollover, unknown/source preservation, missing markers, signed indices, divisor/duration rejection, zero duration and word wrapping. This completes the standalone year projection, not the original editor or automatic clock integration. Next trace editing at `0x2fb14` and its callers, then integrate weekly/year dispatch in calendar order while ensuring manual player orders update their plans correctly.

## Manual-order plan recording

Overlay 3:2bd4 / file `0x2fb14..0x2ffad`, manager thunk `24e6:114a`, records manual actions into the plan. It is not the full calendar editor. Static callers are `0x23f73`, `0x2401b`, `0x26ce2`, `0x26dbf`, `0x26e4e`, `0x26eea`, `0x26f7a`; all pass zero for the signed week-offset argument. The other arguments are field slot, order ID and selected crop slot. DS selector words `ca6c/ca76` both resolve to `6190`, confirming calendar month `1256` and week `1252`; `ca82/ca84` resolve to crop `2d9f` and tile `2be7` segments.

The jump table at `0x2ff96` maps order 1 to plowing (852), 2 to crop-plan construction, 5 to fertilizer (915), 6 to pesticide (914), 7 to fungicide (912), and 10 to herbicide (913). IDs 3/4/8/9 and out-of-range IDs return without a write. Treatment writes refuse to replace 1/2/3, 440, 832–847, 198 or 852. Graphics, fallow, alternate harvest 231, other treatment codes and unknown words are replaceable. Plowing unconditionally writes its word; the original Waiting-field toolbar invokes it, resolving SF-035's previously unknown UI reachability.

Planting constructs a new 240-word column. Weeks before `month*4+week+offset` become fallow 209, including history: the full-column writer `0x4882e` is called with starting row zero at `0x2ff7d`. Ordinary crops repeat `[plant, duration graphic weeks, harvest]`, with the same divisor and perennial restart rules as projection. Unlike projection, graphic offset +26 is a **signed byte**, not a word (`0x2fdb2`, `0x2fe09..0x2fe0d`). The native helper keeps these distinct source semantics.

Nonzero crop byte +76 adds a fixed annual harvest rule (`0x2fe99..0x2ff5d`). It preserves a single planting word at the requested starting week, then sets harvest 440 wherever `week % 48 === crop[76]`. Other weeks use graphic `688 + slot*8 + trunc(elapsedWeeksSinceHarvest/6)`, wrapping the difference through 48. This seasonal graphic overrides the generated pattern and its offset. All supplied perennials use this mode: almonds 31, apples 44, grapes 36 and oranges 34. Year projection does **not** consult +76; that original difference is retained rather than unifying the generators into a guessed rule.

`src/simulation/field-plan-order.ts` implements the recorder with bounded native arguments and pre-write pattern validation. GameSimulation calls it only after successful manual planting/new-field/treatment commands. The native SF-018 correction leaves both field and plan unchanged if seed acquisition fails, whereas the original new-field caller first writes a plan before checking seed success. Treatment work can succeed while its plan word remains protected, as in the original. Scheduled planting does not rebuild its own plan. Harvest's immediate handler has no call to this recorder, so no speculative harvest-plan write is added.

Tests cover source table/caller bytes, complete history reset and neighboring-column preservation, all four supplied fixed-harvest perennials, occupied-word boundaries, original signed-byte arithmetic, malformed definitions, all-eight-farm manual commands and checkpoint preservation, and plan initialization for a genuinely purchased/created new field. The browser checkpoint cycle additionally checks new-field planting, fertilizer and future harvest words and compares the reloaded plan. Calendar execution and the full editable planner remain the next integration work.

## Automatic clock integration and corrected rollover order

GameSimulation now executes these recovered plans on every weekly boundary. Completing the calendar caller trace corrected an earlier assumption: `0xc920` increments the week, `0xcbbd` calls manager `24e6:0fec` → overlay 3:272a / `0x2f66a`, and only afterward does `0xcc10` reset week 4 to zero. At year-end the dispatcher therefore processes **row 48 of the old plan**, not row zero of an already-shifted plan. It force-completes the final week's work, issues that row's orders, then `0xcdfe` projects the next five-year image. Projection sees any crop change made by the row-48 planting order. The standalone dispatcher's January-week-zero exception exists in its code, but the normal calendar year-end path never uses it.

Native integration runs old-week wind/water updates, publishes no intermediate state, temporarily sets day zero and incremented week (allowing week 4), dispatches work, then performs temperature/month/year updates and year projection before the existing forecast/daily-growth path. Checkpoints and public snapshots retain normalized calendars only. Scheduled supply purchases remain deferred to the next machinery tick; failed seeds stop the week's remaining field scan without retries on intervening days. The last dispatch result is transient UI feedback and does not affect continuation.

Automatic plans now run for every field, including fields the player has not selected. This changes the old manual-only regression economics: SCEN4's original corn fields harvest at week 27 and replant at week 28, lowering the live price of all stored corn. In the fertilized new-field cycle, the day-84 estimate remains $1,451, but the day-85 stored lot sells for $395 after the other four fields replant. Selling that identified new lot then leaves $21,800; other fields' harvests remain available. Tests track the newly delivered lot instead of assuming the first corn item belongs to the selected field. No source rules or farms were altered to preserve the former manual-only price.

Six integration tests verify executable call order, temporary week-4 month transitions, exact treatment payment timing, year-end completion/one-time dispatch, row-48 perennial-to-annual rotation before projection, checkpoint continuation, failed seed scan behavior, and untouched original automatic harvest/replant/sale. Existing all-eight-farm year tests and five-year climate tests now run with automatic work enabled. Browser checks exercise untouched automatic plans and visible failure feedback, plus the existing manual/new-field and checkpoint cycles. Phase-sampling unit fixtures start on day zero so all ordinary machinery phases can be observed before the weekly forced-completion deadline; the production clock has no scheduling bypass.

Next trace the full editor around its column-writer call `0x2e56a` in overlay 3, then expose original planning operations in React. The raw accessors and manual recorder do not establish those editor rules, and no unrestricted write-any-word UI is claimed as a completed planner.

## Calendar editor rules

Editor `0x2e11a..0x2e80c` receives a zero-based field column, an offset within the displayed twelve-week window, and an action ID. The mouse caller `0x2d0a0..0x2d0aa` passes selected field slot minus one. DS `5df7` is the displayed starting month (0–57); absolute week is `displayMonth*4+offset`. Initialized selectors `ca74/ca7c/ca8c` resolve to `6190/2c8b/6190`, confirming live field references and the separate display buffer.

The action table at `0x2e798` sends 0–15 to future crop planting, 17/18 to clear, 20 to harvest, 22 to fertilizer. Comparisons after it handle 23 pesticide, 24 herbicide, 25 fungicide and 26 plow. Action 21 locks a contract **only in the current week**, for a Growing field with no contract: it captures the live crop-definition price, increments its contract count, writes 198 and pays nothing yet (`0x2e191..0x2e211`). Ordinary edits require a strictly future week (`0x2e214..0x2e22e`), including clear via UI actions 17/18. Raw action 209 enters the erase helper before this guard, but the traced UI palette uses 17/18; no native past-edit bypass is exposed.

Future planting has the manual recorder's signed byte +26, duration/divisor, perennial restart and fixed-harvest-week rules. Its writer starts at the selected week (`0x2e779`), preserving all earlier words rather than resetting history. The two native paths share bounded pattern output, while year projection remains separate because it uses different offset/harvest rules. Divisor, duration and restart validation covers this third generator as well (`0x2e612/0x2e61b`, `0x2e631/0x2e65f`, `0x2e6d3..0x2e6ec`); source hazards remain recorded as SF-031/037/038.

Editor treatments protect planting words 832–847, contract 198 and harvest 440. Unlike the immediate recorder, they may replace 1/2/3, plow, graphic stages, unknown words and other treatments. Harvest editing uses the **currently planted crop** for its restrictions: any nonzero crop +76 rejects movement with original message `This crop has a fixed harvest week.` at DS `6142`. Otherwise it writes 440 and, for annual crops, clears later words to fallow until the next planting. SF-039 corrects the original exclusion of slot 15 from that stop condition. Clear helper `0x2df9c..0x2e118` sets the entire remaining column to 209; its multiple code branches ultimately have the same persisted suffix result.

`src/simulation/field-plan-edit.ts` implements these operations independently of UI. It validates field/week/action/crop inputs and preserves unknown earlier and neighboring words. Tests verify source tables/call arguments, all eight farms, all sixteen harvest-stop markers, four treatment guards, fixed harvest dates, contract accounting and atomic rejection. The manual generator extraction retains its existing tests.

Unexplained editor action 16 writes 239 (SF-040); 19/27 do nothing, and raw 856/868 are copied without a known dispatch operation. Those words remain preserved, and no invented gameplay effect or native UI action is added for them. The separate `0x2e80e` helper has not yet been established as a reachable editor operation. Core planning controls can use the verified rules; these unresolved original paths remain preservation gaps.
