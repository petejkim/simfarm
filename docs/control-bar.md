# Original control strip and Windows launchers

Source executable: `../simfarm-dos/SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All code addresses are hexadecimal file offsets. Initialized DS6190 begins at `846f0`. The distribution is unchanged.

## Verified source layout

`cntlbtnh.bmp` is a 640×32 four-plane bitmap, archive offset258240, size10248, SHA-256 `6099e6fd31c27d73c0a20c1ee63a0ac1f41bfbff0f9fa54e739e11637a3c2b0f`. Its filename lives at DS5abe/file8a1ae. Main redraw2a0fc..2a123 loads it and uploads it at screen(0,16), immediately below the sixteen-pixel menu strip. Nine adjacent32×32 buttons occupy source x0..287. Redraw2a126..2a35e checks each window pointer and marks the corresponding button and Windows item, in the same order as the linked menu chain. No tenth toolbar button is present for Farm Expert. The empty center inset receives three source graphics at x328/344/360,y24 in2a518..2a552; their semantics are not inferred here and this first native strip leaves the inset empty.

Windows callback stub24e6:133e/file2839e resolves to overlay18,27ce:0408/file3e7b8. Dispatch3ea48..3ea54 indexes the words at3ea56. The first ten branches are:

| Index | Menu/window | Branch | Descriptor DS offset |
| --- | --- | --- | --- |
| 0 | Buy | 3e7c8 | b4a6 |
| 1 | Sell | 3e80c | bdbe |
| 2 | Evaluation | 3e846 | 44ac |
| 3 | Map | 3e8ac | 68ce |
| 4 | Weather | 3e8e6 | 436e |
| 5 | Balance Sheet | 3e920 | aaf8 |
| 6 | Bank | 3e95a | b32a |
| 7 | Edit | 3e994 | 562a |
| 8 | Market Value | 3e9ce | bbfa |
| 9 | Farm Expert | 3ea08 | be9c |

The branches reuse an existing pointer via stub106e or create via1028 and insert via101e. This establishes identity/order and creation versus raising, not complete window behavior. In particular Edit's source descriptor/resize and tool interactions still need reconstruction. The user explicitly requires the native Edit view to remain visible, maximized and non-resizable. Its launcher must focus it, never toggle it off.

Source date formatter2a4dc refers to DS5af0, `Week %d of %s %d`. The current native strip retains the existing day-level date display; this is a documented native difference. The right-hand Date/Funds labels and value insets retain their bitmap positions.

## Native increment

The strip uses fixed1× desktop coordinates (source640×48 displays at640×48), including the original unused space after the menu headings. There is no breakpoint that compresses/reorders this strip for phones. A narrow browser can scroll horizontally; a mobile layout is future work. Working panels open over the permanent Edit workspace; their original interiors remain under reconstruction.

Import keeps the complete preservation bitmap and also writes ignored `control-bar.png`. `readControlBar` validates dimensions and erases only five caption rectangles with source palette12, RGB194/194/194: Buy(3,20,26,10), Sell(35,20,26,10), Edit(225,19,30,12), Date(416,2,44,12), Funds(416,18,44,12). Coordinates are local to the bitmap. Every other pixel is unchanged. React renders the captions, live date/funds, menu headings and popup entries as actual text. Other toolbar pictograms remain source art. Replacement font metrics and the cleared Edit caption surface are not pixel-identical to the original lettering.

File and Windows menus work with mouse and keyboard. Windows launchers currently focus the existing native controls: Buy→seed/chemical shop, Sell→stored harvest, Evaluation→report, Map→land purchase, Weather→current weather, Balance Sheet→report/taxes, Bank→loans, Edit→map, Farm Expert→crop guide. These are transitional destinations, not reconstructed dialog contents. Market Value remains unavailable until its actual graph/window is implemented. No simulation, save format, pacing, automatic pause or window-check ownership changes are made here. A launcher does not mutate the saved farm.

Next replace the dashboard stack with the always-maximized Edit workspace and source window/dialog layout. Restore the Edit tool palette and actual map interactions, then original Buy/Sell, Bank, Map/land, field information/planner, reports/weather and remaining windows. Keep the native four-second day, speed slider and all24 crops. Do not pursue original timer fidelity, crop swapping or mobile rearrangement.

## Edit-workspace follow-up evidence

The original palette asset is `editeasy.lzs`, archive offset1716591, size2225, SHA-256 `fa398c509ed630a9d9f21197e47cde2e102291e7954d1f489ef39cb8ec55d84b`. Startup3fdc1..3fdd4 loads DS a9b9 through stub138e, storing the resulting far pointer at13aa/13ac;3fde8 links descriptor562a to5614. A provisional standard LZSS decode (4096-byte zero-filled ring, initial write cursor4078, least-significant flag bit first, 12-bit offset plus length nibble+3) produces exactly5000 bytes with BMP header `06 00 d0 00 04 00 01 00`:48×208 pixels. Visual inspection shows two columns of tools, then Plant/Spray/? buttons. This exploratory decode lives only in ignored artifacts; verify the source decompressor and binary boundaries before introducing a production decoder. Do not display its Plant/Spray/question-mark bitmap lettering in the live game.

`buttons.til` is a separate button-caption resource, not the Edit tool icons. Source9493 multiplies the index by0240,949a..94b7 seeks, and94c5..94d5 reads576 bytes. Decoding eighteen48×24 four-plane records explains its10368 bytes and displays OK/Buy/Sell/Cancel/Goto/Use, Exit/Load/New/Used/Yes/No, Save/Next/Prev/Close/Top/Rats. The earlier16×16/24×24 exploratory interpretations were wrong. Rebuild these captions as HTML text when restoring dialogs, rather than displaying this text atlas. Generated review images: `artifacts/original-buttons48.png` and `artifacts/original-edit-provisional.png`.


Workspace follow-up: the dashboard has now been replaced by the permanent Edit frame and source tool palette. These launchers open native windows over the map rather than scrolling to page panels. Original dialog interiors and full tool gestures remain unfinished; [edit-workspace.md](edit-workspace.md) describes current ownership, decoding confidence and remaining adaptations.

Bank follow-up: its launcher now opens the reconstructed original terminal at source dimensions and position, with an HTML numeric keypad and source-supported borrow/payoff controls. Other interim window destinations above remain under reconstruction. See [bank-dialog.md](bank-dialog.md).


Market Value is now available from the toolbar and Windows menu, with its original chart/crop grid, real text and all24-crop pages. See [market-window.md](market-window.md). Earlier unavailable/transitional notes above describe the toolbar increment, not the current Market implementation.


## Restored toolbar forecast

The previously empty center inset now displays the original three weather tiles at screen328/344/360,24 (16×16 each). Source2a518..2a552 reads DS124e (day), adds loop index0..2, reads signed forecast byte DS4078+index, and draws atlas tile204+code. SHA2562a518..2a554(end exclusive): `1eb4aa42ad4ed2ac672e0b4e52c868dda723331308245be900e72769c38e2b31`. Confidence high from static instructions and existing Weather-window forecast decoding.

ControlBar subscribes through the existing snapshot render and uses the current terrain atlas; imperative canvas drawing remains in src/render/toolbar-weather.ts. Adjacent current/next-week arrays provide the three days across rollover without RNG calls or simulated prediction. The accessible label/title names today, tomorrow and day3; icons contain no bitmap text. Opening Weather is not required. Browser checks compare every pixel against original tiles, verify exact1× coordinates, cross-week day advancement and unchanged saves when merely viewing. This completes user correction1; climate-dependent terrain appearance is next.


## Component reconstruction of the strip (2026-10-11)

User request: replace the background-image strip with transparent overlay buttons by separate components whose bevels are CSS borders. `ControlBar` now composes `WindowLauncher`, `ToolbarInset`, `ToolbarForecast` and `ToolbarReadout`; no full-strip `<img>` remains. Geometry below is measured from `cntlbtnh.bmp` pixels (bitmap-local, add16 for screen y). Palette roles: black0, white255, face grey194, shadow130, lettering65.

| Element | Source pixels | Native construction |
| --- | --- | --- |
| Strip | Row0 black across640; rows1..31 grey right of x288 | Grey background with 1px inset top shadow |
| Launcher n (0..8) | x32n..32n+31: 1px black frame; 2px raised bevel (white top/left, grey130 bottom/right); 26×26 face at (32n+3,3) | `<button>` 1px black border; inner face 2px border; `control-bar.png` as sprite at background-position(-(32n+3),-3) |
| Buy/Sell/Edit captions | Face rows21..27, lettering65 with white right-hand pixels | HTML text, `#414141`, 1px white right text-shadow |
| Forecast inset | Outer(326,6) 52×20, 2px sunken bevel (grey130 top/left, white bottom/right), interior(328,8) 48×16 | `ToolbarInset` containing the existing forecast canvas |
| Date/Funds boxes | Outer(461,2)/(461,17) 176×13, 2px sunken bevel, interior172×9 | `ToolbarInset` holding live `#farm-date`/`#farm-cash` text |
| Date/Funds labels | Bold black lettering ending x456; caps rows5..11/20..26 | Right-aligned HTML text ending x457, vertically centred on its box |

Where light and shadow bevels meet, the source paints the two diagonal pixels face grey. CSS solid-border miters antialias those pixels to a blend of white and grey130 (≈grey192), visually close but not guaranteed identical; the browser test exempts only those corner pixels.

`CONTROL_BAR_TEXT` launcher rectangles were narrowed to the lettering rows inside the faces: Buy(3,21,26,7), Sell(35,21,26,7), Edit(227,21,26,7). The previous native rectangles (y20..29 and Edit x225..254,y19..30) also erased bevel rows/columns and the bottom of the Buy/Sell bag shadows and Edit crane mast. That was a native import overreach, not an original defect. The Date/Funds rectangles remain erased although those sprite regions are no longer displayed. Pressed launchers swap the bevel colours on `:active`; this is a native affordance with no recovered source pressed-state routine (redraw2a126..2a39e only sets menu check flags, see window-stacking.md). The previous hover highlight was dropped. Confidence high for measured geometry/colours; text metrics remain browser-font approximations.

### Follow-up: flex layout, black frames, Edit launcher removed (2026-10-11)

User corrections to the component strip:
- **Frame gap.** At fractional browser zoom, a thin gap appeared between each launcher's 1px black border and its inner bevel span. The black frame is now the button's own black background showing through 1px padding, so rounding cannot expose face grey.
- **Date colour.** A leftover dashboard rule `#farm-date{color:#ead6a1}` overrode the strip ink. It has been removed, so the date value is black like Funds.
- **Edit launcher removed.** This is a user-requested native difference from source face7. Edit stays permanently checked in the Windows menu, which focuses the terrain, as does focusing the map. Market Value now follows Bank at x224, still drawn from source face8. Buy and Sell are the only captioned launchers. The Edit rectangle in `CONTROL_BAR_TEXT` is retained, although that face is no longer displayed.
- **Flexbox layout.** Nothing in the strip is absolutely positioned. The flex row is: launchers (8×32 = 256px) | forecast area (flex:1, centred) | readout column (padding 2px top / 3px right, 2px row gap; 41px right-aligned label, 4px gap, 176×13 box).

The readout column keeps source x416..636 and y2..14/17..29 exactly. In the source, the forecast inset is centred between the end of the launchers (x288) and x416. The native forecast remains centred, so with one fewer launcher it moves from outer x326 to x310, with tiles at x312..359.

### Follow-up: browser verification fixes (2026-10-11)

The first browser run of the pixel test exposed four issues:
- **Stale sprite.** The local `control-bar.png` predated the narrowed erasure rectangles. Re-running `bun run import` fixed it.
- **Readout text overflow.** Arial 10px over-ran the 172×9 interiors into the bevels. Per user direction, readout values now use a 9px font without padding offsets. The date fits completely. `overflow:hidden` clips only the 1px top of `$` in Funds.
- **Caption shadow.** The 1px white text-shadow on SELL reached the right bevel. Captions now clip to their 26×9 box, and the test exempts that whole box.
- **Panel shadow over the strip.** The terrain panel's `box-shadow:0 10px 30px` faintly darkened strip rows 27..30 from x50. The strip now has `position:relative; z-index:1`. Its children remain in normal flex flow.
