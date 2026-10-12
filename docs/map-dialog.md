# Original Map window and ordinary land transactions

Source is the immutable `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets. Static disassembly only; no DOS or x86 environment runs in the browser. Overlay8 begins at34070 and has1c10 initialized bytes. The initialized DS6190 block begins at846f0.

## Window and artwork

Toolbar dispatch3e8ac selects descriptor DS68ce: position80,64; width288; height256 including the16px wooden title. Client bitmap `mapwndo.bmp` is288×240, and the miniature viewport is192×192 at window-relative72,16. The paint callback24e6:1244 resolves to354de; control callback24e6:124e resolves to35514. Title DS67ba is MAP; resource DS67be is mapwndo.bmp. Preserve other descriptor words without assigning guessed semantics.

Archive resources:

| Resource | Archive offset (decimal) | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| mapwndo.bmp |430112|34568|bb582dd2c18f50ee9cea0607e29b06e3ad7a74ac978d5835fc522a73a5ea52de|
| maphelp.bmp |425304|4808|ee9a1a40980023b3daeae726a2611d9af1ae98c5f36a339e1d0abeb6fc8340f6|
| far_mapc.mbm |1718816|1920|2fad5b9a88d639e943af13b85124898451edb055ec7acf12b0a5c49046ca5043|

The importer makes a separate ignored text-free map-window.png, preserving every pixel outside the documented caption masks in `src/formats/map-window.ts`. Question mark, Land Value and CLOSE are React text. The nutrient bag contains a stylized plant, not a letter; its original artwork remains intact. Original artwork is1×, matching terrain. The supplied distribution is untouched.

The DS68b8 linked controls are IDs1,6,2,7,3,8,4,5,12,10,11. The eight overlay buttons occupy two28×29 columns at x10/40 and window y19/49/79/109. Help12 is25,139,28×28; trade10 is160,218,48×24; Close11 is224,218,48×24. Source35530..355ab clears other selection flags, toggles the clicked overlay and sets mode0 when toggled off. The nine20-byte mode strings are at50359. Native state retains that ordering and initial Overhead mode. Selection starts at region0,0 and remains local React state.

## Miniature and overlays

341de..34a0a renders original2×2 MBM tiles in column-major world order, in batches of four adjacent columns. The jump table at34822 resolves modes0..8 to34238,3426a,34386,34418,344a2,3452c,345b6,34640,34722. Native read-only projection selects the same indices; the pure renderer copies actual miniature pixels with the gameplay palette.

| Mode | Label | Source miniature index |
| --- | --- | --- |
|0|Overhead|terrain word &07ff|
|1|Property|unowned: terrain; owners1/2/3:495/463/466, table DS693c|
|2|Soil Toxicity|464 + field byte32/8, truncated; non-field464|
|3|Soil Nutrients|464 + field byte29/8; non-field495|
|4|Disease|464 + field byte22/8; non-field464|
|5|Pests|464 + field byte20/8; non-field464|
|6|Weeds|464 + field byte21/8; non-field464|
|7|Groundwater|467 + signed soil byte + unsigned cell attribute; terrain bit2000 selects495|
|8|Field Profit|495 - field byte19/8; non-field terrain|

Field overlays test the second map word's1000 bit and query the containing field through1957:01b8; records begin at DS2432. The byte addresses read at348b9..348e6 establish these offsets, including the high byte of word2444 for Field Profit. This restores the source display computation, not a newly calculated profitability metric. Native field lookup is bounded; a stale marker without an active field uses non-field display behavior. No source record is modified.

Property fills the selected16×16 region with XOR15 scanlines, then redraws the yellow palette1 grid every16pixels (340df..341d9). The wrapper0863:075a/fileaf8a calls0416:059f/file68ff, whose VGA data-rotate register write at696d selects XOR. The renderer performs palette-index XOR, not RGB inversion. Both normal and XOR atlases are decoded directly from packed source indices: palette7 and11 share the same RGB value, so reconstructing an index from RGB would lose which XOR color to draw. Every inverted miniature pixel is tested against the original byte pairs. The low/high scale35095..35131 draws miniature tiles464..495 across64pixels, repeated vertically to8pixels. Labels remain HTML.

The native additional crop slots have no original MBM addresses. Their terrain IDs1280..1391 map to the first original crop's corresponding stage/badge/harvest/plant miniature shapes. This is an explicit native extension for the user's all24-crops requirement, not a claim of recovered extra DOS slots. Original indices0..959 retain their exact packed images. Out-of-range tiles and malformed atlas sizes are rejected rather than read past buffers (see SF-151).

## Map gestures and land commands

Source34b5a..34dce moves Edit's upper-left tile to the clicked miniature position and clamps it to world bounds. Native click/drag sends a presentation-only viewport location; the fixed Edit canvas scrolls to it. A live white/black rectangle tracks Edit scrolling, zoom and viewport size. Its browser CSS border is a native approximation of the original XOR outline34dd0. Property mode instead selects a region with coordinate/16 at3599f/359b9. Native bounds exclude the right/bottom edge; keyboard arrows provide an additional accessible selection method. See SF-157 for the source's inclusive-edge arithmetic.

Map355b8 only trades in Property mode. The source price is the existing quoteLand reconstruction3c766: base15000 plus occupied plots, fertility, signed moisture and terrain surcharge, with word arithmetic retained.35c1a formats the selected price as unsigned digits at window24,200. BUY uses3c8ba with perimeter fences enabled; canonical native purchase behavior is unchanged. Source35854..358d4 only draws a BUY button for affordable unowned land or SELL for player-owned land. Native leaves an unaffordable BUY visibly disabled with readable feedback; other ownership has no trade button.

Owned land follows355e3..3564a: home-region coordinates are protected with original message141; helper1b770 scans all64 second map words for field flag1000 and rejects with message142. The native ordinary-sale wrapper performs these same gates, then calls the existing land-sale routine3c9c2 with taxable=true. This credits cash and land income, updates taxable sales, removes buildings as already reconstructed and fences adjacent owned land. It does not remove fields automatically. Forced default sales remain a separate caller with their existing field teardown and taxable=false behavior. Commands own all mutation; React only selects a plot and displays the published result. Native checkpoint format and pacing are unchanged, and transient transaction results are not saved.

Help35718..357d5 displays80×120 maphelp.bmp at the miniature's top-left while the source pointer button is held. Native help is a keyboard-accessible toggle containing real HTML labels in the same four paired rows; CSS supplies leader lines. Exact font metrics, held-button timing, miniature disaster glyphs, source click-VOC dispatch and original overlapping-window event ordering remain unfinished. The supplemental feedback below the original client area is a native usability addition. The older Edit-tools land shortcut is retained during field/planner migration; the normal Map toolbar and Windows menu now use this original window.

## Verification

Source tests pin EXE hash, descriptor/control chain, mode strings/jump table and ownership indices. Artwork tests verify every untouched source pixel and reject truncated/wrong-sized resources. All eight farms' Overhead output is compared pixel-for-pixel against an independent direct packed-plane calculation; all overlays are exercised without mutating records. Targeted cases cover raw condition bytes, signed groundwater extremes, XOR selection/grid, all32 legend patterns, extra crop IDs, unknown index rejection and boundary coordinates. Ordinary-sale tests cover every cell in a plot, protected home/other owners, taxable ledgers, repeat-sale rejection and exact save/load continuation.

Browser checks cover source geometry, all overlays, toggle-off, HTML help, actual Edit scrolling and outline tracking, keyboard boundaries, retained movable placement, exact unchanged saves after browsing, purchase/sale/reload, rejection of home/fields/other owners, insufficient cash and missing artwork. Reviewed artifacts/browser-map-property.png. Full regression results are recorded in progress.md.

The ordinary transaction path also exposes SF-158: occupied-region pricing includes the just-purchased plot, so an immediate qualifying resale quote rises100. Native preserves the source arithmetic and verifies it explicitly; this is an immediate cash result, not a claim about profit after annual tax. A balancing change is deferred and the original evidence remains in original-bugs.md.

Interim UI retirement: the duplicate Land purchase form is removed. The subsequent Farm controls retirement removes its native Buy land shortcut too. Use the Map toolbar/menu and Property overlay. Map activation retains its selected overlay; trading continues through the same source-backed quote/buy/sell commands.

2026-10-11 user follow-up: the interim feedback area below this window was removed; outcomes show through the source controls, readouts and Funds. See progress.md.

## Rebuilt on shared chrome (2026-10-12)

User request (ui-components.md). Map is a framed `GameWindow` around a 272×232 flex client. `map-window.png` is no longer drawn with transparent buttons over it.
- **Left column:** eight mode `BevelButton`s (source icon sprites, pressed for the active mode), the "?" help button, the Land Value label and a sunken readout.
- **Map:** the 192×192 overview canvas sits in a `SunkenInset` that is open at the top, as in the source. The Edit-view outline and the help legend are layered in the map's own grid cell (offsets as margins, no absolute positioning).
- **Footer:** the Low/High gradient (canvas) and mode name, BUY/SELL and CLOSE caption buttons.

The overview and gradient remain canvases because they are rendered content, not backgrounds for controls. The layout follows the source but is not pixel-perfect.
