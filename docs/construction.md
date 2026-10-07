# Player construction reconstruction

Evidence is static analysis of supplied `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets. No original executable is run.

Existing building records/definitions, storage reservation/delivery, demolition and terrain restoration are implemented. The purchase/placement primitive is now reconstructed for storage types 64–69; live commands and browser controls are the next integration increment. The immediate goal is to let the player build original usable storage through verified placement and accounting, without bypassing occupied land, construction costs or record capacity.

## Confirmed allocator and accounting entry

Generic addition `0x3a2ca` takes a type, quantity and coordinates. Its building branch `0x3a32a..0x3a377` accepts types 64–127, invokes resident `17d4:0168` / `0x1a0a8`, and on a nonzero return increments the selected definition count. It multiplies unit-price helper `1a66:0a20` by quantity with low-word retention, then adds that value to building book account `6190:3e54`. Only nine building definitions (64–72) are currently verified in the supplied files; the wider dispatch range is not permission to index beyond them. Cash debit and map painting are not performed by this branch and still require caller tracing.

Allocator `0x1a0a8..0x1a17d` scans byte slots 1–126 for a record lacking active flag 0x20, at 70-byte stride. It writes type +0, clears flags +2, writes tile coordinates +4/+5, clears byte +6 and word +8, initializes all twelve storage cells to graphic 217/type -1/slot 0, then sets active and increments global count `6190:2430`. Byte +7 and other unwritten bytes must be retained. Its full-table return is unsafe (SF-081); native placement must preflight capacity before payment/counts/terrain changes.

Next trace the caller's placement validator, affordability/debit, painting and storage initialization order. Reuse canonical building book value and definitions, preserving the existing cold-import uncertainty (SF-065). Add the command/UI only when those pieces compose into a complete atomic placement. Tests should cover original definitions, all retained bytes, map edges, occupancy/ownership, full capacity, affordability, rendering and a harvest delivered into newly built storage. Livestock follows construction rather than further report-detail work.

Adjacent rectangle query `0x1a17e..0x1a243` compares requested cells with building coordinate/dimension rectangles but uses a dense count-limited prefix without checking active flags (SF-082). Trace its callers and any compaction assumptions; native placement tests must explicitly include inactive holes, high active slots and retained inactive coordinates.

## Purchase, clearing and painting

Manager `24e6:10b4` routes to generic add `0x3a2ca`. Its player purchase caller is resident `1a66:02e2` / `0x1cb42..0x1cce9`: obtain price through `0x1d280`, sign-extend the word to an unsigned dword request, debit through `0x1c88e`, optionally clear each footprint cell, add the record, then validate/paint via `0x1ccea`. Building-category debit posts expenses to `6190:3e90` (`0x1c93b`); generic add posts the low word of price×quantity to book value `3e54`. Native `annual.ds3e90` retains its checkpoint key but now has a verified building-expense posting. Existing cold-import book-value uncertainty remains SF-065.

The multi-cell ghost UI checks both viewport corners, then requires **cash strictly greater than price** (`0x22445..0x22464`) before calling purchase at `0x224a4`. The single-cell click path tests both dimensions against 1 and calls purchase at `0x24af6`; debit permits equality. Native placement preserves this distinction (SF-084) while replacing viewport restrictions with bounded world coordinates.

Terrain validation `0x1ce04..0x1cf0a` walks rows, with X changing fastest, rejects terrain bit 0x0800, and accepts low-11-bit tiles 15–30, 150–160 or 161–171. Initialized `2be7` table file base `0x4ec60`: words `085e=15`, `0866=150`, `0868=161`; range counts `099e=16`, `09a2=11`, `09a3=11`. Ownership `0x1cf17` tests only the origin's second-word bit 0x0800 (type70 exception); native storage retains this original behavior, including extension over an unowned neighboring cell (SF-085).

Automatic clearing `0x26faa..0x27043` rejects masked terrain, requires at least $25 cash **after the building debit**, and only invokes bulldoze for tiles 535–538 or 131–146. It does not use the field constructor's broader category list. Bulldoze debits category500/$25 only for 535–538 (`0x26aaa..0x26ab6`); 131–146 still require the $25 check but are cleared without a debit. Restoration `0x26aed..0x26b2b` writes `(terrain & 0xf800) | (15 + signedSoilMoisture + (attribute >> 2))`. Those two tree families do not enter the later neighboring-road/fence repair branches. The resulting ground must pass placement validation. The source attempts clearing before that validation; native planning computes exactly the successful charges/terrain eligibility without leaving partial changes on failure (SF-083).

Painting `0x1cf62..0x1d0e5` increments the image counter in row-major order and retains upper terrain flags. Definition graphic indices 6,7,8,9,10,11 select bases 440,441,445,451,460,469 from `2be7:085e+index*2`. Second words and attributes remain unchanged. The source also supports masked placement from base848 (`0x1cfd4`), outside these six storage buildings. No invented terrain/graphics substitute is used.

## Implemented transaction and remaining dependencies

`building-placement.ts` preflights bounds, source eligibility and affordability, bounded active building overlap, and a free slot1–126 before any write. Successful construction initializes exactly the allocator's members, increments the definition count, posts purchase/clearing/book accounts, and paints the roof. Storage reservations, truck delivery and equipment parking use the same records as imported buildings. Six primitive tests cover all eight farms, all six footprints/retained bytes, source instructions/tables, sparse/full records, rejection atomicity, money/terrain endpoints, ordered clearing and reserve/deliver/sell capacity.

Types70/71 call `148c:0f1a` / `0x179da` after allocation, with `(x,y,64)` or `(x,y,48)` at `0x1cc05..0x1cc18`. This helper appends three bytes to `ES:f954`, bounded by count `6190:240f` <64; rollback calls the pop routine `0x17a22`. Its consumer/lifecycle still needs reconstruction. Type72 and animal-water behavior belong to the next livestock dependency work. None of these three types is offered by this storage increment. Original building purchase-window names and success/error sound triggers remain unconnected; React will use descriptive native storage labels until their original text is recovered.


## Live storage controls and persistence

`GameSimulation` now accepts `build` commands using canonical scenario and financial state. React's **Map tool → Build storage** exposes the six storage buildings, original price/dimensions, placement preview, shared automatic clearing and outcome messages. Labels describe storage purpose/dimensions rather than claiming original purchase-window text. Pending town/default decisions freeze construction with other gameplay commands.

Native checkpoint v8 already preserves every affected record, definition, map cell and ledger; no version change is necessary. Feedback is transient and is not replayed after load. Three live tests cover all eight farms, detached snapshots, report expense updates, exact save/load/clock continuation, frozen decisions and an actual new-field plant/fertilize/grow/harvest delivery into purchased storage followed by reload and sale. Two browser checks cover the new controls, full original roof pixels, ordered clearing/cost feedback, downloaded state and narrow layout; their committed-source result is recorded in progress.


## Next dependency: original irrigation source registry and flow queue

Further static tracing identifies the three-byte source registry at `2d9f:f954`, count `6190:240f`, separate from a 128-entry flow ring at `2d9f:f7d4` (read/write bytes `6190:240c/240e`). Initialized segment words `6190:c818/c81e` both equal `2d9f`. Addition `0x179da` and removal `0x17944` operate on three-byte `(x,y,strength)` entries. Purchase type70 adds strength64; type71 adds strength48. These are persistent irrigation sources, not a one-shot visual queue.

Irrigation driver `0x17310..0x174c2` uses elapsed animation ticks, alternates phase `6190:2425`, scans source coordinates and seeds flow. Its type70 probe `0x174c4..0x1755e` checks a clamped 3×3 neighborhood for first-word bit0x2000. Strength48 has a separate signed wind threshold at `0x173ef..0x173fc` (current wind `6190:4368` >=9 or alternate phase). In a drying pass, tiles98–108 become87–97 by subtracting11. Flow entry `0x17a78` first updates a world tile through `0x17560`, then appends the coordinate/strength; consumer `0x17b3e` branches by outgoing-neighbor count, divides strength at junctions and steps single paths. Exact neighbor marking, phase timing, trough/livestock interactions and live scheduler integration still need tracing. These observations are dependencies, not implemented irrigation.

The source registry's SSM count is at `0x210d2` and the next192 bytes at `0x210d3..0x21192` are **not packed three-byte runtime records**. Saver `0x449c6..0x44a27` and loader `0x459d4..0x45a35` transfer three separate bytes at runtime offsets `2*i+0/1/2`, for64 iterations. The overlap is deliberate in both compiled loops, whether or not intentional in source; copying SSM triples as runtime triples is incorrect. Applying the loader writes in order gives source counts `[4,9,4,1,4,4,2,3]` for SCEN0–7. SCEN4 then yields `(35,54,64),(35,42,64),(31,42,64),(32,53,64)`, whereas naive triples produce spurious coordinates/strengths. Only runtime bytes0–128 are transferred; SF-087 records the loss above43 sources. Unknown trailing runtime state needs an explicit cold/warm policy before adding a canonical native state field.

Retained defect evidence: SF-086 (flow merge adds one packet twice after saturation), SF-087 (source save stride), SF-088 (full flow ring aliases empty), SF-089 (registry removal reads a successor beyond the full table). These require tests and explicit native decisions when implementing irrigation; no fixes or reachability proof are claimed yet.


## Irrigation buildings enabled

Types70/71 now use the reconstructed live irrigation registry and flow driver; see [irrigation.md](irrigation.md). The Build menu exposes their original prices and normal/masked footprints, and native v9 preserves sources and in-progress waves. Capacity failure is atomic (SF-092). Type72 and animal-water behavior remain pending with livestock. Earlier sections record the dependency discovery; types70/71 are no longer blocked on that investigation.
