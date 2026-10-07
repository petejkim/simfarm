# Original town construction

Evidence uses `SIMFARM.EXE` SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. File addresses below come from static disassembly. Funding and expansion-site reservation are documented in [finances.md](finances.md). These native primitives are not yet connected to the live clock or browser choice dialog.

## Layout asset and saved construction state

Loader `0x4a366..0x4a397` opens DS `ba70` (`townly0.cmp`) and reads 960 two-byte elements into `6190:952c`. The original archive member is 1,920 bytes, SHA-256 `6f8f3cac0d93bda8aa7d0be96fd4a07f6dace1241ffbc3f13a756ebfecec5be7`. It holds a 40×24 row-major word grid: fifteen 8×8 district templates, five across and three down. Constructor `0x3ad5c` addresses `base + 2*(y*40+x+offset)`, where offset is `type*8` for 0–4, `(type+35)*8` for 5–9, and `(type+70)*8` for 10–14. `TownLayouts` checks the exact asset size and positions, copies source bytes and retains every word, including unknown values. Existing import already extracts this member into ignored `public/assets/raw`; no generated original assets are committed.

`readTownConstructionState` decodes the independently established SSM members. Loader `0x45b88..0x45be3` reads eight interleaved X/Y byte pairs at `0x21663..0x21672` into `2d9f:f7aa/f7b2`, then recreation count at `0x21673` into `6190:9cbc`. It retains all unused coordinate bytes. Airport byte `0x21712` loads to `6190:64c6` at `0x46106`. These detached values are not yet integrated into native checkpoint state; the original retained SSM template still preserves them.

## Constructor `0x3aba0..0x3ae18`

The native constructor accepts bounded region coordinates and district types 0–14. Source type 0 sets the town origin. Type 5 increments the airport byte with wrapping. Type 4 requires more town-owned regions than `recreationCount*16`, and count below seven. Its accepted coordinate is saved as tile coordinates `(regionX*8, regionY*8)`, then count increments. The original uses signed count/index operations; native validation prevents malformed negative indexing (SF-047).

The 8×8 loop visits X first, then Y. Existing terrain tile IDs **71, 72, 111, 112** skip template painting and retain their complete terrain words. Other cells clear terrain flags `0x3000`. Airport type 5 writes the template word directly, retaining remaining terrain upper bits; it does not call the road connector. Other types connect template values 161–172 through the town-road specialization, or replace the whole terrain word with grass `15 + (attribute & 15)`. This uses the attribute's low nibble, not the global moisture value. Every cell, including skipped cells, ORs overlay flag `0x4000`; attributes and other overlay bits remain intact.

After painting, region ownership becomes 2 and channel 0 stores the district type. Types 0 and 5 also set level nibble `0xa0`; all other types begin at level zero. Most templates' buildings therefore do **not** appear during this constructor. Their later growth/decline routine (`0x3b3ac` and callers) must be reconstructed rather than stamping fully developed template buildings immediately.

## Road connections

Town constructor passes table `6190:5696` to connector `21c2:1578` / `0x25398`. Entries are category 4/count 11 (tiles 150–160), category 128/flags `0x22` (bridge tiles 172–173, connect but retain their image), category 5/count 11 (tiles 161–171), then -1. Category base words reside in segment `2be7`, not initialized DS `6190`. Shape offsets at `6190:59c4` are `[0,0,1,2,0,0,3,4,1,5,1,6,7,8,9,10]` for N/E/S/W mask bits 1/2/4/8.

`connectTownRoad` captures neighboring categories, paints the center with base 161 and its mask shape, then reshapes N/E/S/W using each neighbor's original road base. Bridge images are untouched. All upper terrain bits remain; bounds follow the source neighbor guards. This is a town-road specialization, not a claim to support all unrelated original terrain-connection tables.

## Choice resolution

Original `twnchoic.bmp` visibly labels Residential, Commercial, Airport and Recreational. The source chooser maps them to `(nextSimulation() & 7)+6`, `min(3,(nextSimulation() & 3)+1)`, 5 and 4 respectively (`0x3c152`, `0x3c1c6`, `0x3c24a`, `0x3c2bc`). Timeout uses the separate bounded RNG: `below(14)+1` at `0x3c385`. The original waits at most `0xdc0` timer ticks before that fallback; no browser wall-clock interpretation is implemented yet.

`resolveTownChoice` requires a reserved town-owned site, advances the correct RNG stream and invokes construction. Failed recreation remains an explicit failure so the caller can keep the pending choice. The original timeout ignores the constructor's failure and closes anyway (SF-048); native resolution exposes the failure rather than claiming a completed district. Invalid type/coordinate/state inputs cannot write outside native arrays. Source type >=15 can use an uninitialized pattern offset (SF-049); no such type is offered by the traced chooser.

## Validation and remaining work

Six tests cover exact EXE constants/loader calls and archive hash, every layout word, binary boundaries, all-eight-farm counters, detached unknown bytes, all sixteen road masks/mixed road bases/bridges/map edges, all 120 farm/layout combinations, skipped terrain, metadata and record preservation, recreation limits, counter wrapping, RNG streams and timeout rejection. Generated `artifacts/town-construction.png` shows the fifteen initial layouts using the imported tile atlas, with `artifacts/render-town-construction.ts` reproducing that inspection. It confirms initial construction output, not a completed town renderer or later building growth.

Next reconstruct district growth/decline, preserve pending choice and new town/finance state in native saves, and expose the chooser through React as part of annual collection integration. Full forced-sale/default behavior also remains required; see finances documentation. No farm cash debit or live annual event is advertised by this standalone constructor increment.
