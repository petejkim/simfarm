# All supplied crops in the native game

User-directed enhancement, 2026-10-09/10: omit crop-file loading and swapping. Every browser farm exposes all24 supplied CRPs in planting, planning and seed purchasing. The original sixteen-slot file decoder remains available for preservation and historical save reconstruction. This is a native extension, not a claim that DOS supported24 simultaneous crops.

## Evidence and boundaries

SIMFARM.EXE SHA256 remains `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All24 `CROPS/*.CRP` files are5890 bytes each. SHA256 of the concatenation of uppercase filenames in lexical order, a NUL byte after each filename, then its complete file bytes is `e877ed1e3794f2ecc92c9b3f8822020fc7a9c8859b19e7a4878257e3e5011f61`.

The supplied catalog is almonds, apples, barley, carrots, corn, cotton, gladiolu, grapes, lettuce, oats, onions, oranges, peanuts, potatoes, rice, sorghum, soybeans, strawber, sugar, sunflowe, sweet, tobacco, tomatoes and wheat. The native UI uses the names decoded from each file rather than these abbreviated filenames.

Verified existing decoder boundaries: CRP128-byte definition at0x1500, crop-price word+34 and seed-price source word+38. Tile uploads at EXE0x468c2–0x46a13 consume eight growth tiles from CRP0..0x3ff, four badge tiles from0x1200, harvested item at0x1400 and seed/planting icon at0x1480. Source schedule dispatcher0x2f66a..0x2fb12 recognizes original planting codes832..847. The original crop trade table has24 records but only16 are named crop slots; seed and harvest tables have16 records. These source facts remain unchanged.

## Native policy

Keep each farm's first16 filenames/indices in their original order. Append its eight missing shipped files in lexical order. Existing fields, inventory, plans, source bytes, random state, money, counters and first16 market histories remain intact. The previously unnamed eight crop trade records move after the new entries in native memory/save tables and retain every byte. They are not repurposed as additional definitions.

The new crop/seed/harvest definitions are explicit native records with zero initial counts, file-derived prices and no DOS pointers. Initial extra history has29 unknown samples and the file's current base-price head. Weekly pricing applies the recovered arithmetic to the extra crops using a fork of the pre-update RNG. The first16 updates retain the original RNG stream and shared market mood; the extra updates do not advance that stream or change its subsequent mood. This intentionally keeps adding idle catalog entries from changing existing farms' weather, field work or markets. Planting, weather sensitivity, growth, harvest, contracts and other crop-dependent actions use the corresponding original CRP definition.

Native crop terrain/schedule IDs reserve1280..1391, away from original terrain0..879 and masked graphics848..1047:

| Purpose | Extra slot16..23 IDs |
| --- | --- |
| Growth stages |1280..1343 (eight per crop)|
| Field badges |1344..1375 (four per crop)|
| Harvest inventory |1376..1383|
| Seed/planting icon |1384..1391|

The eleven-bit terrain field can contain these IDs. The atlas appends exact original CRP pixels. Badge protection, field repaint/clear, planning recognition, storage interiors and inventory pickup distinguish native tiles from original status/machinery graphics. Harvest types extend168..191 and seed types192..215; these remain disjoint from chemicals220..223. Original byte/word record sizes and bounded inventory/building-slot limits stay unchanged.

Restart and SSM import perform the recovered sixteen-slot phases first, then the accepted browser farm expands again. Restart discards extra live catalog records alongside the replaced farm; SSM import retains the original16 history slots and initializes the newly appended histories. Native checkpoints preserve the entire expanded live state without re-expansion or replay. Missing crop files formerly failed tile composition before replacing the visible farm; since the fixed-place sheets (below), loads no longer fetch crop files for artwork. Missing or invalid terrain sheets still fail before any farm is shown.

## Fixed-place terrain sprite sheets (native, 2026-10-13)

Farms keep their own slot order: a scenario's sixteen SSM slots come first, then the other eight shipped crops. The
simulation and saves depend on this order. For example, `updateMarket` (`src/simulation/market.ts`) draws the original
random numbers slot by slot, so reordering slots would change prices and break exact checkpoints.

Only the artwork has a fixed order:
- The importer patches all twenty-four shipped crops into the terrain atlas in `SHIPPED_CROP_IDS` order (`FIXED_CROP_FILES`). It writes one PNG per palette (`terrain-tiles.png`, `.rain`, `.frost`), each with an `.inverted` outline variant (palette index XOR 15).
- Drawing maps each crop tile of a farm slot (stage, badge, harvest and plant tiles) to the same tile of its crop's fixed slot (`fixedCropTiles` in `src/formats/crop-slots.ts`). Every other tile maps to itself.
- The world renderer applies the mapping per cell; UI `TileSprite`s get it through `CropTilesContext` from FarmView.
- The masked, town-event and region-map atlases are crop-independent, and are now imported PNG files too.

The runtime no longer composites atlases or creates `data:` image URLs. Every sprite references the shared files.

Evidence: `tests/fixed-crop-tiles.test.ts` patches each original scenario's own slot atlas, as the runtime did before. For all eight SSM files and all 1392 tiles, every tile's 128 bytes equal the mapped tile of the fixed atlas, so the pictures are unchanged. The mapping only permutes crop tiles.

## Saves and checks

Expanded farms write native v24:24 filenames,24 crop definitions,24 prices/history rows,24 seed/harvest goods records and32 crop trade records (24 active definitions plus the retained eight unnamed original records). Non-expanded research simulations still write v23; readers accept1–24. V24 validates the complete unique supplied filename set, original first16 identities for SSM-backed farms, table lengths, field references, definitions and matching assets. Loading older saves in the browser explicitly expands their restored state; the old decoder itself retains its historical behavior.

Coverage includes all eight original farms, all eight appended slots, seed purchasing/consumption, planting/growth and badges, plan creation/projection, exact checkpoint continuation, storage/movement/sale, source pixel ranges, invalid boundaries, missing assets, and generated/restarted/imported farms. Browser regression fixtures now explicitly use the same catalog policy. Historical-version fixtures first restore genuine16-slot table sizes before assigning their historical version. No original-game defect is claimed by this feature; original defect entries remain retained in `original-bugs.md`.

## Favicon (2026-10-12, user request)

The browser favicon uses the Apples crop artwork from `CROPS/APPLES.CRP`, so no new artwork is drawn:
- **16×16:** the Edit plant icon at file offset 0x1480 (uploaded to tile `cropPlantTile`).
- **32×32:** the crop badge, four tiles at 0x1200..0x13ff arranged as part = row × 2 + column (uploaded to `cropBadgeTile`; same order as `field-status.ts`).

`readCropIcons` in `src/formats/crop-graphics.ts` decodes both with the gameplay palette and no transparency. The importer writes them to the ignored `public/assets/favicon-16.png` and `favicon-32.png`, and `index.html` links both sizes. A unit test checks the icons pixel-for-pixel against the same tiles patched into the 24-crop atlas.
