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
