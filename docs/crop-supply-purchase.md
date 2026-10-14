# Manual seed and chemical purchases

SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Offsets below are executable file offsets. `src/simulation/crop-supply-purchase.ts` implements the transaction, now exposed through canonical GameSimulation commands and a React shop. Existing automatic consumption/purchasing remains unchanged.

## Source path and product scope

The one-cell map shop loop0x24196 computes map coordinates, optionally clears the clicked cell at0x24224, rejects town overlay4000 at0x24274 and masked terrain0800 at0x24295, then requires owned overlay0800 at0x24ad5. It calls generic purchase0x1cb42 at0x24af6. The terrain-occupancy exception for graphic87 in this loop belongs to ditch construction (tile87), not seed definition graphic87; seed map images are832..847.

The native product list covers the sixteen decoded seed definitions192..207 and four chemicals220..223. Although some generic branches span192..215, only sixteen seed definitions/crops are decoded from the supplied game; unsupported IDs remain rejected rather than synthesized.

Price lookup0x1d2fe..0x1d338 reads each definition's price word. Generic purchase0x1cb59..0x1cb67 sign-extends it and calls unsigned cash debit0x1c88e. Exact cash is allowed for these one-cell purchases, including the zero-price comparison path. Seed expenses post at0x1c98c to DS3e78; chemical expenses at0x1c9a8 to DS3ea0, with unsigned32-bit wrap. There is no book-value increment for either category. This is separate from automatic seed consumption's price+20 and automatic chemical consumption's fixed275.

Generic placement finds a building at0x1cd43, excludes types70/71/72 at0x1cd55..0x1cd7a and sends chemicals/seeds to insertion0x1a596 via0x1cde3. Ground placement explicitly rejects both type ranges at0x1cf28..0x1cf54 with message69. Thus purchasing requires storage even though later manual relocation permits placing these goods outdoors. Seeds use the insertion branch that bypasses the64/65 gate; purchase's outer filter limits them to64..69. Chemicals require the66..69 fallback. A click inside an open building on a masked occupant is rejected before first-fit search; a seed image has no such0800 mask and can still permit insertion elsewhere. Source first-fit chooses the destination, not the exact clicked interior cell.

## Record initialization and delivery

Seed allocation0x3a43a..0x3a464 calls inventory constructor0x15234 with quantity10 and value0, then adds one to the seed definition count. The constructor sets type word0, quantity word2, value word4, age word6, x/y bytes8/9 and flags byte10=32; byte11 survives reuse. Despite stored quantity10, the existing original seed-consumption routine consumes the entire item per planting application; no ten-use interpretation is invented.

Chemical allocation0x3a4da..0x3a500 calls0x14590 then increments its definition count. The constructor sets type word0, flags word2=32, byte4=0, x/y bytes5/6, words8/14/16=0 and word18=24. Byte7 and bytes10..13 survive reuse. Generic chemical insertion0x1a82a..0x1a867 updates position and adds stored flag4. The meaning of unnamed reset/preserved fields is not inferred from these writes.

Both categories use first-fit0x1abae and byte-sized building references. Tile table at file0x4ec60+DS085e gives seed graphics832..847 and chemical graphics915..912. Insertion writes content type/slot/image and refreshes the building twice, retaining its open/closed state. A closed building still acquires the chemical secondary-layer image during this refresh, then redraws its roof. This is existing source-based renderer behavior, not a reason to suppress the refresh.

## Native safeguards and verification

The transaction preflights type, coordinates, ownership, clicked-cell occupancy, building eligibility/graphic, free record, byte-sized storage reference, space, account bounds and full cost before mutation. SF-021 rejects inventory slots above255 for storage. SF-083/095 prevent clearing, debit/refund drift or allocated records on failure. SF-134 records the chemical allocator's missing explicit zero result on exhaustion; native bounded allocation returns a failure. Seed allocation scans1..511; chemical allocation scans1..126. Rejected actions preserve all records, source bytes, terrain and ledgers. Successful operations retain the original signed-price and wrapping count/expense semantics.

Six tests pin source instructions/tables, buy every supported type across all eight farms, compare every initialized/retained record byte, verify first-fit positions and whole-map refresh, cover building types64..72, capacity, slot256, full tables, ownership/coordinates, malformed definitions and price boundaries, and move/consume purchased stock with automatic buying disabled. Initial test failures were incorrect expectations: chemical secondary graphics survive closed-roof refresh, and windmill masked occupancy rejects before the later storage filter. Corrected those expectations without changing implementation.

Canonical commands/snapshots and React controls are now connected, with compatible storage, prices, actual purchases/consumption and checkpoint/browser verification described below. Native v14 already stores all affected records/definitions/building contents/ledgers; no new save field is currently required. The original purchase/error VOC calls are traced below; exact source shop/modal presentation and driver arbitration remain fidelity gaps.


## Live shop and continuation

Canonical `buy-crop-supply` commands execute the original transaction and publish detached transient feedback. Town/default/flight guards apply before any purchase or sound request. Native v14 already retains inventory/chemical bytes, counts, building contents, map and expenses; no schema change is needed. UI product/target selection is React state and resets with the farm. Loading does not buy, consume RNG or replay a purchase sound.

**Farm controls → Seeds & chemicals** focuses the shop; **Map tool → Buy seeds & chemicals** offers the same controls. Products show the current definition price and actual active stock count. The delivery list reports compatible stores and free cells within their real dimensions. Selecting a building chooses an unmasked clicked cell when possible, while the original first-fit routine still decides delivery. Map selection, **Choose on map / Review supplies**, building opening/closing and **Build storage** remain available. These are native usability choices rather than reconstructed DOS window geometry.

Generic success0x1cc92..0x1cc96 requests DS3ece `plopitem.voc`; the single-cell caller0x24b1e..0x24b28 then requests DS59b6 `ploptool.voc`. Generic failure names DS3ec5/3edb/3ee4 `uhoh.voc`, and the caller's unsuccessful branch uses DS59ad for the same resource. Native originally emitted both success requests; overlapping effects made both audible. User correction2026-10-13: successful seed/crop and chemical purchases now emit only `plopitem`, matching livestock, Trees, Trough and Feed placement. Failures still emit one `uhoh`. This is explicit native audio policy, not proof of an original-game defect or DOS driver arbitration. Original callers, strings and resource hashes remain preservation evidence; MIDI background playback stays separate.

All three VOC clips have time constant166 (sample rate1000000/90), original unsigned PCM starting at byte32 and one final terminator:

| Resource | MEGADATA.EEA offset | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| plopitem.voc | 2180124 | 7055 | `55090423cb78e8e6a6364e4ecf735c3127fbfd3937b4e4a988d3f18d2ae9adf1` |
| ploptool.voc | 2187179 | 1422 | `9e499755c7dc872b77cad5ec085fbca2d35d4d3c4d1d95132e3222844f3caebe` |
| uhoh.voc | 2200183 | 2326 | `790158721270b66bf8069f2c4660b891eee75f1ed6e85aa621b40301607c55d8` |

Three live tests buy all products and verify every checkpoint, detached state, unchanged RNG,35-day paired continuation, actual planting/all four treatment consumption without automatic buying, atomic rejection and modal guards. PCM tests verify every sample and the executable resource strings. Two browser flows exercise the shortcut/focus, build/delivery/map routes, capacity/compatibility/cash feedback, downloaded checkpoint equality, audible success, exact original seed/chemical pixels, reload without sound replay, real planting/fertilizer use and390px layout. Pixel comparisons move the selection highlight away first so they compare the underlying source graphic. Full original shop presentation, sound lifetime and the remaining preservation gaps are not claimed complete.
