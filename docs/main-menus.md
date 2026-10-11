# Original main menus and the native File menu

Source: unmodified `../simfarm-dos/SIMFARM.EXE`, size `0x917b9`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Initialized segment `6190` starts at file `0x846f0`. All addresses below are hexadecimal file offsets unless explicitly written as segment:offset. Confidence is high for the initialized tables, pointer order and dispatch targets; this does not establish complete window/input/timing fidelity.

## Header and linked descriptors

Main startup installs root `6190:a874` at `3f8da..3f8e7` into the far pointer at `2d9f:0000`. It is a runtime assignment, not an initialized nonzero root. Header renderer `2a3e4..2a46a` fills with DS `5b01=8`, then draws text with `5b02=15`. The gameplay palette maps these to RGB `(0,170,4)` and white. Labels are actual executable strings: File `8a1bb`, Options `8a1c0`, Speed `8a1c8`, Windows `8a1ce`, Disasters `8a1d6`. Text starts at source x `8/64/144/208/288`, y4; header hit rectangles are separate from those text origins.

A descriptor is30 bytes: popup x/y/width/height at+0/+2/+4/+6; header hit rectangle at+8/+10/+12/+14; item count at+16; first-item far pointer at+18; next-menu far pointer at+22; callback far pointer at+26. Each item is14 bytes: label far pointer+0; next-item pointer+4; previous-item pointer+8; flag word+12. Data pointers use6190; null pointers are two zero words. Item renderer `3f35b..3f416` follows the next pointer, tests flag bit0 at `3f3a2` for a check glyph, and draws labels at popup x+8, y20+12*index. Other flag bits remain uninterpreted. These are check flags, not evidence of disabled items.

| Menu | Descriptor DS offset | Popup x,y,w,h | Header x,y,w,h | Items | First item | Callback stub |
| --- | --- | --- | --- | --- | --- | --- |
| File | a874 | 0,16,128,87 | 0,0,40,16 | 7 | a866 | 24e6:1316 |
| Options | a7f2 | 64,16,120,100 | 64,0,56,16 | 8 | a7e4 | 24e6:130c |
| Speed | a762 | 144,16,64,64 | 144,0,40,16 | 5 | a754 | 24e6:1320 |
| Windows | a6fc | 208,16,120,128 | 208,0,56,16 | 10 | a6ee | 24e6:133e |
| Disasters | a650 | 288,16,104,88 | 288,0,72,16 | 7 | a642 | 24e6:1348 |

The descriptor chain follows table order, ending at null. The actual item chains give:

- File: About SimFarm, New Game, Save, Save As, Load Game, Load Crop, Quit.
- Options: Music, Sound Effects, AutoBuy, AutoScroll, AutoDoze, AutoGoto, Messages, AutoLease. Initially checked: Music, Sound Effects, AutoBuy, AutoScroll, Messages, AutoLease.
- Speed: Ultra, Fast, Normal, Slow, Pause. Initially checked: Normal.
- Windows: Buy, Sell, Evaluation, Map, Weather, Balance Sheet, Bank, Edit, Market Value, Farm Expert.
- Disasters: Tornado, Locusts, Drought, Flood, Frost, Windstorm, Disable.

Binary order differs from display order near the tail of every chain. For example File goes a82e→a812→a820, and Speed goes a738→a71c→a72a. Sorting offsets would be wrong. `src/formats/main-menus.ts` follows and validates the links/counts/backlinks and preserves all flag bits. Bounded ASCII strings, data segments, record lengths, cycles, palette indices and geometry are checked. Import writes ignored `public/assets/main-menus.json`; the browser validates the serialized metadata. No executable bytes are executed or emulated.

## File callback

Resident stub1316 at file28376 resolves through overlay18 to `27ce:07d8`, file `3eb88` (overlay base3e3b0). Dispatch at `3ee6e` bounds the index0..6; the seven words at `3ee7c` are `07ec,084c,08b4,08c0,0976,09ba,0a14` relative to that overlay base.

| Index | Command | Target | Verified behavior |
| --- | --- | --- | --- |
| 0 | About SimFarm | 3eb9c | Creates6190:a452, stores the window pointer and sets019e. |
| 1 | New Game | 3ebfc | Confirmation path sets0194=2 at3ec48; original startup later handles restart. |
| 2 | Save | 3ec64 | Tests filename byte6190:ae80; empty falls through to Save As; nonempty3ecd8 invokes original writer stub1352 with that filename. |
| 3 | Save As | 3ec70 | Creates2d98:0000 save dialog, inserts/refreshes it and calls pause3f492. |
| 4 | Load Game | 3ed26 | After preliminary file check,3ed4c creates6190:acc6, the ordinary in-game load dialog; insertion/pause joins Save As. |
| 5 | Load Crop | 3ed6a | Creates distinct descriptor6190:adb4. Crop-file callback/rules remain unverified; intentionally omitted from the live game by user request. |
| 6 | Quit | 3edc4 | Confirmation1 cancels;0 opens the save dialog and setsae1e=1; the remaining branch sets0194=1 at3ee64. |

The live React File menu retains these exact labels/order and calls existing native save/import/new-farm integration. File Load Game is ordinary `importOriginal`, with no temporary chooser generation; geographic chooser Load remains the separate result1 startup composition. Browser checkpoints load exactly without either original startup replay. File New Game opens the existing chooser; its cancellation preserves the current farm.

Save downloads a native JSON checkpoint. Save As allows a filename, normalizes the native extension and remembers the name within the current farm mount; subsequent Save downloads under that name. Neither overwrites a DOS source file. The browser decides final download placement/duplicate naming. About currently shows native preservation information and original attribution, not the recovered original About window. Quit offers Save and pause, Pause game or Cancel; it retains the tab/farm instead of attempting process exit. Its saved checkpoint precedes pausing. Cancellation leaves running state intact. Source nested-window pause ownership and elapsed menu/dialog timing remain deferred; the browser clock continues while menus/dialogs are open until the user explicitly pauses/quits. These are explicit adaptations, not claims of DOS callback equivalence.

Menu text uses React buttons; no bitmap glyphs are displayed. The original640-pixel strip now uses fixed1× desktop coordinates, retaining the original header positions and unused space. Popup widths and12-pixel item pitch use source dimensions; replacement font metrics and borders are not claimed pixel-identical. Keyboard arrows/Home/End, Escape and outside click are browser affordances. Mobile rearrangement is explicitly deferred. Load Crop is omitted because all24 supplied crops are available simultaneously. Windows now launches the available native controls alongside the restored toolbar; Options now restores its original eight-entry dropdown and live preferences; see [options-menu.md](options-menu.md). Disasters now restores its original seven-row popup and canonical active checks, with the SF-171 correction documented in [disasters-menu.md](disasters-menu.md). Speed still opens its native slider window. Speed deliberately retains the requested native slider instead of the DOS presets. See [control-bar.md](control-bar.md) for source evidence, transitional destinations and the remaining original-window work.

## Speed audit prerequisite

Stub1320 resolves to file3e482. The original choices change multiple independent pacing owners, not merely the enhancement slider's wall-clock multiplier:

| Choice | Day delay1f8c | Source speed1f90 | Traffic delay2286 | Disaster delay69b2 | Irrigation2402 | Equipment bytea8a0 |
| --- | --- | --- | --- | --- | --- | --- |
| Ultra /3e494 | 64 | 1 | 1 | 1 | 2 | 0 |
| Fast /3e53e | 128 | 1 | 8 | 2 | 2 | 1 |
| Normal /3e5ce | 256 | 1 | 16 | 4 | 2 | 2 |
| Slow /3e662 | 640 | 1 | 32 | unchanged | 2 | 3 |
| Pause /3e6f2 | unchanged | unchanged | unchanged | unchanged | unchanged | 4 |

Pause also depends on151e and writes0187; the other choices clear a nonzero pause depth and update checks/audio/menu state. Full pause nesting, the equipment byte's separate UI identity versus its nonzero simulation gate, and native wall-clock conversion need auditing before wiring this menu. SF-153 records Slow's omitted disaster-delay assignment. Preserve the existing user-requested speed slider while reconstructing these distinct original semantics.

## Pacing ownership and timer follow-up (v22)

The former boolean-only DSa8a0 reconstruction lost the distinction between every nonzero menu store. `equipmentPacingByte` now retains all256 unsigned values, with `paceEquipment` kept as its derived nonzero gate (or the only known gate for pre-v22 checkpoints). This is not the saved pause byte21719/DS0187. Original writer4516c..45178 and reader4618e..4619a transfer one byte to/froma8a0; machinery14a61..14a73 first compares the independent source speed word1f90 and then testsa8a0 for zero. Reset4072b and load-resume3f505 explicitly write2. New tests cover every raw value on all eight source farms and source import/resume/checkpoint boundaries; unknown enum values are not clamped to known menu choices.

Source menu checks also have separate owners: pause helper3f49d increments0187, clears Ultra/Fast/Normal/Slow low flag bytes atDSa760/a752/a744/a728 and sets Pause atDSa736. It does **not** writea8a0. Resume3f4fe decrements a nonzero counter, and only1→0 writes normal pacing and changes checks at3f541..3f551. Therefore deriving all menu state from the speed byte or browser paused boolean would lose behavior. Full nested-window ownership remains to be reconstructed; SF-152 retains its loaded-counter/overflow evidence.

Timer inspection found the actual interrupt increment at625d/6261: words139e and13a0 each increment once, independently of menu presets. Hook installation62d2/62d8 writes interrupt-vector offsets20/22, and62de..62e8 programs port40 with word3fff. The handler chains the prior interrupt every fourth invocation via172a at6265..6272. Restore6310..631a writesffff. These are verified source instructions; no host timing frequency or DOS environment is implemented by this byte-preservation increment.

Calendarc8a9..c8b7 subtracts last-day timestamp1f8e from13a0 as an unsigned16-bit value and uses strict `>` against1f8c (`77 03` atc8b5). Successful update d175..d17b saves13a0 back to1f8e. The initial native scheduler advanced at `>= max(1, dayDelayTicks)` and scaled interrupt work by the current day delay to keep the enhancement slider's1×=one day/second policy. The threshold correction below addresses that mismatch; browser cadence remains an adaptation. Wiring the original delay presets without changing that normalization would cancel their intended calendar-rate effect. Next choose and persist the explicit browser clock policy, pause owner and independent preset/check writes. Preserve the enhancement multiplier as a separate user control. No Speed header is enabled prematurely and no additional original-menu fidelity is claimed.

Calendar gate follow-up: the strict unsigned comparison and bounded Next day handling are now implemented, including65535's nonadvancing calendar. Browser normalization usesdelay+1 so the existing enhancement slider retains its cadence. This does not resolve the separate fixed-timer/clock-policy and original pause/check owners required by Speed callbacks. Native v22 phase/elapsed meanings remain unchanged; see calendar-clock.md for source evidence, arithmetic, checkpoint behavior and changed farming regression outcomes. The Speed header remains unavailable pending that integration.

Pause-owner follow-up (v23): the canonical depth and five raw check bytes now survive loading, restart and native checkpoints independently of browser pause/equipment identity. Ordinary import represents opening, saved-depth replacement and resume; unknown historical owners stay unknown until verified stores establish them. Source wrap and loaded0/check-Pause divergence remain preserved. See [original-pause.md](original-pause.md). This resolves state loss, while fixed clock policy, DS151e's separate Pause guard, live callbacks and full source interrupt/window scheduling remain before Speed integration.

User direction supersedes the proposed timing prerequisites: skip original timing rules and make the previous0.25× the new native1×. Keep the recovered rates/guard behavior documented as source evidence, but do not pursue DOS wall-clock fidelity or block useful menu reconstruction on it. The existing slider remains the native speed control; its baseline changes in the next separate increment.

## User-directed crop/UI policy, 2026-10-09/10

Load Crop is intentionally omitted from the live File menu: all24 supplied crops are available simultaneously. Its decoded source descriptor remains in preservation metadata. Do not reconstruct its file-loading/swap interaction. After this increment, prioritize original UI/dialogs/gameplay interactions. Keep the edit window visible, maximized and not resizable/toggleable. Closely preserve the original layout with actual React text; mobile layout adaptations are explicitly deferred.

## Native file feedback after utility-window retirement

The duplicated Game files window and Save farm/Load farm buttons are removed. File→Save, Save As and Load Game are the sole ordinary entry points; the hidden file input remains the browser picker target. Successful/loading status is announced through a visually hidden role=status output, while failed loads and direct Save failures open a dismissible File error window. It uses the existing movable titlebar and HTML error text; this is native browser feedback, not a claim to have recovered a DOS file-error dialog. Save As retains its inline validation error. Error dismissal does not edit/pause/replace the farm; a new file operation clears the prior error, and failed/aborted loads preserve the current simulation. Existing maximum-size, decoder, asset-loading and cancellation guards are unchanged.
