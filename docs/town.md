# Original town construction

Evidence uses `SIMFARM.EXE` SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. File addresses below come from static disassembly. Funding and expansion-site reservation are documented in [finances.md](finances.md). These native primitives are not yet connected to the live clock or browser choice dialog.

## Layout asset and saved construction state

Loader `0x4a366..0x4a397` opens DS `ba70` (`townly0.cmp`) and reads 960 two-byte elements into `6190:952c`. The original archive member is 1,920 bytes, SHA-256 `6f8f3cac0d93bda8aa7d0be96fd4a07f6dace1241ffbc3f13a756ebfecec5be7`. It holds a 40×24 row-major word grid: fifteen 8×8 district templates, five across and three down. Constructor `0x3ad5c` addresses `base + 2*(y*40+x+offset)`, where offset is `type*8` for 0–4, `(type+35)*8` for 5–9, and `(type+70)*8` for 10–14. `TownLayouts` checks the exact asset size and positions, copies source bytes and retains every word, including unknown values. Existing import already extracts this member into ignored `public/assets/raw`; no generated original assets are committed.

`readTownConstructionState` decodes the independently established SSM members. Loader `0x45b88..0x45be3` reads eight interleaved X/Y byte pairs at `0x21663..0x21672` into `2d9f:f7aa/f7b2`, then recreation count at `0x21673` into `6190:9cbc`. It retains all unused coordinate bytes. Airport byte `0x21712` loads to `6190:64c6` at `0x46106`. These detached values are not yet integrated into native checkpoint state; the original retained SSM template still preserves them.

## Constructor `0x3aba0..0x3ae18`

The native constructor accepts bounded region coordinates and district types 0–14. Source type 0 sets the town origin. Type 5 increments the airport byte with wrapping. Type 4 requires more town-owned regions than `recreationCount*16`, and count below seven. Its accepted coordinate is saved as tile coordinates `(regionX*8, regionY*8)`, then count increments. The original uses signed count/index operations; native validation prevents malformed negative indexing (SF-047).

The 8×8 loop visits X first, then Y. Existing terrain tile IDs **71, 72, 111, 112** skip template painting and retain their complete terrain words. Other cells clear terrain flags `0x3000`. Airport type 5 writes the template word directly, retaining remaining terrain upper bits; it does not call the road connector. Other types connect template values 161–172 through the town-road specialization, or replace the whole terrain word with grass `15 + (attribute & 15)`. This uses the attribute's low nibble, not the global moisture value. Every cell, including skipped cells, ORs overlay flag `0x4000`; attributes and other overlay bits remain intact.

After painting, region ownership becomes 2 and channel 0 stores the district type. Types 0 and 5 also set level nibble `0xa0`; all other types begin at level zero. Most templates' buildings therefore do **not** appear during this constructor. The separately reconstructed growth/decline routine (`0x3b3ac` and callers), documented below, paints their later stages.

## Road connections

Town constructor passes table `6190:5696` to connector `21c2:1578` / `0x25398`. Entries are category 4/count 11 (tiles 150–160), category 128/flags `0x22` (bridge tiles 172–173, connect but retain their image), category 5/count 11 (tiles 161–171), then -1. Category base words reside in segment `2be7`, not initialized DS `6190`. Shape offsets at `6190:59c4` are `[0,0,1,2,0,0,3,4,1,5,1,6,7,8,9,10]` for N/E/S/W mask bits 1/2/4/8.

`connectTownRoad` captures neighboring categories, paints the center with its requested base (161 by default for construction, 150 for paving) and mask shape, then reshapes N/E/S/W using each neighbor's original road base. Bridge images are untouched. All upper terrain bits remain; bounds follow the source neighbor guards. This is a town-road specialization, not a claim to support all unrelated original terrain-connection tables.

## Choice resolution

Original `twnchoic.bmp` visibly labels Residential, Commercial, Airport and Recreational. The source chooser maps them to `(nextSimulation() & 7)+6`, `min(3,(nextSimulation() & 3)+1)`, 5 and 4 respectively (`0x3c152`, `0x3c1c6`, `0x3c24a`, `0x3c2bc`). Timeout uses the separate bounded RNG: `below(14)+1` at `0x3c385`. The original waits at most `0xdc0` timer ticks before that fallback; no browser wall-clock interpretation is implemented yet.

`resolveTownChoice` requires a reserved town-owned site, advances the correct RNG stream and invokes construction. Failed recreation remains an explicit failure so the caller can keep the pending choice. The original timeout ignores the constructor's failure and closes anyway (SF-048); native resolution exposes the failure rather than claiming a completed district. Invalid type/coordinate/state inputs cannot write outside native arrays. Source type >=15 can use an uninitialized pattern offset (SF-049); no such type is offered by the traced chooser.

## Validation and remaining work

Six tests cover exact EXE constants/loader calls and archive hash, every layout word, binary boundaries, all-eight-farm counters, detached unknown bytes, all sixteen road masks/mixed road bases/bridges/map edges, all 120 farm/layout combinations, skipped terrain, metadata and record preservation, recreation limits, counter wrapping, RNG streams and timeout rejection. Generated `artifacts/town-construction.png` shows the fifteen initial layouts using the imported tile atlas, with `artifacts/render-town-construction.ts` reproducing that inspection. It confirms initial construction output, not a completed town renderer or later building growth.

Next preserve pending choice and new town/finance state in native saves, and expose the chooser through React as part of annual collection integration. Full forced-sale/default behavior also remains required; see finances documentation. No live annual event is advertised by these standalone primitives.

## Growth, repainting and decline — implemented primitives

`town-development.ts` reconstructs `0x3b162..0x3bf79`; GameSimulation now invokes it at the recovered weekly position. Runtime input explicitly supplies the current town site (`4d9f:fedb/fedc`, SSM `0x2170f/0x21710`), revenue (`6190:758a`) and wrapping development-spending word (`6190:7514`), alongside construction counters. These values belong to canonical financial state and persist in native checkpoints. The source call at `0xcbb3` uses manager `24e6:0ff6`, thunk file `0x28056`, overlay 15:05c2. This is in the **weekly** branch of calendar routine `0xc88e`: non-seventh days branch from `0xc900` to `0xd0b5`, bypassing it. The call precedes monthly rollover and annual collection, so new annual receipts first affect a subsequent weekly development call.

`developTown` first requires ownership 2 at the current site. Signed revenue >=25 requests one growth step; a successful return subtracts 25 and adds 25 to spending modulo 65536. Negative revenue requests one decline step; a successful return adds 25 and clamps a positive result to zero. Revenue 0–24 does nothing. The return value is not simply “the map changed”: demolition returns false, while raw district byte 5 returns true without any painting or level change.

`changeTownLevel` ports `0x3b3ac`. The initialized maximum-level table `6190:9cac` has sixteen bytes of 13. Growth at or above that level fails. Decline at level zero calls demolition and returns false regardless of demolition result. Other accepted changes update the high nibble and repaint. Direction zero only repaints. The source airport guard compares the entire regional byte to 5, not the low type nibble (SF-050); this behavior remains explicit and tested. Invalid native coordinates/type 15 are rejected before mutation (SF-049).

### Repaint stages

Dispatch tables at file `0x3be08` (sixteen type targets) and `0x3bdde` (fourteen level targets) define these branches. Every loop is X outer/Y inner; template lookup remains `y*40+x`, while map storage is column-major. No repaint branch changes overlays or attributes. Road connection may reshape immediately adjacent road tiles outside the district.

| Type / level | Source action |
| --- | --- |
| Type 0, any level | Write all template non-roads and connect dirt roads, then run a second complete road pass with paved base 150. No skipped-terrain guard. |
| Types 4 and 5, any level | Preserve current tile IDs 71, 72, 111, 112; write template non-roads and connect paved roads elsewhere. |
| Other types, level 0 | Replace every cell with whole-word `15+(attribute&15)`, including roads. |
| Other types, levels 1–7 | At even template IDs 252–280, consume one **visual** RNG value (`5fd:007d` / `0x824d`), set `v=2*((value&3)+(level>>1))`, and write `(252+v,253+v,292+v,293+v)` at `(x,y),(x+1,y),(x,y+1),(x+1,y+1)`. Skip other template words in 252–280 or 292–320; connect dirt roads; write remaining template words. |
| Other types, level 8 | Write all non-road template words and reconnect dirt roads. |
| Other types, level 9 | Pave template roads with x<4 and y<4. |
| Other types, level 10 | Pave template roads with y<4. |
| Other types, level 11 | First pave y<4, then x<4/y>=4. |
| Other types, level 12 | Pave all template roads. |
| Other types, levels 13–15 | No painting. |

All road template tests include 161 through **172**. Each connection clears terrain `0x3000` before calling the shared connector, whose new base parameter defaults to dirt for construction. Non-road template writes replace the entire terrain word. The original asset's building anchors all fit inside an 8×8 district; malformed templates that would extend a four-cell building outside it are rejected before writes/RNG consumption (SF-053). Template type 3 contains anchor 280 with companions 281/246/247; those companions are subsequently overwritten because they lie outside the skip ranges (SF-054). The native port retains that verified quirk.

### Demolition and retargeting

`demolishTownDistrict` ports `0x3be2c`. The exact saved town-origin pair cannot be demolished. Raw regional byte 4 decrements the recreation count modulo 256; there is no coordinate compaction or airport decrement (SF-051). Ownership becomes zero, but the old district byte and other regional channels remain. All plot cells clear overlay bits `0x4800`; terrain tile IDs 39–68 remain, and other terrain becomes `(terrain&0xf800) | (15+signedMoisture+(attribute>>2))`, truncated to a word. This differs deliberately from level-zero repainting.

The retarget search `0x3c4f8` scans radii 1–6 around the prior active site, with lower edges included and upper edges excluded, X before Y. It selects ownership 2 only when **both** X differs from town-origin X and Y differs from origin Y, otherwise falls back to the origin. Native bounds reject coordinate 12; the original erroneously permits it (SF-052). The asymmetric scan and entire-origin-axis exclusion are retained pending broader behavior analysis.

Six additional tests cover the exact dispatch tables/constants/caller, every type and level nibble, all ordinary early-stage RNG draws and four-cell orientation, painting/flags, source-record preservation, revenue thresholds/signed bits/wrapping, demolition/retargeting, airport quirks, malformed-input atomicity and all-eight-farm map corners. A generated stage sheet (`artifacts/town-development.png`) renders levels 0–13 for each district type through the imported atlas; its script and output remain ignored. The weekly clock and native checkpoint fields are now connected. Annual finance integration and the live expansion chooser remain required; terminal financial default handling is already live.


## Live weekly development and asset dependency

Browser startup fetches the unchanged imported `raw/townly0.cmp` (SHA-256 `6f8f3cac0d93bda8aa7d0be96fd4a07f6dace1241ffbc3f13a756ebfecec5be7`). GameSimulation owns a detached copy and calls development after weekly water/status updates, immediately before field dispatch at `0xcbbd`. Native v5 checkpoints retain the layout bytes and reject a different installed asset. Older versions adopt the current asset once; no construction/repaint occurs during loading.

Integration tests cover non-weekly inactivity, successful growth and spending wrap, maximum level, signed decline, loan receipts becoming available only after the current week's call, and exact multiweek checkpoint continuation. Browser checks exercise live repainting, reload/continuation and startup failure for missing/truncated layouts. Annual expansion still needs a saved choice/continuation phase; the weekly hook alone does not claim that full town lifecycle.
