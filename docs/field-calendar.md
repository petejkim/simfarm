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

At year rollover, calendar call `0xcdfe` routes through manager `24e6:1032` to `0x48d08`. That routine seeks past one year (`0x24c0` bytes at `0x48d9e`), reads the remaining 192 weeks (`0x4980` words at `0x48dc4`), then regenerates the final 48 weeks. It ultimately writes the full 23,520-word file and replaces the old history (`0x49158..0x491ac`). Its crop-based continuation generation still needs a complete port; do not implement a simple annual repeat in its place.

This increment decodes the table, validates native access, preserves it in detached simulation snapshots and version-2 native checkpoints, and identifies work codes. It does **not** yet dispatch saved orders or expose an editable planner. Next recover weekly forced completion, plowing and the alternate harvest path, then connect the dispatcher/year rollover and original plan-editing rules to React controls. The full preservation objective remains unchanged.

The forced-completion jump table at `0x2f640` maps Planting (3) to `0x2f19a`, Growing (4) to the no-op exit `0x2f64e`, Harvest (5) to `0x2e970`, and treatments 6–9 to `0x2f4d4`, `0x2f536`, `0x2f57c`, `0x2f5c0`. Retain that order when porting; do not treat the dispatch-table words as x86 instructions. Projection division hazards are tracked separately as SF-031 in `original-bugs.md`; supplied definitions avoid zero divisors, but custom-definition validation is still required when that subsystem is implemented.

## Weekly forced completion implementation

`src/simulation/field-weekly.ts` now ports `0x2e93a..0x2f668` independently of the clock. The complete disassembly corrects the initial history hypothesis: the function never reads its previous-week argument and never calls a schedule writer. It visits active fields in slot order and leaves states 0–2 and 4 alone.

Planting returns both referenced machines and attachments to their saved homes, clears flags with `0xe9fc`, parks owned machines, releases rentals, enters Growing, resets age/stress accumulators, refreshes status and fills the field with `688 + cropSlot*8`. It preserves the original badge exclusion 539–634 and clears overlay-enable bits throughout the field. Unlike normal planting completion, this path does not initialize field +33 or +36.

Treatments use the same immediate equipment return, apply the full effect, then restore the saved state/substep and clear backup bytes only when the saved state is nonzero. A saved Waiting state instead resets current state/substep to zero and retains its backup substep byte. No badge refresh, age reset or payment is added. SF-032 records completion even when no supplies or machinery were acquired.

Harvest completion preserves contract settlement, existing/new storage reservation, full original yield/loss calculation, inventory creation or sale fallback, annual/perennial reset and the fixed 8×8 overlay clear. That clear intentionally retains the original broad overlay destruction; SF-025 already records the analogous ordinary worker behavior. Failed storage releases its reservation under the existing SF-021/022 native guards. Already-paid machinery sale step 7 is finalized without paying again. SF-033 and SF-034 document native corrections for the omitted pending header and worker-sale step 16, respectively. The remaining equipment cleanup uses the existing SF-010 chain-detachment fix.

Tests sample every actual planting phase on all eight farms, every treatment phase, and both harvest methods' actual phases; they check machine release, payment/storage, no repeated completion, source/schedule preservation, badge/terrain handling and the differences between ordinary and forced completion. This routine is not yet called by GameSimulation: plowing, the alternate harvest order, schedule dispatch, year projection and editing remain required before enabling original automatic plans.
