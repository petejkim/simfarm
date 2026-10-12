# Original Market Value window and town entry

Source SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets; initialized DS begins846f0. Market code is overlay26 at4a640. These are static source-byte findings, without DOS execution. Existing canonical market rules/history are documented in [market.md](market.md).

## Descriptor and controls

DSbbfa has flags0061, x144/y112, dimensions320×224, title DSbac2 `MARKET VALUE`, image DSbacf `futures.bmp`, paint stub24e6:1442 and button stub24e6:144c. The latter resolve to4ac76 and4acaa. The native320×208 client sits below the shared16-pixel movable wooden title. The source image is33288 bytes, SHA-256 `bcdbf865f2c33c75024583ff9e80b6fb48c8e3689c72cd16a3fbb6dd90c4c01a`. Import validates dimensions, replaces only five text rectangles with palette12, and retains the original bytes separately. Captions and values are actual React text.

The22-byte control chain DSbbe4 through DSbadc has13 nodes. ID1 is Close at window258,189/48×24 (client258,173). ID6 covers the4×4 crop grid at window176,24/127×127. The dispatcher4adec handles only IDs1 and6; IDs2–5 and7–13 have no action branch, despite retained descriptor records, some outside this bitmap's bounds. The supplied window is a price/history viewer, not a working futures exchange. Native does not invent buy/sell-futures commands.

Selection4ad3a subtracts window origin plus176,24 from mouse coordinates, arithmetic-shifts each by5, clamps each0..3 and stores row×4+column in DSbc67. Each original crop badge is32×32: four atlas tiles539+slot×4+[0..3], placed at client176+column×32,8+row×32. Source4a9a2..4ab93 adds a two-pixel palette8 selection border. Native uses the same crop-slot artwork mapping, extended for crops16..23. Sixteen crop buttons retain the source grid; a small native footer switches pages. Browsing another page leaves the selected crop/history intact until a crop is selected. Keyboard buttons, actual-text accessible history table, persistent dragging and32-pixel crop buttons spanning a128-pixel grid are native presentation choices. No mobile rearrangement is introduced.

## Graph and displayed values

Paint4a750, event17 only, clears window24,36/120×140 to palette12. For each of thirty retained history words,4a640 uses CRPword34 as the reference price. Divisor is reference>>3, replaced with1 if zero. Its level is16 plus/minus the unsigned quotient of absolute price difference divided by that divisor. Four vertical palette3 lines form each bar at x25+sample×4 through x28+sample×4, down to windowy175. Top is y175−level×4. Tops below windowy36 are changed to38; tops beyond174 are changed to172. Client coordinates subtract16, so normal bar tops are20..158 and the bottom is159.

The original computes these coordinates in wrapping words and compares unsigned absolute screen positions. SF-164 records its extreme-value wrap; native clips the unwrapped calculation to the same ordinary bounds. Every integer price0..2×reference for every shipped crop agrees with the direct source calculation. Missing migrated samples remain null and draw no bar, rather than being treated as zero. The native chart never rewrites history or consumes RNG.

After bars,4a7e6..4a84e draws palette14 grid lines every four pixels: vertical x24..<148 from windowy36 through176, horizontal y36..<176 from x24 through144. Two palette1 reference lines are at windowy108 and109 (client92/93). Paint order and inclusive line endpoints are retained. All drawing is in src/render; React owns controls/text only.

Crop name comes from crop trade definition+14 at4aba4 and draws at client200,147. Price4abd4..4abf6 computes **low16(floor(crop-definition price/10)×CRPword32)**, converts it to unsigned decimal and draws at client200,160. It does not read the history head or harvested-goods price. The displayed Futures Owned field at4ac26 uses signed conversion of crop-definition count(+4), drawn at client120,182. These raw display semantics are preserved, with SF-164 retaining extreme wrap/sign evidence; no futures ownership meaning beyond that source field is invented. All supplied crop-price/cache and market history state remain in GameSimulation, independent of the window selection.

## Town windows

Shared map interceptor25748 calls classifier9536, which masks terrain to11 bits and scans nine image bases from DS9484:320,323,326,329,332,335,338,352,355. Each matches three inclusive3-pixel tile-code runs at base,base+40,base+80. It returns group index+1 or0. The caller decrements the result, and table2590a maps the first five groups to:

| Group/base | Window descriptor | Native destination |
|---|---|---|
|0 /320|DSbbfa|Market Value|
|1 /323|DSbdbe|Sell|
|2 /326|DSb32a|Bank|
|3 /329|DSb4a6|Buy|
|4 /332|DSbe9c|Farm Expert|

The remaining four groups return to the ordinary tool path. There is no extra regional/ownership gate in this image lookup. Aircraft interception remains earlier in the shared handler. Source mode15/event5 bypass at255e6 prevents primary Bulldoze from opening windows; secondary entry still works. Native town/default/flight blockers remain enforced before interaction.

Town images now open the matching windows on primary or secondary press. Construction checks this route only on its initial press, before its held stroke. Map entry preserves active tool drafts and is read-only; toolbar/menu navigation retains its existing tool-cancellation policy. Market, Sell, Bank and Buy have reconstructed interiors. Farm Expert still opens its interim crop guide; its original interior is the next UI increment. This does not claim full window stacking, click.voc callback timing (4acb9), GUI scheduler or entire game fidelity.

## Evidence and checks

| Range, end exclusive | SHA-256 |
|---|---|
|4a640..4a750|c4b7a8f064611a367cd75608a8456f18fb09d48574ffe9fd1076d85b42b2d1cf|
|4a750..4ac76|a45ccf8bc07feecb293a33905bdc0524f6ea6b64e90749d5b7843f3153795a5b|
|4acaa..4adfc|2dcb97adcc5e0edf9a731913103eae878739796677346a294eb882769ce24180|
|9536..95ce|8f15cccf7f75ba54596edcff6e30bc4a9deff337a8da3100307710c3dc4fff8b|
|25748..2591b|306b84a27dca800c69ef680bf9df21cdd8c72ae0853479fd1a7210c1608fbea3|

Unit checks pin controls/code, compare all imported pixels, reject malformed/truncated bitmaps, compare all shipped ordinary price ranges against word-register source arithmetic, enumerate extreme clipping and all2048 image codes with flags, and verify all24 crops across eight farms without snapshot/save mutation. Browser checks compare the rendered chart and all24 source badges pixel-for-pixel, original client geometry/HTML text, movable/reopened selection, missing assets, weekly changes, null samples, separate trade/history values, exact saved continuation, both map buttons/zooms, all five town destinations and primary Bulldoze/default gates. The original Farm Expert interior is now restored separately in [farm-expert.md](farm-expert.md). Wider preservation and other original dialog interiors remain incomplete.

## Native rebuild on shared chrome (2026-10-12)

Market Value now uses the common frame (`GameWindow framed`) and a 304×200 flex client. There is no bitmap or canvas; `src/render/market-preview.ts` was removed.
- **History inset:** a `SunkenInset` holding the title and the graph at client (16,20), 121×144. The graph stacks three layers:
  - bar spans at 25+4i from `marketBarTop`, palette 3;
  - a CSS gradient grid reproducing the source lines (verticals every 4px to row 161, horizontals every 4px to row 160, 2-row ticks every 20px);
  - the palette 1 reference rows 92–93.
- **Crop panel:** a 132×132 `SunkenInset` of 32×32 buttons. Each button holds its four `cropBadgeTile` sprites and, when selected, a 2px palette 8 frame.
- **Crop and Price:** insets with real output text.
- **Bottom row:** Futures Owned, CLOSE (a `BevelButton` with shadow), and the native ‹/› pager.

Accepted difference: the pager, needed for twenty-four crops, moved from a strip below the window into the empty space between the futures box and CLOSE.

Tests: the browser spec checks bar geometry against an independent source-formula reconstruction, the grid and reference styling, badge tile offsets and selection colour. Validation: market-window and market specs pass (6/6).
