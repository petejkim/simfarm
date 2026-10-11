# Original Edit status line and history

The native Edit view now displays the original quick-message line and expandable ten-entry history. Plant crop selection posts17, failed new-field placement posts51, and all twelve palette tools/four Spray choices post their verified source wording. Remaining operation-result message producers are not yet connected; this is an incremental reconstruction, not completion of every original notification.

## Source records and producers

SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. DS6190 file base846f0. FilenameDSba4c is `qmessage.dat`, archive offset931591, length4866, SHA256 `f49a867d63b52d4157977f6e06dfc231af3689042af3da8ae032cbfcff5594b1`. It contains76 complete64-byte records plus a final CR/LF. Reader24e6:1118→overlay25:19fe/file4a0be uses unsigned code×64, reads62 bytes toDS149e and writes two zero bytes at14dc/14dd. Native bounds checks reject invalid indices or incomplete records; raw imported bytes remain unchanged. Display strips @ padding and uses HTML text.

Plant selection3838d..38394 posts17, `Choose a location for your field.` Map placement/seed failure24164..2416b posts51, `Cannot place field there.` Both call1d75:2bb4/file22504. That routine suppresses equality with the current slot, increments cursorDS017a, wraps at10, writes DS0170[cursor] and setsDS5694. Initialized slots are ten ff bytes and cursor0. The simulation owns this transient history, not React. Native create-field failure retains detailed supplemental feedback and atomic failed purchases; no SF-018 regression is introduced.

## Display and source defect

Palette nodeDS54ca has x48,y16,widthffff,height16,ID32. The latest line is painted by204f2..205a6; text coordinates are Edit x+72,y+18. Source historyID32 jumps through table22352 to22032, saves/draws a96-pixel-high region at Edit x+48,y+16 using the client width, gray palette12 and black border. Text rows start x+72,y+18 with8-pixel pitch. Current native Edit origin0,48 therefore places the strip at48,64 and text at72,66. Browser font metrics differ from bitmap glyphs; no glyph pixels are displayed.

Source22160..22176 computes `(cursor-row+10)%10` in a stack local, but2217d loads row directly and22180/22188 read the physical slot. SF-172 records this display-order bug. Native recentEditStatuses uses the computed circular index and omits unused entries, showing newest first. Storage, wrap and adjacent-duplicate suppression retain the source rules.

The original history is held until primary-button release221cb..221d5. Native activation toggles it; Escape, outside click or a click within the history dismisses it. Internal history clicks never reach the map. It remains attached to Edit rather than acquiring a movable window title. All pixels/text stay at1× and no mobile layout is introduced.

## Lifetime, checks and remaining work

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
