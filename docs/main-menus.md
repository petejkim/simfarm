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
| 5 | Load Crop | 3ed6a | Creates distinct descriptor6190:adb4. Crop-file callback/rules still need reconstruction. |
| 6 | Quit | 3edc4 | Confirmation1 cancels;0 opens the save dialog and setsae1e=1; the remaining branch sets0194=1 at3ee64. |

The live React File menu retains these exact labels/order and calls existing native save/import/new-farm integration. File Load Game is ordinary `importOriginal`, with no temporary chooser generation; geographic chooser Load remains the separate result1 startup composition. Browser checkpoints load exactly without either original startup replay. File New Game opens the existing chooser; its cancellation preserves the current farm.

Save downloads a native JSON checkpoint. Save As allows a filename, normalizes the native extension and remembers the name within the current farm mount; subsequent Save downloads under that name. Neither overwrites a DOS source file. The browser decides final download placement/duplicate naming. About currently shows native preservation information and original attribution, not the recovered original About window. Quit offers Save and pause, Pause game or Cancel; it retains the tab/farm instead of attempting process exit. Its saved checkpoint precedes pausing. Cancellation leaves running state intact. Source nested-window pause ownership and elapsed menu/dialog timing remain deferred; the browser clock continues while menus/dialogs are open until the user explicitly pauses/quits. These are explicit adaptations, not claims of DOS callback equivalence.

Menu text uses React buttons; no bitmap glyphs are displayed. Header positions use the occupied400-pixel strip scaled up to2×, reducing unused right-hand space; the rest of the farm still has its native enhancement interface. Popup width128 and12-pixel item pitch are doubled; replacement font metrics and borders are not claimed pixel-identical. Keyboard arrows/Home/End, Escape, outside click and mobile sizing are browser affordances. Load Crop is visibly disabled with its reconstruction status. The other four headers are present but unavailable until their callbacks/owners are integrated; current farm controls remain available below.

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
