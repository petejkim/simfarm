# Original Sell window

Executable SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets; DS6190 begins at846f0. Static source analysis only.

## Layout and dispatch

Descriptor DSbdbe has flags0061, position128,80 and size192×272, including16 title pixels. Its paint/event stub1456 resolves to overlay27:0650/file4baa0; control stub1460 resolves to27:0c62/file4c0b2. Source artwork `sellwndo.bmp` is192×256, EEA offset489264, size24584, SHA-256 `ecd39bfa55152440e8c0687ecfb55011875fe53990dc826309deb8df2416a48f`.

The linked controls start at DSbda8; coordinates here include the title:

| ID | Action | x,y,width,height |
| --- | --- | --- |
|1/2/3|Harvest / machinery / livestock|16,18/48/78,28,28|
|4/5|Previous / next|16,112/192,16,16|
|6|Sell|88,232,40,24|
|9|Close|128,232,48,24|
|10/11/12|Select row0/1/2|40,112/144/176,128,32|

Table4c3c4 dispatches these to4c1c4/4c1d6/4c1e4,4c1ec/4c21a,4c286,4c15e and4c122/4c136/4c14a. Category DSbcde is0/1/2; top index DSbe38 and selected row DSbe3a reset on category changes. Up decrements the selected row or top index; Down advances a row and then scrolls beyond the third. Scrolling stops at the boundaries. Source row0 sale can move the top back when the final entry disappears; other rows fall back to the preceding populated row. Native selection/index clamping preserves the same ordinary next-item/last-item behavior. It tracks visible order, not an invented stable original object selection.

List builder4baee scans record slots in ascending order. Harvest requires active inventory types168..191; equipment4bd7a excludes rentals before4bd82 requires active; animals4bf3a require active. Existing manual sale gates and native bounded scans are documented in [manual-sales.md](manual-sales.md). Busy machines remain visible with disabled sale and an explanation. Canonical sale commands still revalidate storage, links, counts, busy state and live value, and respect pending decisions/flight. Source cash/ledger/removal behavior and retained original defects are unchanged.

## Graphics and actual text

Photo draw4b6da..4b6f8 places a112×64 card at client56,8. It uses definition byte11 and the same80-record `alltiles.btl` library as Buy. Empty selection draws card48 (a room/clock illustration), then source strings DSbca0/bca8: NOTHING / FOR SALE. Selected name is read by128a/480ae and displayed at client48,80; native uses actual CRP names/photos for all24 crops. DSbcb1 is `Item: %u of %u`, displayed at client40,200. HTML replaces all these strings and the two bitmap captions.

Row renderer4c610 starts at window48,112/144/176 (client48,96/128/160), adds8 vertically for16-pixel-high items, and draws definition graphics row-major from2be7:085e. Tiles848..1047 use the masked atlas. Native extended harvests use their reserved cropHarvestTile IDs. Price text is at client112,row+12; source DSbe4c format is `$ %lu`. Native shows the actual signed equipment/livestock receipt from the existing manual-sale preflight rather than a misleading unsigned value for unusual data (SF-055/056). Harvest values retain their original unsigned calculation.

Condition output is3−(loss>>14) for crops,3−(condition>>6) for machinery and(condition>>6) for livestock.4c673 computes27−quality;4b968 multiplies by4 and draws tiles539+offset through542+offset as a32×32 badge at client80,row. Thus quality0..3 correspond to BAD/X, POOR/C, FAIR/B, HIGH/A. Import assembles all four from `ega16til.til` (hash in window-titlebars.md). It masks only the central letter interior10,8,12×11 and lower caption2,22,28×9 with palette12. React supplies both letters and words. Border/ring pixels outside these caption masks remain source-exact. Sell artwork caption masks are91,222,34×12 and131,222,42×12.

The row selection outline is source palette1 yellow, drawn twice at4b823..4b867; unselected outlines use palette0 black. Native rows use the drawn136-pixel frame width to include the full original price area; the source click descriptors stop eight pixels earlier. This modest hit-target extension is deliberate. HTML fonts, tooltip/accessibility descriptions, disabled-control explanations and persistent sale feedback beneath the window are native adaptations. The vertical scrollbar uses a browser range input in the source shaft; original thumb raster/held-button repeat are not claimed reconstructed. Home/End and keyboard row navigation supplement pointer controls.

## Ownership and checks

`sellProducts` is a read-only plain TypeScript projection, separate from React and rendering. GameSimulation owns all accounting/removal and its existing transient command results. React owns category/selection/scroll position. Canvas drawing stays in `src/render`; all labels are DOM text. No save-schema, clock, RNG or transaction changes. Unknown source fields and the immutable distribution remain intact. This replaces the interim harvest list; older subsystem tests browse the real three-row catalog rather than assuming every lot has a simultaneous button.

Tests pin executable descriptor/control/dispatch bytes, asset hashes, every unmasked pixel, all quality badges, binary boundaries, all-farm displayed receipts/nonmutation, native24-crop identities and rental/busy handling. Browser coverage checks source-size geometry, sprite pixels, selection/scroll boundaries, all categories, empty/last-item behavior, source-sized dragging/reopening and exact checkpoint continuation. Full preservation remains incomplete; independent original Sell event-loop/redraw timing and the other original dialogs remain ongoing work.

The source list's absent record-capacity stop is retained separately as SF-156. Its inconsistent-count reachability and downstream harm are unproven; the native projection uses bounded decoded arrays. This does not justify labeling the ordinary Sell interaction an exploit.

## Duplicate asset-sale forms retired (2026-10-11)

Removed AssetSaleControls from the interim Machinery/Livestock inventories. Source list builder4baee/4bd7a/4bf3a already covers the same records, excluding rentals and preserving slot order; original Sell is now the sole UI sale route. Its three-row catalog/scrollbar selects newborn animals, stored parents, ground/stored machines and aircraft. Busy entries retain their explanation and disabled SELL. The old locate shortcut was native navigation, not an exclusive simulation action; it is removed with the duplicate forms. Move/Examine and original map inspection remain available.

Migrated manual-sale browser checks preserve source quotes, exact cash/ledger/storage/map cleanup, rental exclusion, blocked-sale nonmutation, reload mid-sale sequence, seven-day continuation, aircraft repurchase and source terrain pixels. No canonical sale/save rule changed; original defect records remain in manual-sales.md/original-bugs.md.

2026-10-11 user follow-up: the interim feedback area below this window (unsellable reason and sale result) was removed; outcomes show through the disabled Sell button, item counts and Funds. See progress.md.
