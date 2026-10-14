# Original Edit status line and history

The native Edit view now displays the original quick-message line and expandable ten-entry history. Plant crop selection posts17, failed new-field placement posts51, and all twelve palette tools/four Spray choices post their verified source wording. Remaining operation-result message producers are not yet connected; this is an incremental reconstruction, not completion of every original notification.

## Source records and producers

SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. DS6190 file base846f0. FilenameDSba4c is `qmessage.dat`, archive offset931591, length4866, SHA256 `f49a867d63b52d4157977f6e06dfc231af3689042af3da8ae032cbfcff5594b1`. It contains76 complete64-byte records plus a final CR/LF. Reader24e6:1118→overlay25:19fe/file4a0be uses unsigned code×64, reads62 bytes toDS149e and writes two zero bytes at14dc/14dd. Native bounds checks reject invalid indices or incomplete records; raw imported bytes remain unchanged. Display strips @ padding and uses HTML text.

Plant selection3838d..38394 posts17, `Choose a location for your field.` Map placement/seed failure24164..2416b posts51, `Cannot place field there.` Both call1d75:2bb4/file22504. That routine suppresses equality with the current slot, increments cursorDS017a, wraps at10, writes DS0170[cursor] and setsDS5694. Initialized slots are ten ff bytes and cursor0. The simulation owns this transient history, not React. Native create-field failure retains detailed supplemental feedback and atomic failed purchases; no SF-018 regression is introduced.

## Display and source defect

Palette nodeDS54ca has x48,y16,widthffff,height16,ID32. The latest line is painted by204f2..205a6; text coordinates are Edit x+72,y+18. Source historyID32 jumps through table22352 to22032, saves/draws a96-pixel-high region at Edit x+48,y+16 using the client width, gray palette12 and black border. Text rows start x+72,y+18 with8-pixel pitch. With the Edit titlebar removed, the native strip sits at48,48 and text at72,50. A dedicated16-pixel layout row places the terrain viewport at50,64; the palette spans both rows. The strip remains visible and blank when history is empty, including after load. The expanded history temporarily overlays the map until dismissed. Browser font metrics differ from bitmap glyphs; no glyph pixels are displayed.

Source22160..22176 computes `(cursor-row+10)%10` in a stack local, but2217d loads row directly and22180/22188 read the physical slot. SF-172 records this display-order bug. Native recentEditStatuses uses the computed circular index and omits unused entries, showing newest first. Storage, wrap and adjacent-duplicate suppression retain the source rules.

The original history is held until primary-button release221cb..221d5. Native activation toggles it; Escape, outside click or a click within the history dismisses it. Internal history clicks never reach the map. It remains attached to Edit rather than acquiring a movable window title. All pixels/text stay at1× and no mobile layout is introduced.

## Lifetime, checks and remaining work

Requested2026-10-13: import now predecodes all76 records into [ui-content.json](ui-content.md), alongside Expert cards and event messages. Browser display selects the original code's string without decoding binary bytes on each render. Empty records retain their slots, and the raw source/imported files and original boundary tests remain intact.

History is transient and resets on native load/new simulation; it is excluded from v25 saves. Raw original scenario bytes remain preserved. Exact original startup/warm-restart/load history lifetime has not been fully audited; this reset policy is explicit, not claimed source-equivalent. Only verified Plant, palette and Spray selection codes are exposed as tool-selection commands; failed create-field posts51 internally. Existing modal guards precede either path. Other quick-message producers must be traced before being connected; no translated native failure is arbitrarily mapped to another original code.

Tests pin producer/reader/renderer evidence, record hashes, all record truncation boundaries, input immutability, ring wrap across all76 codes, duplicate suppression, detached snapshots, unchanged rejected-placement saves, modal rejection and load reset. Six existing placement cases remain passing. Browser checks cover original position/height, exact text and recent order, repeat rejection, Escape/internal-click dismissal, canonical nonmutation, load reset, truncated-asset failure and existing all24-crop Plant/Spray/help flows. See progress.md for results. Whole-game preservation remains incomplete.

## Palette and Spray selection producers

High-confidence static evidence: palette callback214f0 dispatches through table22352 (index is ID minus one; code segment file base1f950). Each branch below pushes the indicated quick-message code. Move/View call22504 directly at2174d/2170d; Bulldoze calls it at2167e. Other palette branches jump to the shared2167d call sequence. Source-byte tests verify table destinations, immediate codes and call destinations.

| Tool | ID | Branch | Code push | Code |
|---|---:|---|---|---:|
| Move object | 26 | 21726 | 2174a | 6 |
| View object | 2 | 21688 | 2170a | 64 |
| Paved road | 15 | 21a9a | 21b51 | 35 |
| Dirt road | 16 | 21b56 | 21c10 | 36 |
| Fence | 11 | 217a8 | 2185f | 32 |
| Gate | 12 | 21864 | 2191b | 33 |
| Ditch | 20 | 21e30 | 21ee7 | 40 |
| Valve | 19 | 21d74 | 21e2b | 25 |
| Hay | 13 | 21920 | 219d7 | 41 |
| Trough | 14 | 219dc | 21a94 | 34 |
| Trees | 17 | 21c16 | 21ccd | 37 |
| Bulldoze | 1 | 215ea | 2167b | 63 |

Spray pushes at383e8/38436/3847c/384c4 select fertilizer14, pesticide15, herbicide31 and fungicide16, each followed by far call1d75:2bb4 (`9ab42b751d`). Valve selection uses25, “Irrigation Ditch Valve,” rather than the separate39 “Ditch Valve On/Off.” View uses64, not the identical wording at19. These distinctions retain source codes even where visible labels overlap.

Selection changes only transient history and existing UI tool state; canonical farm saves are unchanged. Modal guards still apply. Tests reject unverified externally requested codes, verify all sixteen producers and adjacent deduplication across ring wrap, and exercise every choice through actual browser controls. Source click-sound requests and subsequent operation-result producers remain separate work; no new original defect was established here.

## Move pickup and busy feedback

Successful machinery/chemical pickup converges on13bce (via13802/13821); feed also falls through to13bce. Seed, harvest and trough branches independently push7 at138f6,139ea and13ae8. Each calls22504, yielding “Choose a destination.” Native emits7 after the existing canonical pickup preflight succeeds, with no storage withdrawal or saved mutation. Preview/hover does not post messages. Failed empty/closed/invalid selection does not invent a source status.

Busy equipment pickup1371a and drop13c86 actually push62, not61. SF-173 records that original text-index defect; native deliberately uses61, “Cannot move item in use.” The canonical move-equipment command publishes it after the rejected order, so secondary controls receive the same feedback. A busy drop returns the direct Move draft to pickup, matching13c90. Successful drops reset the pickup cursor at14510 without a new status call; native retains the destination line until another verified producer runs. Cancellation similarly clears the draft without adding an unverified message. Existing native safety checks and modal gates remain unchanged.

Handler136c6..1454c SHA256 `7560e5339b2d2e0575722b5aeb8acbebaae79e45c9a0c1573de34be45db20e8b`. Source call sites and direct record contents are pinned in move-status.test.ts. This is high-confidence static reconstruction, not a claim of DOS execution. Gesture/error sounds and original cursor art remain deferred.

## Immediate Spray result messages

The four original immediate-treatment branches26d3c..26fa9 now drive status results through the canonical treat-field command. High-confidence source evidence: calls26d7e/26e10/26eac/26f39 invoke chemical consumption1234:01a0/file146e0. A zero result routes to26e5e, which pushes75 and calls22504 at26e60. The code means “Not enough sprays to spray field.” It covers both disabled AutoBuy with no stock and insufficient cash for the fixed275 purchase; it does not introduce another purchase or debit.

Before consumption, the handlers check equipment/pending-equipment words and field state0/4. Rejection converges on26f2e, pushing21 (“Field is busy.”) and jumping to26e60. Success stores previous state/step, starts the treatment, updates the schedule, requests the original sound, then pushes68 at26f8e and jumps to26e60. Record68 consists of62 spaces: it deliberately clears the visible prompt and occupies a history slot. Native preserves that empty row; filtering empty messages would change the source ring semantics.

The full branch range26d3c..26fa9 SHA256 is `4ed0328215db8173beeb07bc25ee47e5610910da41cc39e6d03f710973e1d6c8`. Tests pin the range, three producers, four consumption calls and text records. Failed native invalid-field/invalid-treatment and inconsistent-stock safety guards receive no invented original status. The latter retains SF-030 rather than claiming the original unsafe removal would have failed identically. Existing daily/scheduled treatment state machines are unchanged; this result feedback belongs to explicit immediate orders. Original treatment sound timing remains separate work. No new original defect was established.

Focused tests cover every treatment with busy, missing stock, insufficient cash, successful purchase, invalid field and inconsistent stock, plus canonical rejection atomicity and modal blocking. Browser coverage checks the blank success line, busy feedback, shortages with AutoBuy both off/on, adjacent deduplication, exact saved state and continued actual field work.

## Bulldoze minimum-cash warning

Original held-button handler2591c tests town ownership first at259c0 (`test ...40`). For eligible cells,259cf tests cash's high word against zero and259d7 tests its low word against25 using unsigned carry. A nonzero high word or cash>=25 proceeds. Otherwise259eb pushes42 and259ed calls22504, displaying “Not enough money.” This gate precedes removable-object lookup: even an empty eligible tile requests the warning below25, while town cells do not. Range259b5..259fb SHA256 `dfcd4b2194777e6669c583b1287ddfaefe393af297c52818b635d86266742675`. Evidence is high-confidence static source, not a DOS runtime capture.

The direct Bulldoze gesture now posts42 only when its existing canonical preflight returns insufficient-cash. Confirmed/secondary remove-object commands post the same code on that result, covering a rejected command without relying on React to interpret it. Preview/hover never posts a warning; adjacent repeats deduplicate through the existing ring. Native failure atomicity, town priority, the25 threshold, confirmation dialogs and removal rules are unchanged. Other result reasons receive no invented status mapping. Original pre-action/error audio timing remains deferred as documented in manual-removal.md; this increment only restores the quick-message producer. No new original defect was established.

## Selected tool cost (2026-10-13)

The original Edit window paint at 0x20352..0x203f1 draws a cost in its titlebar:
- It skips the cost when there is no current mode record (es:[13ae]) or the mode is 2 (View) or 11 (Move).
- Mode 15 (Bulldoze) pushes a fixed 25 (`6a19` at 0x20388).
- Every other mode prices the type at `[fa3a]+2` through lookup 1a66:0a20 (file 0x1d280).
- The price is formatted with itoa radix 10 (`84:266e`, so signed). The routine draws DS570d `Cost:` at title x+0x20 and the number at x+0x50.

The lookup reads the price word (+6) of an 18-byte goods definition by type range:

| Types | Definitions |
| --- | --- |
| 0–63 | equipment |
| 64–127 | buildings |
| 128–159 | crops |
| 160–167 | animals |
| 168–191 | other table |
| 192–215 | seeds |
| 220–223 | chemicals |
| 288–351 | other goods |
| anything else | 0 |

Palette handlers 0x2183a..0x21ec2 point `[fa3a]` at DS goods records:

| Tool | Type | Template price |
| --- | --- | --- |
| Dirt road | 288 | $20 |
| Ditch | 289 | $80 |
| Trees | 291 | $10 |
| Paved road | 293 | $30 |
| Fence | 297 | $50 |
| Trough | 299 | $15 |
| Feed | 300 | $100 |
| Bridge | 301 | $40 (no native palette tool) |
| Gate | 303 | $75 |
| Valve | 304 | $35 |

Plant selection writes DS74c0 (type 302, new field, $120) at 0x38374. The Spray items write the chemical records 220–223 ($200 each) at 0x3840b/0x38459/0x3849f/0x384e7.

Native behaviour: the Edit titlebar no longer exists, so `EditStatus` appends the cost to the current message, e.g. "Paved Road ($30)" or "Choose a location for your field. ($120)". Prices come from the live definitions (`goodsPrice`, covering the 220–223 and 288–351 ranges) and are signed like itoa. Unlike the persistent original title, the cost appears only while the current message is the selected tool's own selection message, so later results such as "Field is busy." or "Not enough money." are not mistaken for priced items. View/Move and Buy-window placement show no cost.

Tests:
- `tests/tool-cost.test.ts` pins the handler records, the Plant record and the Bulldoze immediate against the executable, and checks live prices, the message condition and signed formatting.
- `tool-status.spec.ts` checks every palette and Spray tool plus Plant in the browser.
