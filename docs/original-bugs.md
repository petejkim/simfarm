# Original SimFarm defects and hazards

Track defects and suspicious behavior in the supplied DOS executable separately from reconstruction progress. Addresses are file offsets in the executable pinned by `tools/analyze.py`. Static evidence establishes the arithmetic and branches below; end-to-end impact has not been observed by running the DOS game. No security vulnerability is established by these findings.

Keep entries after fixing a defect. Record the original behavior, native behavior, evidence, verification and compatibility decision. Do not silently normalize source quirks while claiming faithful reconstruction.

## SF-001 — reversed regional-condition subtraction

**Status:** confirmed arithmetic defect; preserved in the native port pending a compatibility decision.

The regional decrement helpers compare the current byte with the amount and jump on **above** to a branch that writes zero. Otherwise they subtract the amount in an eight-bit register. Thus `20 - 8` becomes 0, while `5 - 8` becomes 253. The matching field-local decrement saturates at zero, so field and region can diverge substantially.

Evidence: branches at `0x1c5a5`, `0x1c63b`, `0x1c723`, `0x1c767`, `0x1c7fd`; regional offsets `2d56:01dd`, `:014d`, `:038d`, `:026d`, `:02fd`. Caller dispatch: `0x19846`–`0x19c61`. These helpers affect regional condition values used by field operations; exact downstream gameplay impact remains to be traced.

Native handling: `changeFieldCondition` deliberately reproduces the comparison and byte wrap. Regression cases cover both examples. A future correction would clamp subtraction at zero; make that an explicit enhancement/compatibility decision and retain tests for the original mode.

## SF-002 — unassigned season at week 22

**Status:** confirmed branch gap; gameplay defect severity unverified; preserved.

Season assignment uses week-of-year ranges 0–9 / 45–47, 10–21, 23–33, and 34–44. Week 22 matches none and keeps the previous season. This may be an off-by-one defect or intended delayed transition; the intended boundary is not established.

Evidence: `0xc94d`–`0xc9a9`, especially comparison with `0x17` at `0xc982`. Native handling: `advanceCalendarDay` retains the previous season and tests the boundary. No correction made.

## SF-003 — signed eight-bit field age wraps

**Status:** confirmed arithmetic hazard; reachable long-term effects require investigation; preserved.

Field age at record +34 increments as a byte (`0x1930f`) and is sign-extended for comparisons and graphic-stage arithmetic (`0x19306`–`0x1930c`, `0x194db`–`0x194ea`). The sequence crosses from 127 to a signed -128, and later 255 to 0. Long-lived fields could therefore re-enter the age-below-limit branch or produce negative stages if another routine does not reset their age first.

The routine computes a tile from that stage and ORs it into terrain flags without first restricting it to an 11-bit tile index (`0x19567`–`0x1957f`). Negative stages may select unrelated tiles or affect flags. **Reachability is not proven**: inspect perennial renewal, harvesting and age resets before calling this a demonstrated map-corruption bug.

Evidence for the tile operation: `0x19567`–`0x1957f`. Native handling: `growField` preserves byte wrapping, sign extension and 16-bit writes. No fix made; add a reachable long-running scenario case when the lifecycle is reconstructed.

## SF-004 — bounded RNG stores the pre-rejection state

**Status:** confirmed behavior with possible distribution/correlation consequences; not classified as a defect yet; preserved.

`0x8273`–`0x829f` stores the first LFSR step before repeatedly stepping a local copy to reduce it below a bound. Subsequent calls start from the stored first step, not the accepted result. For seed 51 and bound 5, several successive calls return 4 while their stored states differ. This differs from a conventional rejection sampler but may be deliberate.

Native handling: `FarmRandom.below` preserves it and tests stored state separately from returned values. No claim of exploitable predictability or security impact is made; this is a deterministic game RNG.

## SF-005 — water-stress penalty wraps to a byte

**Status:** confirmed truncation; intent and reachable harmful effects unverified; preserved.

Out-of-range water produces `(cropMultiplier * (random & 31) + 128) & 255`. The multiplication's high byte is discarded and adding 128 can wrap the low byte (`0x196ab`–`0x196af`). Larger multipliers can therefore produce smaller penalties. Establish which distributed crops and tolerance states reach those combinations before changing behavior.

Native handling: `waterStress` retains the byte wrap. No correction made.

## SF-006 — water warnings disagree with growth stress

**Status:** confirmed comparison discrepancy; preserved; broader effects of byte thresholds remain unverified.

The status routine uses `water > upper` (`0x190f6`–`0x19103`) to display a wet warning, while growth applies water stress at `water >= upper` (`0x195d0`–`0x196b7`). A grape field with water 28 and unmodified tolerances therefore incurs stress without a wet badge. The regression test demonstrates this using the distributed grape definition.

Status also computes tolerances with signed byte arithmetic (`0x19087`–`0x190c2`), whereas growth uses word arithmetic. Large modifiers can wrap the displayed thresholds differently; reachable effects need investigation. Native handling preserves both routines. No correction made.

## SF-007 — fifth year-end temperature reads the wind byte

**Status:** confirmed table-boundary defect in the recovered calendar path; preserved without native out-of-bounds access.

At `0xcbc6`–`0xcbfc`, temperature is read using `temperatureYear * 48 + month * 4 + week` after week increments to four, but before month and year roll over. For temperature-year index four, month eleven and week four, the index is 240. The 240-byte table starts at `6190:4278`; the next byte at `6190:4368` is current wind. The temperature therefore becomes wind speed until the next weekly temperature update. Other year ends read the following year's first temperature entry, which remains in bounds.

Native handling explicitly selects wind at index 240. A five-year calendar regression with distinct wind and temperature tables verifies this path. No correction made. This is a read into another known global, not evidence of an exploitable security vulnerability.

## SF-008 — unchecked precipitation count indexes outside forecast stack tables

**Status:** confirmed missing upper-bound check; malformed-data hazard; no exploit demonstrated.

The forecast routine reads a signed precipitation count from the climate table, clamps negative values to zero (`0x1e865`–`0x1e872`), then indexes a 56-byte stack table with `count * 7 + day` (`0x1e89d`–`0x1e8ae`, cold path `0x1e8d5`–`0x1e8e6`). It does not clamp counts above seven. Such a value can read beyond the initialized pattern table and produce unrelated weather codes. All eight distributed scenarios contain counts within zero through seven.

Native handling rejects imported climate counts above seven and validates the forecast lookup. The decoder regression includes a mutated scenario with count eight. The original hazard stays documented despite that native validation; additional memory consequences and exploitability are unproven.

## SF-009 — equipment route scoring bypasses terrain and has unchecked map edges

**Status:** confirmed routing behavior and missing coordinate checks; teleport appears to be a recovery mechanism, not a proven defect. Edge-read consequences during normal play remain unverified.

The score routine at `0xfe6e` returns zero before inspecting terrain whenever a candidate is within squared distance four of its destination (`0xfef7`–`0xfefd`). Otherwise it indexes terrain from signed byte coordinates without a map-edge check (`0xff04`–`0xff17`). Negative or oversized coordinates can alias another map column or read adjacent data. Destination clamping in `0xf9e4` does not validate the three intermediate candidates. Establish the original callers' edge reachability before claiming a demonstrated corruption or vulnerability.

If all three candidates score above 1882, `0xfcc3`–`0xfcea` directly copies the destination into the equipment position. Separately, `0x10202`–`0x102a1` forces arrival after 64 updates without reaching the destination and applies wear to types other than six. These are explicit recovery paths, not reasons to replace the algorithm with a modern shortest-path implementation. Terrain-category upper limits in scoring are inclusive (15–31, 150–172, 188–192), although other callers use exclusive limits.

Native handling: the route planner preserves scoring, near-target bypass, tie order and the all-blocked destination fallback. It treats out-of-map candidates as blocked before any terrain read or near-target test. Tests cover category boundaries, route history, destination bypass, fallback and map edges. The movement primitive now includes the 64-update recovery/wear branch; a regression demonstrates forced arrival even while a machine is making progress toward a distant destination. This is a fixed travel-update limit, not a counter that resets on every successful step. Arrival/storage dispatch is still separate. No security exploit is demonstrated.

The same boundary hazard applies to attachment coordinates and field-pass border positions. Attachment arithmetic writes byte coordinates (`0x110ab`, `0x1124a`), so an attachment west of X=0 becomes X=255. Drawing/erasing (`0x10300`, `0x1050c`), occupancy (`0x1070a`) and field painting (`0x108ce`) form unchecked world offsets. The native code retains coordinate-byte arithmetic but clips drawing/erasing, treats off-map footprints as obstructed, and skips off-map field paint. A field touching the left map edge completes its pass without an out-of-bounds native access. Normal UI placement restrictions have not yet been fully reconstructed, so original-game reachability remains uncertain.

## SF-010 — detach routine only clears the first two members of an equipment chain

**Status:** confirmed routine-level behavior; reachability of longer chains in ordinary gameplay unverified; fixed in native detachment.

`0x112a0`–`0x112f1` traverses attachments but reloads the successor from the original head (`[bp+6]` at `0x112ca`) instead of the current member (`[bp-4]`). After clearing the head's links on the first iteration, the second iteration sees a zero successor and stops. A chain with two or more attachments can retain a disconnected member's parent link. In contrast, positioning at `0x1113e` advances its current-member argument and walks the whole chain.

The original attachment primitive accepts equipment indices, but which user actions can construct a longer chain is not established. Native handling: positioning and detachment walk and validate the whole chain. Detachment clears both links on every member; a three-member regression verifies the correction. Saved out-of-range, inactive, self-referencing and cyclic attachment links are rejected by the decoder. This does not establish an exploitable vulnerability in the original.

Related limitation: drawn-flag helpers `0x119b6` and `0x119e4` update only the head and first attachment, while drawing and erasing walk the chain. The native refresh operation preserves this difference; consequences for longer chains remain deferred with the reachability investigation.

## SF-011 — storage removal trusts a saved equipment index without checking the record boundary

**Status:** confirmed missing validation in the recovered removal path; malformed-save hazard, not a demonstrated exploit.

Storage removal `0x1aeb0` reads a signed item type at building +34 and an eight-bit slot at +58, using the selected storage cell. For item types 0..63 it passes that slot directly to equipment footprint lookup `0x10d9c`. The latter indexes the 127-slot equipment table without checking the index or active flag. A corrupted storage slot such as 255 can therefore read unrelated data as an equipment record and then use its type as a definition index. Further consequences and original loader validation outside this path have not been established.

Native handling: equipment withdrawal resolves an existing decoded machine, requires the storage cell to identify that same slot, validates its footprint against the building, and fails before changing state on mismatch. Tests exercise all stored machines from all eight distributed farms; original bytes remain unchanged. The original generic removal path for non-equipment inventory has not yet been ported or audited.

## SF-012 — parking search has no failure bound and wraps its radius counters

**Status:** confirmed missing termination bound and byte-counter wrap; normal-game exhaustion and consequences remain unverified; guarded in the native port.

The parking routine initializes two byte counters to zero (`0x14ea2`–`0x14ea7`), increments them for successive search rings (`0x14f6a`, `0x14f77`), sign-extends them for coordinate arithmetic, and repeats until a candidate succeeds (`0x15112`–`0x15118`). There is no exhausted-map exit. Candidate testing temporarily writes byte coordinates into the equipment record (`0x151c4`–`0x151d7`) before the unchecked occupancy routine described in SF-009. A fully obstructed map can therefore cause repeated searching, wrapped radii and reads outside the logical world. Original memory layout may cause a spurious successful candidate; an actual infinite loop or exploit has not been demonstrated.

Native handling rejects off-map candidates and limits search to 96 rings, sufficient to cover the map from a valid machine origin. Exhaustion returns false and records a `parking-unavailable` notice instead of hanging the simulation. A fully obstructed-world regression verifies termination and unchanged coordinates. Revisit player-visible recovery when equipment management UI is added.

## SF-013 — planting completion writes the reserved equipment slot's timestamp

**Status:** confirmed bookkeeping discrepancy; harmful gameplay impact unproven; preserved.

On completion of planting's second pass, the routine clears field +42 (`0x18391`), changes the field to Growing, then reloads field +42 to select the equipment whose timestamp it updates (`0x183ec`–`0x1840b`). This writes equipment slot zero instead of the tractor. Slot zero is reserved and the equipment dispatcher starts at slot one, so no harmful consequence is currently established. The tractor's movement-order routine already sets its timestamp during the same completion path.

Native handling retains the slot-zero write explicitly. Revisit if later recovered code reads this reserved record; do not characterize this alone as a security vulnerability.

## SF-014 — scenario loader reads two accounting entries into the same global

**Status:** confirmed duplicate destination; accounting consequences require further reconstruction; fix deferred.

The loader reads SSM `0x216ac` into `6190:3e80` at `0x45da6`, then reads SSM `0x216b4` into the same global at `0x45dd6`. The second read overwrites the first. The expense dispatcher separately updates `6190:3e88` for item categories 500..503 (`0x1c9b6`–`0x1c9cf`), suggesting a possible incorrect destination in the load sequence, but the intended serialized accounting layout and matching saver still need verification. Do not silently remap the second value based only on that inference.

Native handling now implements both affected expense categories: worker fees accumulate from zero because `3e88` is not restored, and land expenses initialize from the final overwritten value at SSM `0x216b4`. A regression patches distinct values into both serialized entries and verifies this ordering. The erroneous load remains preserved; revisit with complete finances and the matching saver before correcting it. Native version-1 checkpoints now persist both live ledgers explicitly and bypass this DOS load path; original SSM import still preserves the observed overwrite. DOS-compatible save/load correction remains deferred until the saver is traced. No exploit is demonstrated.

## SF-015 — accumulated rental expenses wrap at 32 bits

**Status:** confirmed arithmetic limit; reachable gameplay impact unverified; preserved.

The cash debit checks affordability using unsigned 32-bit comparisons (`0x1c8d0`–`0x1c8f2`). Its rental-expense ledger branch then adds the payment using a 32-bit ADD/ADC pair with no overflow check (`0x1c9e6`–`0x1c9f8`). A total of `0xfffffff0` followed by a 100-unit rental becomes 84. Other expense branches use the same arithmetic. This does not itself permit overspending, and normal-play reachability depends on ledger resets, income and game duration, which remain to be reconstructed.

Native handling preserves unsigned ledger wrapping, with a boundary regression. No correction made. Revisit when the full accounting/year-end path is ported.

## SF-016 — seed consumption can erase a seed without removing its active inventory record

**Status:** confirmed inconsistent-state path; ordinary-play origin of that inconsistency unverified; native validation added.

Seed consumption `0x152d6` locates an active matching inventory item, removes its storage/world graphic, and calls the generic goods removal routine. The seed branch `0x3a1b2` checks the definition's count before removing the item; if the count is zero, it returns without clearing the active flag. The caller ignores that return value and reports success (`0x15360`–`0x15376`). A mismatched zero definition count and active seed can therefore leave an erased but reusable seed record. Further consequences for storage removal on repeated use remain unverified.

Native handling rejects a zero seed count or a mismatched storage cross-reference before any mutation. Regression cases verify unchanged map/inventory. The supplied SCEN6 seed counts agree with its 36 active seed records; this issue is distinct from its total inventory-count discrepancy below.

## SF-017 — supplied SCEN6 inventory count exceeds its active records

**Status:** confirmed source-data discrepancy and unchecked scan bound; original runtime consequences require verification; native scans are bounded.

The distributed `SCEN6.SSM` stores count 65 at `0x8281`, but its 512 records at `0x8283` contain only 64 active flags (record +10 bit 0x20); reserved slot zero is inactive. The loader copies the count and records directly (`0x45688`–`0x456d2`). Seed search `0x152d6` stops only after visiting the declared number of active records and has no independent 512-slot bound. A missing seed type can therefore advance beyond the table if no intervening initialization corrects the count. The saved bytes and scan structure are confirmed; DOS startup repair and observable memory consequences have not been established.

Native handling accepts this original farm, derives active items from bounded records and never uses the inconsistent count as a search limit. Tests decode all farms, consume all 36 original SCEN6 seed items and successfully fall back to purchasing after exhaustion. No security exploit is claimed.

## SF-018 — a failed scheduled planting attempt clears the existing crop

**Status:** confirmed failure-path side effects; fixed for native immediate planting commands.

The existing-field planting branch resets age/accumulators and releases any crop contract before trying to consume/buy seed (`0x2f7de`–`0x2f83d`). If seed acquisition fails, it calls the abandon/expiry routine `0x1c2a8` (`0x2f97a`–`0x2f989`), clearing the crop. Thus insufficient cash or unavailable seed can destroy the existing crop and contract even though no replacement is planted. The new-field click path constructs the field and clears its terrain at `0x23eae` before consuming seed at `0x23f85`; failure branches through `0x23f91` to `0x2416e` without undoing that construction.

Native handling obtains seed successfully before resetting field/contract state or constructing a new field. Regressions verify that insufficient funds or unavailable seed leave the existing scenario state, new-field terrain, inventory and free slots unchanged. Calendar-scheduled planting now uses the same native preflight correction while preserving the original stop-on-failed-seed scan order.

## SF-019 — negative effective crop age becomes fully mature in valuation

**Status:** confirmed arithmetic quirk; ordinary-play reachability unverified; preserved in native valuation.

Maturity routine `0x1c1aa` sign-extends field age +34 and the low byte of the heat-delay quotient. At `0x1c216`–`0x1c222`, it forms a word difference, pushes that word as the high half of a 32-bit numerator, and calls unsigned division. An effective age of -1 becomes `0xffff0000`; the returned maturity saturates to 65535 instead of zero. Both age and delay also wrap at signed-byte boundaries. A zero nominal lifetime or wrapped zero heat divisor can instead cause an original division exception on malformed/custom definitions. Supplied crop lifetimes/divisors are valid.

Native behavior preserves the signed/unsigned maturity arithmetic with boundary regressions and rejects invalid divisors explicitly. No gameplay correction is made; revisit reachability through long-lived perennials, cold conditions and field scheduling before deciding whether to correct the arithmetic. This is not a proven exploitable vulnerability.

## SF-020 — crop valuation loses the high word of quantity times price

**Status:** confirmed arithmetic truncation; preserved in native valuation; normal market/contract overflow reachability requires more reconstruction.

`0x1c4bd`–`0x1c4c3` multiplies two unsigned words, then zeroes DX, discarding the product's high half before the loss adjustment. A quantity of 1000 at unit price 100 becomes 34464 before adjustment and yields 34463 at zero loss. The later unsigned high-word comparison against 65535 (`0x1c4d9`) cannot detect that earlier loss. The caller `0x1c092` divides the quoted crop/contract price by ten first; original supplied crop base values do not by themselves demonstrate an overflowing trade.

Native behavior deliberately preserves low-word truncation, price division and the strict 51000 loss cutoff; regressions cover product overflow and both sides of that cutoff. No fix made. Revisit with recovered market fluctuations and contract pricing; do not classify this as a security vulnerability without a reachable adverse path.

## SF-021 — building inventory references truncate item slots above 255

**Status:** confirmed format/arithmetic mismatch; ordinary-game reachability beyond 255 items unverified; native stored delivery guarded.

Inventory constructor `0x15234` scans and can allocate slots 1–511. Building content stores its inventory reference in a byte; harvest storage completion `0x1b2fe`–`0x1b301` copies only AL from the word item slot into that byte. Slot 256 is thus stored as zero, and 257 aliases one, while the item's own record remains active. Generic storage `0x1a69d` uses the same byte write. Exact downstream consequences depend on the interaction/removal caller; no security exploit is established.

The native raw constructor retains the original full slot range, but harvested storage delivery rejects an unrepresentable first-free index before inventory, counts or building mutation. The forthcoming harvest caller can use its original sale fallback. Tests exercise slot 511 in the constructor, then slot 256 rejection at storage. Wider native storage references would need an explicit format migration; that enhancement is deferred.

## SF-022 — failed harvest inventory allocation leaves a storage cell reserved

**Status:** confirmed machinery-harvest failure path; fixed in native machinery and worker harvest delivery.

`0x1aff0` reserves a crop-storage cell by changing its type from -1 to -2 at `0x1b17d`. Truck delivery later creates an inventory record at `0x15fef`. If the 512-slot table is full, the constructor returns zero and `0x15ffc` branches to `0x16032`, which sells the harvest. The common return path clears the field's storage-building word at `0x16093`, but this path contains no release of the reserved -2 cell. Repeated allocation failures can consume storage capacity until another operation clears it. No reachable exploit or normal-game frequency is claimed.

Native storage operations fail before mutation and provide `releaseHarvestReservation` to free a still-reserved cell. Tests verify exhaustion, unchanged storage on failed delivery and explicit release. The running harvest FSM now releases the first still-reserved cell on failure, matching delivery order. Regression coverage includes failed concurrent deliveries whose original reservation coordinates have already been filled by another truck. Integration fix complete; retain the original evidence.

## SF-023 — harvest truck-return step uses an uninitialized equipment index

**Status:** confirmed local-variable dataflow defect; exact runtime target and ordinary-game consequences unverified; fixed in native harvest FSM.

Harvest dispatcher `0x156be` allocates locals and jumps directly from the current step byte to its jump-table branch. Step 7 enters at `0x16170`. After checking that the truck has arrived, `0x16192` executes `IMUL BX,[BP-8],0x38`, followed by a zero write to equipment byte +42 at `0x16196`. The local `[BP-8]` holds the attached header index in other branches, but step 7 has no dominating assignment to that local on this call. Stack reuse might retain a useful old value, but the code does not guarantee it. The routine does not bound the resulting equipment address. This is distinct from valid field/truck indices loaded elsewhere in the same branch.

The native harvest FSM omits this redundant arbitrary equipment write: the header's animation is already cleared before return in step 5 (`0x15e14`–`0x15e18`), and native code should omit the stale redundant write or use an explicitly retained valid index. A regression verifies that truck return leaves unrelated equipment bytes unchanged. Memory corruption potential follows from the unchecked index, but exploitability and actual affected DOS memory remain unverified.

## SF-024 — worker harvest finishes early across a week boundary

**Status:** confirmed arithmetic quirk; preserved with regression.

Worker step 12 stores the calendar day-of-week byte in field +50 (`0x1630e`–`0x16316`). Step 13 compares `(currentDay-startDay)&65535` against 3 (`0x163dd`–`0x163f2`) without correcting for seven-day wrap. Starting on day 6 and advancing to day 0 therefore satisfies the three-day wait after only one day. This is reachable through ordinary scheduling around the end of a week.

Native behavior preserves this original arithmetic, tested at the week boundary. Correcting it to elapsed calendar days is deferred to an explicitly tracked enhancement. It is not a security vulnerability.

## SF-025 — worker cleanup hides every overlay in its field rectangle

**Status:** confirmed unqualified map mutation; observed impact on unrelated entities unverified; preserved pending broader rendering reconstruction.

Worker placement skips cells that already have terrain bit 0x0800 set (`0x16367`). Completion nevertheless clears that bit across the entire fixed 8×8 rectangle (`0x16433`) without checking whether the overlay is a worker. Any pre-existing vehicle/animal overlay in that rectangle can be hidden until another renderer or simulation update restores it. For annual crops the cleanup also overwrites every terrain cell with the original tile-36 masking operation.

Native behavior currently reproduces this broad cleanup and guards map boundaries. A regression seeds an unrelated overlay, verifies placement leaves it alone, then confirms cleanup clears its visibility bit. Do not mistake this retained defect for entity deletion; live records are unchanged. Revisit ownership-aware cleanup when moving-entity animation/render passes are completed. No security exploit is claimed.

## SF-026 — manual stored-crop sale counts crop income twice

**Status:** confirmed accounting defect in the stored-crop sale branch; preserved in native stored-crop sale.

The inventory sale handler at `0x4c43c` values the item through `0x1c3f2`, then calls cash credit `1a66:01c8` / `0x1ca28` with category 168 at `0x4c476`. That category already increments crop income `6190:3e60` at `0x1cb38`. The caller increments sales accumulator `3e44` at `0x4c488`, then adds the same amount to crop income again at `0x4c496`. Both far segment references `6190:cfcc` and `6190:cfce` contain `0x6190` in the initialized data segment, so this is not an alias-name error. Ordinary nonzero stored-crop sales therefore credit cash once but the crop-income ledger twice. Automatic harvest sale callers do not contain the second addition.

The native sale port preserves this accounting quirk with a regression; a corrected ledger is a later enhancement. Cash is not doubled. No security vulnerability is claimed.

## SF-027 — stored-crop sale credits before checking whether removal succeeds

**Status:** confirmed inconsistent-state failure path; ordinary-game reachability unproven; native prevalidation implemented.

The stored-crop sale branch checks the active item bit at `0x4c44c`, credits money at `0x4c476`, clears map/storage at `0x4c4b8`, then invokes generic removal at `0x4c4c6`. The harvested-goods removal branch (`0x3a168`–`0x3a1af`) returns without deactivating the item when its definition count is zero (`0x3a17a`). Such an inconsistent item can remain active after payment; repeated sale is possible if the UI exposes it again. This is analogous to seed count inconsistency SF-016 but payment creates a distinct consequence. No supplied save currently proves an active harvested item with zero matching count, and no exploit is established.

The native port checks definition count and the building reference before credit or removal, rejecting inconsistent state without mutation; regressions verify unchanged cash, map, storage and inventory. Do not repair unknown source fields opportunistically. Revisit with inventory lifecycle and save/load validation.

## SF-028 — field-table exhaustion returns an existing field slot

**Status:** confirmed constructor failure-path defect; ordinary-game frequency unverified; native creation rejects exhaustion.

Constructor `0x1ba84` scans slots 1–97 using a byte local. On the last occupied slot, `0x1bb02`–`0x1bb0e` loads AX=97 and tests activity. It increments the local to 98, reaches the signed limit check at `0x1baf9`, and jumps directly to the epilogue at `0x1bc30`, without setting AX to zero. Wrapper `0x1bfa0` sign-extends AL and returns it as a successful field index. A planting caller can therefore receive the last existing field when no new record was allocated. No DOS runtime exploit is claimed.

Native placement detects the full bounded table before touching records or terrain and returns `no-field-slots`; a regression checks the entire world remains unchanged. The original constructor also leaves several previously used record words untouched (including pending equipment +44/+46 and water +24). These remain preserved in the standalone constructor; safe reuse and the original deletion/cancellation path need further tracing before native removal is exposed.

## SF-029 — field-water border probes read outside the map

**Status:** confirmed unchecked reads on permitted edge fields; native bounds fix implemented. No security exploit demonstrated.

Water refresh `0x18d16..0x19001` probes `y-1`, `y+height`, `x-1` and `x+width` without bounds checks (`0x18da0..0x18dac`, `0x18e30..0x18e39`, `0x18ed4..0x18ee1`, `0x18f67..0x18f70`). Unlike placement's clamped spacing probes, it can alias another column or read data adjacent to the terrain array. The validator allows owned, unobstructed 8×8 fields at map edges: buying region (0,0) and enabling automatic clearing on SCEN0 satisfies it. Static caller/validator evidence supports reachability; the DOS program was not executed.

Native integration first exposed this as an exception on the next weekly update. Off-map probes now contribute no water tolerance; valid probes retain the original asymmetric corner inclusion. Tests cover both water categories at all four map corners. This intentionally replaces accidental reads with bounded map semantics.

## SF-030 — chemical consumption reports success even if stock removal fails

**Status:** confirmed inconsistent-stock failure path; native prevalidation implemented. Normal-play reachability remains unproven.

Consumption `0x146e0..0x147ab` finds an active chemical, clears its stored/world image, calls generic removal `0x3a040`, and returns 1 at `0x14778` regardless of removal's return. The chemical removal branch `0x3a25a..0x3a299` refuses to decrement/deactivate when the definition count is zero. An inconsistent active record can therefore remain consumable repeatedly. This parallels SF-016 but uses a separate twenty-byte chemical table. No exploit is demonstrated on the supplied saves.

Native consumption checks the definition count, coordinates and storage cross-reference before any mutation and returns `inconsistent-stock` on failure. Tests cover all three failures and verify the complete world remains unchanged. Valid stock retains the original first-match ordering, removal and automatic-purchase behavior.

## SF-031 — schedule projection divides by unchecked crop-definition values

**Status:** confirmed arithmetic hazard for malformed/custom definitions; ordinary-play reachability unproven. Native year projection now rejects invalid divisors before committing any schedule changes.

Year-rollover schedule generation loads crop byte +56 and byte +66, computes `(byte56 + byte66 - 2) / byte66` with signed division at `0x48e99`, then uses that quotient as the unsigned divisor at `0x48ea3`. The second generation branch repeats this at `0x48ffb` / `0x49005`. No local zero-divisor guard precedes either pair. A positive duration with byte +66 zero, or duration one with positive byte +66, can cause an original division exception if such a definition reaches this loop. Validation elsewhere in the original loader/editor has not been established; no exploitable vulnerability is claimed.

All 24 supplied CRP definitions have byte +66 equal to 7 and byte +56 between 12 and 47, yielding divisors 2–7. The supplied assets therefore do not demonstrate this failure. Native projection validates the divisors transactionally; tests exercise zero stage count and duration one after earlier valid fields. Duration zero performs no original stage division and remains supported. The manual planting-plan generator repeats the unchecked divisions at `0x2fdf9` / `0x2fe02`; its native port applies the same guard. Revisit any further calendar-editor generators when porting them.

## SF-032 — weekly completion bypasses unfinished supply and worker payment

**Status:** confirmed deadline behavior in the executable; preserved. Static ordinary-game paths exist, but the DOS program has not been executed to demonstrate them.

Weekly completion `0x2e93a` dispatches treatment states 6–9 regardless of substep. `0x2f4d4..0x2f62d` returns machinery and applies the full fertilizer/spray effect without consuming supplies, charging money or checking that treatment step zero succeeded. A scheduled treatment stuck at step zero for lack of stock/money can therefore receive its effect at the next weekly dispatch. The actual calendar caller includes year-end: it dispatches week 48 before month/year normalization, so January rollover does not skip this completion. The same routine sends worker harvest step 10 (which normally waits for its fee) through the harvest/storage branch: `0x2e99b..0x2e9ae` accepts steps 10–15 without a fee check. It can complete work for which the normal FSM never obtained machinery or payment.

Native forced completion preserves these paths explicitly and does not introduce a second supply/fee purchase. Tests include an unpaid step-zero fertilizer job that changes nutrients with zero cash/chemical expense. Whether this was intended as deadline assistance or is a game-design defect is unknown; no security vulnerability is claimed. Revisit only with a deliberate gameplay correction policy.

## SF-033 — weekly harvest cleanup omits an unattached reserved header

**Status:** confirmed missing cleanup; native fix implemented in the forced-completion routine.

Machinery harvest stores its allocated header at field word +46 before attaching it (normal steps 2/3). Weekly cleanup `0x2ef60..0x2f196` returns field words +42 and +44 and the first machine's actual attachment, but never reads/releases +46. If the week changes before the header attaches, that active header can remain reserved with no subsequent job reference. Static phase ordering provides a reachable path; tests reproduce these actual pre-attachment phases on the supplied native farms.

Native weekly cleanup also returns the unattached type-5 header referenced by +46 in machinery steps before 4, then clears that reference. It does not reinterpret the worker path's overloaded +46 member as a header. Tests complete actual harvest phases and verify no referenced owned/rented machine remains reserved or attached. The original omission is retained here for preservation.

## SF-034 — weekly cleanup leaves worker-sale step 16 without a truck

**Status:** confirmed omitted transition; native correction implemented in forced completion.

At `0x2e993..0x2e9ae`, steps greater than 6 enter the main settlement path only for 10–15. The alternate branch at `0x2eef6` resets only step 7. Worker-sale step 16 therefore reaches equipment cleanup unchanged, then `0x2f18c..0x2f191` zeros its equipment references. The normal step-16 handler expects its truck, so a week boundary during travel to the town can strand the field or lead to slot-zero accesses; exact DOS consequences remain unobserved. Machinery step 7 was already paid, while worker step 16 is paid only upon arrival.

Native weekly completion credits the pending worker sale once, resets annual/perennial field state, and returns its equipment. Already-paid machinery step 7 receives no second payment. Regression checks distinguish both paths and ensure a second completion cannot pay again. No exploit is claimed.

## SF-035 — scheduled plowing enters an inert work state

**Status:** confirmed dispatcher behavior and reachable original toolbar order. Preserved as an original incomplete/no-op path, not a demonstrated gameplay exploit.

Calendar code 852 sets field state 2/step 0 at `0x2f718..0x2f72c`. The main work jump table at `0x18c98` maps states 0, 1 and 2 to the same no-op exit `0x18cb2`; weekly completion's jump table handles only states 3–9. Thus a dispatched 852 order does not perform a plowing pass through either recovered work loop. None of the supplied schedules contains this code. Subsequent toolbar tracing establishes UI reachability: `0x26cb0..0x26ce7` accepts a Waiting field, immediately sets state 2/step 0, and calls the plan recorder with order 1; `0x2fd8e` writes 852 into the current week without an occupied-word guard.

Native schedule dispatch preserves state 2/step 0 and does not invent an equipment FSM. Static-byte tests verify both the state write and all three no-op table targets; recorder tests verify the order mapping and unconditional plan write. No native plow button has been added. Revisit the intended UI semantics while reconstructing the calendar editor; any added plowing operation should be documented as an enhancement if no other original handler is found.

## SF-036 — year projection scans before its column when no matching marker exists

**Status:** confirmed unchecked backward read; normal original UI reachability remains unproven. Native bounded fallback implemented.

`0x48e6f` starts the search at week 239. `0x490c9..0x490d3` decrements the index and checks only a pending flag; neither the annual planting search at `0x48f6a` nor perennial harvest search at `0x490e9` bounds the index. Without a matching marker it reads before the stack column, potentially interpreting other local data as a crop order or wrapping the index. All eight supplied farms have the needed markers, but an all-fallow/missing-marker column does not. Original editor validation still needs tracing, so this is not a proven ordinary-play hang or security exploit.

Native projection searches only the retained 192 weeks (the other 48 are initialized to fallow), preserves those words if no marker exists, leaves the new tail fallow (209), and reports the field slot to its caller. Tests cover both branches and unrelated marker/unknown words. It does not invent a planting cycle. Revisit original new-field/editor initialization when connecting automatic schedules.

## SF-037 — long projected crop patterns overlap live stack locals

**Status:** confirmed stack layout hazard for malformed/custom durations; supplied 47-week perennials alias a scratch word without a demonstrated bad result. Native duration guard implemented.

Pattern initialization `0x48d25..0x48d30` clears 48 words starting at `bp-0x6e`. Stage writes start at pattern index 1 (`0x48eb4` / `0x49016`), followed by harvest at index `duration+1` (`0x48ec9` / `0x4902b`). A supplied duration of 47 writes index 48 at `bp-0xe`, also used for the schedule-copy index. That scratch word is not needed until copying the completed plan, so native code preserves the resulting 49-word pattern using a separately allocated array. This alias alone is not claimed as a reachable gameplay defect.

Duration 48 writes its final harvest over the live reverse-scan index at `bp-0xc`; longer durations overlap selected crop and other generation locals. No local duration bound protects these stores. Supplied definitions range 12–47; original custom-definition validation remains untraced. Native projection rejects durations above 47 before committing, with a regression at 48. No exploit or original source-language array declaration is inferred from the disassembly.

The manual recorder has a similar layout: its 48 initialized pattern words begin at `bp-0x74` (`0x2fb21..0x2fb30`). Duration 47's terminal entry aliases the unused linear-index word at `bp-0x14`; duration 48 reaches the live duration byte at `bp-0x12`. Its native port also accepts supplied durations through 47 with a separately allocated pattern and rejects longer ones before writing a plan.

## SF-038 — perennial projection uses an unchecked signed restart index

**Status:** confirmed out-of-pattern read hazard for malformed/custom definitions; supplied definitions avoid it. Native index guard implemented.

At `0x48efa..0x48f14` and `0x4905c..0x49076`, crop byte +18 is sign-extended, incremented, then used to read the pattern without a bounds check. Values outside `0..duration+1` after that conversion can read unrelated stack locals. The check against cycle length occurs before choosing the restart, not after. Supplied perennial restart bytes are 0 or 1; ordinary-play failure is unproven.

Native projection validates the resulting index against the allocated pattern before any schedule commit. Tests cover positive overflow, negative indices, and byte 255 (signed -1 plus one), which validly restarts at index zero. Other uses of crop +18 retain their own recovered arithmetic. Revisit validation if editable crop definitions become supported.

Manual plan recording repeats this unchecked restart at `0x2fede..0x2fef8`; its native port validates the index too. Fixed-harvest crops overwrite the resulting graphic each week, but the original still performs that intermediate pattern read. Supplied restart values remain in range.

## SF-039 — moving an annual harvest can erase the last crop-slot planting

**Status:** confirmed editor comparison error; native correction implemented.

The calendar editor places a harvest at `0x2e4e0` and clears subsequent annual-plan words until a planting marker. At `0x2e525..0x2e539` it requires `word >= table[090c]` (832) and `word < table[092a]` (847). Plant slot 15 uses 847, so that valid next planting is erased with the intervening growth stages and later orders until another slot's planting or the end of the plan. The editor exposes all sixteen crops, providing a reachable edit path; no security exploit is claimed.

Native harvest editing stops at all sixteen planting words, including 847, preserving that crop and everything after it. A regression tests each crop slot separately and compares the entire retained suffix. Keep the original strict-branch bytes in the test and this record rather than silently redefining the executable behavior.

## SF-040 — withdrawn: alternate-harvest marker was misdecoded natively

**Status:** not an original defect. The initial mismatch claim is withdrawn; native decoder corrected, entry retained for audit history.

The original editor writes 239 at `0x2e59b`. Dispatcher `0x2f6eb..0x2f6fa` subtracts 198, then 11, then 30 before branching to alternate harvest: `198+11+30=239`. The previous native mapping incorrectly used 231, leading to a false claim that the editor's marker had no handler. Editor and executable dispatcher agree; the source is not changed.

Native decoding now dispatches 239 and preserves 231 as unknown. Byte-level regression checks the subtraction chain and editor store together, alongside work-state/flag tests. No automatic conversion of stored unknown words is performed. The alternate path enters machinery harvest unconditionally with field +7 bit 1 cleared; its intended player-facing label still requires icon/help evidence, so no crop-disposal semantics are invented.

## SF-041 — report expenses omit worker and chemical charges

**Status:** confirmed arithmetic omission; player report integration and any correction deferred.

Debits post workers to `6190:3e88` at `0x1c9c7` and chemicals to `3ea0` at `0x1c9ab`. Report routine `0x1d460..0x1d51e` never includes those locations in its expense sum, though both are charged to cash. Its income-minus-expense result can therefore overstate profit after ordinary paid work. The summation is statically verified; complete report UI reachability is still being traced. Category-1000 payment ledger `3ea4` is also omitted, but whether excluding that principal is a defect remains uncertain.

Native worker/chemical charges remain correct to the recovered debit paths. The original full report is not yet implemented, and no silent correction or security-vulnerability claim is made. Revisit when connecting the financial report; retain the source omission even if a corrected display is later offered.

## SF-042 — annual ledger reset leaves worker expenses intact

**Status:** confirmed reset omission; native annual accounting integration and correction deferred.

Year-end calls reset `0x1d396` at `0xcdf9`. It clears dwords `3e60..3e84`, then skips `3e88` and resumes at `3e8c..3eac`. Worker debits post to skipped `3e88`, so that running ledger survives this annual reset. The loader separately fails to restore it (SF-014), and the aggregate report omits it (SF-041). The complete effects on player-visible financial views require their callers to be traced. This is an accounting defect, not evidence of a security vulnerability.

Native annual reset is not connected yet. Preserve the evidence and revisit its treatment alongside ledger migration and reports; do not accidentally erase the quirk with a generic clear-all implementation.

## SF-043 — annual sales tax interprets a wrapped sales accumulator as signed

**Status:** confirmed arithmetic boundary; normal-play reachability unproven; preserved in native assessment.

Tax assessment reads sales accumulator `6190:3e44` at `0x1d57f` and calls signed long division `0084:33f8` / `0x5e38`. Sales postings use unsigned ADD/ADC. At `0x80000000`, signed conversion makes the sales component negative; final additions still wrap as a dword. With cash at least 500,000, no land and no arrears, assessment becomes `3579139414`, not an unsigned division result. Values `0xffffffff` truncate to zero after signed division. The actual year's reachable sales volume has not been established; this is not a proven reachable exploit.

`assessAnnualTax` preserves signed division, truncation and final uint32 wrap, with boundary regressions. It normalizes JavaScript negative zero to integer zero to match machine arithmetic. No gameplay correction is applied; review reachability when annual collection/reset and all sales sources are connected.

## SF-044 — zero annual tax enters the failed-payment branch

**Status:** confirmed branch behavior; preserved natively; ordinary-play reachability unproven.

Annual collection tests the amount returned by debit with OR/JNE at `0x1d60d..0x1d613`. A zero assessment returns zero even with sufficient cash, so the routine increments failed-tax byte `3eed`, sets `fed7` to three and takes the unpaid-tax notification path. A zero-land/zero-sales/zero-debt fixture demonstrates the arithmetic; whether ordinary play reaches that state before game termination remains unproven. Native settlement preserves the branch and its countdown rather than treating zero as a successful payment. Revisit with bankruptcy/end-state behavior; no exploit claim.

## SF-045 — town maintenance truncates residential-level multiplication to a word

**Status:** verified arithmetic truncation; reachable world-state bound, normal progression unproven; preserved natively.

`0x1d5fe` computes `IMUL AX,[7512],200`; `0x1d608` sets the result's high word to zero. Total residential level comes from the high nibble of each town-owned regional byte (`0x3b21a`, `0x3c5c8`), up to 2160 across 144 regions. The multiplication wraps above 327 levels: maximum representable levels produce maintenance 38,784 instead of 432,000. Whether the game's district limits and growth can actually attain these totals still needs tracing. The native settlement keeps the low-word result with a regression. No correction or security claim; revisit with full town growth.

## SF-046 — default crop-sale retries post payment to the opposite debt category

**Status:** confirmed caller/callee mismatch; forced-sale integration and correction deferred.

Monthly tax retry calls forced-sale `0x1d766` with reason 36 (`0xcd28`); the other monthly balance uses reason 39 (`0xcc7a`). After selling a stored crop, reason 36 at `0x1d838..0x1d848` debits category 1000, while reason 39 at `0x1d85e..0x1d86e` debits category 2500. Regular monthly tax uses 2500 and the other balance uses 1000. Cash is debited for the same requested amount, but the crop-sale recovery records the wrong ledger. Later livestock, equipment and land retries use category zero, creating another accounting mismatch. These are static source findings; full default/UI reachability and broader effects remain unverified.

Native forced sales now preserve these mismatches with exact ledger tests; live calendar integration remains pending. Do not confuse an incorrect ledger category with duplicated cash debit or a proven security vulnerability. Category zero is identified as equipment expense in the implementation follow-up below.

## SF-047 — signed recreation count can write before saved coordinate arrays

**Status:** confirmed unchecked signed-index hazard on malformed state; native guard implemented; ordinary-play reachability unproven.

Town constructor reads recreation count `6190:9cbc` as signed at `0x3abe3..0x3abe7`, compares it signed against seven at `0x3abf4`, then sign-extends it to index coordinate arrays `2d9f:f7aa/f7b2` at `0x3ac00..0x3ac1f`. Values 128–255 can pass these guards and index before the arrays when the town-region comparison permits construction. The SSM loader restores the byte at `0x21673` without validation in the inspected read sequence. Broader loader validation has not been established; no exploit or normal-play reachability is claimed.

Native construction validates count 0–7 and both coordinate-array bounds before mutation; malformed counts are rejected atomically. Existing unused coordinate bytes remain preserved. Keep this evidence if later save validation is expanded.

## SF-048 — town-choice timeout ignores a rejected recreational district

**Status:** confirmed ignored result; native constructor failure is exposed; complete pending-choice integration remains deferred.

At `0x3c385..0x3c3a3`, timeout chooses `below(14)+1`, calls constructor `0x3aba0`, then unconditionally clears the choice-pending local without checking AX. Random type 4 may fail its recreation quota/cap. The plot was already paid for and assigned town ownership by `0x3bff0..0x3c032`, so this path can leave a reserved plot without the new district. Interactive recreation checks the result and keeps the chooser open, demonstrating the difference. Full runtime reproduction is pending clock/choice integration; no security claim.

Native `resolveTownChoice` returns this failure, including for timeout, preserving the reservation and map so the eventual UI can retain the pending choice. A bounded-RNG fixture produces type 4 at a blocked quota and verifies no construction mutation. Do not silently replace it with another random type or discard the paid plot.

## SF-049 — invalid district type can use an uninitialized template offset

**Status:** confirmed constructor input hazard; normal chooser does not supply it; native bounds guard implemented.

Constructor `0x3ac28..0x3ac65` initializes local pattern offset only for signed type below 15. A positive type 15–127 falls through without assigning `[bp-0xe]`, which later participates in reads from `6190:952c` at `0x3ad5c..0x3ad68`. Negative signed types also form invalid offsets. The traced player choices and timeout generate only 1–14, so reachable harmful input beyond malformed/internal calls is not established. This is not a proven exploitable vulnerability.

Native constructor rejects every non-integer or out-of-range type before mutation, and the layout accessor bounds-checks type and coordinates. Tests include negative, 15, 256 and NaN inputs while preserving unknown words in valid layout storage.

## SF-050 — airport development guard compares the complete level/type byte

**Status:** verified branch mismatch; native behavior preserved; complete clock reproduction pending.

`0x3b3cb` compares the full district byte to 5, whereas the airport constructor writes `0xa5`. Thus a constructed airport can grow from level 10 to 13 or decline, rather than taking this apparent protection branch. Conversely a raw byte 5 returns success without any change (`0x3b3d2`), allowing weekly development to charge 25 repeatedly, or reduce negative revenue by 25, while its level stays zero. Whether airport growth was intended is uncertain; the exact mismatch and arithmetic effects are verified. Native tests preserve both cases. Revisit after live finance/town integration; no security claim.

## SF-051 — town demolition leaves recreation coordinates and airport count unchanged

**Status:** confirmed incomplete bookkeeping; native behavior preserved; correction deferred.

`0x3be63..0x3be6a` decrements recreation count only for raw byte 4. The remainder of demolition neither removes/compacts the saved coordinate pairs nor decrements airport count. Removing an earlier recreational district can therefore leave a stale entry and make subsequent construction overwrite a different live site's last coordinate slot. Count zero underflows to 255 on a malformed recreation record; native construction subsequently rejects that count (SF-047). Native demolition retains source byte arithmetic, coordinates and airport count. Effects on consumers of these tables still require tracing before a safe correction; no proven exploit claim.

## SF-052 — next-town-site scan admits coordinate 12 and excludes the whole origin cross

**Status:** confirmed boundary and selection quirks; native bounds corrected, selection quirks retained.

`0x3c53d..0x3c547` skips coordinates only when greater than 12, but regional arrays have valid coordinates 0–11. A search near the map edge can read a neighboring logical record (Y=12) or beyond the ownership array (X=12), and can return an invalid site if that byte happens to be 2. Native search rejects both out-of-bounds coordinates before lookup. This is an invalid-read/index hazard, not a demonstrated exploitable vulnerability.

Separately, `0x3c566..0x3c575` rejects either X equal to origin X or Y equal to origin Y. It excludes a whole row and column rather than just the protected origin pair. Search radii are 1–6 with exclusive positive edges. Those choices are preserved as verified behavior; whether the axis exclusion was intended remains uncertain. Tests exercise edge searches, first-candidate order, axis exclusions and fallback. Revisit their gameplay effects after integration.

## SF-053 — town building repaint assumes every template anchor has four in-district cells

**Status:** unchecked asset boundary assumption; supplied layouts safe; native guard implemented.

At `0x3b922..0x3b97a` every even template value 252–280 writes four words at offsets 0, 0xc0, 2 and 0xc2 without district/map-edge checks. A modified layout placing an anchor on the last row or column can alter the next district or access beyond map storage at an outer edge. Every anchor in the supplied `townly0.cmp` is bounded, so this is not a demonstrated ordinary-game bug or exploit. Native repaint validates these anchors before changing terrain or consuming RNG. Tests inject a malformed last-column anchor and verify atomic rejection, including rollback of the proposed level.

## SF-054 — commercial template anchor 280 is only partially retained during early growth

**Status:** verified template/range interaction; visual defect suspected, native behavior preserved.

Type 3 in original `townly0.cmp` has tile 280 at local (5,2), with companions 281 at (6,2), 246 at (5,3), and 247 at (6,3). Early growth treats 280 as a randomized four-cell building anchor (`0x3b90b..0x3b97a`), but subsequent iterations skip only 252–280 or 292–320 (`0x3b83c..0x3b853`). The three companion words fall outside those ranges and are overwritten with their template values, leaving only one randomized tile. An initial test incorrectly assumed every randomized four-cell group survives; source/asset inspection corrected that expectation. Native behavior now has a regression. Full original runtime visual confirmation and intended appearance remain unproven; correction deferred, no security implication.

## SF-055 — livestock/equipment sale sign-extends unsigned word quotes

**Status:** verified arithmetic boundary behavior; native behavior preserved; ordinary-play reachability unproven.

Equipment valuation `0x1192e` returns an unsigned shifted price word. Animal valuation `0x12958` computes a dword sum after a word-truncated bonus, shifts it, and returns AX to its caller. Both sale branches then use CWD (`0x4c502`, `0x4c5a5`) to sign-extend AX. Values >=32768 become negative proceeds: they can reduce cash or wrap it into the unsigned cash cap of 9,999,999, while income and sales ledgers wrap independently. Animal bonus multiplication itself also wraps at 16 bits (`0x129d3`, `0x129f7`, `0x12a0f`, `0x12a27`); that operation is preserved, not silently promoted to arbitrary precision.

Native tests cover quotes 0/32767/32768/65535, every condition byte, bonus boundaries, negative cash addition and ledger wrapping. Supplied equipment prices are lower; whether animal word +10 can normally reach the dangerous range still requires its lifecycle. No exploit claim or gameplay correction is made.

## SF-056 — livestock price lookup trusts a byte-wrapped, signed type index

**Status:** confirmed malformed-record indexing hazard; native bounds guard implemented; ordinary-play reachability unproven.

`0x12972..0x12984` reads the low byte of animal type, adds 96 with byte wrap, sign-extends it and uses an 18-byte stride from definition price base `6190:70e8`. Only five definitions are loaded at `0x458e0..0x45909`, but the caller does not bound the animal type before that lookup. Corrupt type bytes can address before or after the table; generic removal separately allows types through 167. Native quote/sale rejects types outside 160–164 and retains all five loaded records, including the fifth record's duplicate type 163. No malicious-file exploit or broader loader-validation claim is established.

## SF-057 — generic equipment deletion does not repair attachment references

**Status:** verified deletion limitation; normal eligibility invariants not fully traced; native consistency guard implemented.

Generic sale only rejects inactive or flags 1/8 equipment (`0x4c4dc..0x4c4f0`). Removal `0x3a040..0x3a0a8` calls `0xf888`, which clears active bit and decrements the global count, without changing parent/attachment links. If a sellable machine is still referenced by another active machine, that reference becomes dangling. Normal reserved flags may prevent this in ordinary use; reachability beyond inconsistent state is unproven.

Native sale prevalidates attachment references before payment. Truck word +44 is a storage-building reference in the recovered harvest path, so it is not mistaken for a machine parent. Unknown bytes of the removed record remain intact; no speculative chain breakup is imposed. Tests reject linked inconsistent fixtures atomically. Revisit with the full equipment shop and aircraft state machines.

## SF-058 — generic sale allows rented equipment and preserves owned accounting

**Status:** confirmed branch behavior; player-facing reachability unproven; native behavior preserved.

Sale eligibility at `0x4c4e3..0x4c4ea` tests active and bits 1/8, not rented bit `0x40`. The generic sale therefore credits a rental's depreciated value. Removal at `0x3a07a..0x3a09e` skips owned-count and book-value deductions for rentals. Whether the original shop hides these entries remains untraced; this is not yet a proven player exploit. Forced-sale selection explicitly excludes rentals at `0x1d97d`, so that path must retain its own filter. Native generic sale preserves this distinction and tests it; live shop/default integration remains pending.

## SF-059 — default scans can continue past record arrays after successful removals

**Status:** confirmed count/scan mismatch; bounded native forced-sale traversal implemented and tested; live calendar integration pending.

Crop default scan captures the original inventory count at `0x1d797..0x1d79f`. It separately compares sold count (`bp-2`) and encountered-active count (`bp-0x1c`) to that original total at `0x1d7a2..0x1d7b2`. After a sale clears active, the subsequent active test `0x1d88e` does not increment the encountered count for that item. With a mixture of sold crops and other active goods, neither counter need reach the total, so slot increments can continue beyond the 512 records while debt remains. Equipment uses the same separate-counter shape at `0x1d966` and `0x1da08`; failed busy sales also interact with its counters. Animal scans additionally trust a declared count without a slot bound.

This establishes an unsafe scan path conditional on unpaid debt and those records, not a demonstrated DOS crash/exploit. Native saved-record readers bound arrays, and the implemented default traversal now iterates actual slots with termination independent of source counts. It retains source order and ledger-category mismatch SF-046 without reproducing unsafe memory reads. Broader live default integration remains deferred; see the implementation follow-up below.

### SF-027 follow-up — animal/equipment sale validation

The same ignored-removal-result pattern also occurs in animal/equipment branches of `0x4c41c`: credit precedes generic deletion `0x3a040`, which rejects zero definition count. Native sale primitives now validate counts, map/storage footprints, stored-animal references, and plane-home bounds before payment, extending the existing crop-sale correction. Source record/definition mismatch effects remain documented; do not remove SF-027 after these guarded implementations.

## SF-060 — clearing queue's initialized coordinates differ from its free sentinel

**Status:** confirmed initialized-byte mismatch; startup reachability uncertain; native empty queue guarded.

The 64-entry x/y arrays at `2d9f:d53a/d57a` (EXE `0x5dd1a..0x5dd99`) contain zeros. Enqueue increments its cursor, then at `0xa32c` treats any prior x other than 255 as a live coordinate and restores that tile, irrespective of prior count. Without another startup reset, early enqueues would restore (0,0). Direct references found so far are confined to enqueue/update; broader startup initialization has not been fully traced, so a normal-game origin-tile defect is not proven.

Native `createClearingEffects` fills x with the source free sentinel 255, retains zero y/cursor/count/tick, and tests that enqueue does not change the origin. Revisit startup initialization before claiming original runtime reachability. No security implication is established.

## SF-061 — clearing animation scans beyond its 64 coordinate slots

**Status:** confirmed unchecked scan and counter mismatch; native bound implemented; original runtime consequences unverified.

Update `0xa5a0..0xa5ab` increments a byte index without a 64-slot bound and loops while visited <= count. Free slots skip the visited increment. With a full 64-entry queue still animating, visited reaches 64 and the comparison permits reading slot 64 outside the x table; inconsistent sparse counters also exceed the table. On retirement, count decreases within the loop, producing a smaller work budget (33 retirements from a full queue). This is an invalid-read/map-write hazard, not a demonstrated exploit or DOS crash.

Native update bounds index to 0–63 while preserving the original changing-count comparison and unsigned timer wrap. Tests cover full queues, retirement and sparse inconsistent counters with finite execution. The bound is complete for this primitive; live clock/checkpoint integration remains pending.

## SF-062 — field rectangle query uses exclusive corners and hardcoded field size

**Status:** verified selection defect; native overlap corrected; complete forced-sale integration deferred.

Query `0x1b868` tests query corners including x+width/y+height against fixed 8×8 field bounds. A field starting at that far edge can be selected despite zero shared area; conversely a field fully enclosed by a larger query can be missed because no query corner lies inside it. Saved field dimensions are ignored. Default uses this query before deleting fields associated with land sales, so erroneous adjacent selection is relevant to that path; full original runtime reproduction remains pending.

Native query returns the first active nonreserved slot with strict positive-area rectangle overlap, using actual saved field dimensions. Tests cover adjacent, enclosing, crossing and nonstandard-size rectangles. This is an intentional geometry correction, not claimed source equivalence.

## SF-063 — field cleanup releases machinery without detaching deleted rentals

**Status:** confirmed missing link repair for attached rentals; native cleanup corrected; ordinary default reachability not fully reproduced.

Field cleanup `0x1b996..0x1b9f3` calls equipment erase then release for both assignment words. Release `0xfa66` clears flags/field association and deactivates rentals but does not clear parent/attachment words; field deactivation does not repair them either. An owned tractor can therefore remain linked to its now-inactive rented attachment. This is separate from generic-sale eligibility SF-057 and the earlier detach-helper issue SF-010.

Native `removeField` validates both chains before mutation, runs both original release sequences, then clears the released chains' known attachment/parent links. Truck word +44 remains intact because it is a storage reference. Waiting fields retain the original skip-release behavior and all inactive field assignment bytes are preserved. Tests cover owned/rented chains and both assignments across five field states. Revisit other release callers and live default integration; no security claim is made.

### SF-055 follow-up — building book-value subtraction

Generic building deletion obtains a definition price word via `0x1d280`, sign-extends it at `0x3a0e3`, then subtracts the dword from `6190:3e54`. A price >=32768 therefore increases the ledger modulo 2^32. The adjacent equipment branch zero-extends its price (`0x3a08e`), demonstrating the arithmetic difference. This is verified boundary behavior, not a proven normal-game defect or vulnerability. Native building deletion and ledger initialization remain pending; preserve this distinction when implementing them and test both signed boundaries. No original behavior has yet been changed for buildings.

## SF-064 — building demolition trusts content references and ignores deletion failures

**Status:** confirmed unchecked-reference/count behavior; malformed-state effects guarded natively; ordinary-game reachability partly unresolved.

Cleanup `0x19fe2..0x1a00a` reads each nonempty content type/byte slot and calls generic deletion without checking the result. Generic branches index the selected record and definition directly, test their count/active bits, but do not establish that the record belongs to this building or matches the content type. An inconsistent content record can delete a different asset or debit the wrong definition; a zero count can leave an active asset after its containing building is removed. This is related to ignored sale-removal results SF-027, but demolition gives no proceeds. The source's unsigned slot byte versus larger inventory array remains separate evidence; no exploit or normal-play corruption is asserted here.

Native demolition prevalidates types, positions, active unique-record counts, aircraft home, stored-animal footprints and external machinery references before any mutation. Duplicate cells referencing the same valid machine consume one count. Unsupported type categories reject without guessed semantics; inactive record bytes and supported -2 sentinels are retained. Tests cover zero/insufficient aggregate counts, out-of-bounds building/queue state, wrong types/slots and links that would dangle. Broader building/delivery/default integration remains pending.

## SF-065 — building book-value persistence is not evident in the inspected loader/saver

**Status:** suspected lifecycle omission; not a confirmed original save defect; investigation and any fix deferred.

The runtime ledger changed by building add/delete is `6190:3e54` (`0x3a36d`, `0x3a0e8`), and asset reporting reads it. Its initialized dword is zero. The inspected save/load sequences directly transfer the separate `3e4c` (`0x44c79`, `0x45c9b`) and adjacent other ledgers, with no direct `3e54` transfer. A byte-reference scan found only add/delete/report references to the latter. This does not rule out bulk/indirect initialization or recalculation, so original runtime loss of building value has not been proven.

Native demolition takes explicit runtime book value instead of guessing a saved offset or reconstructing a total without evidence. Live finance/checkpoint integration must resolve its startup/load lifecycle. Retain this entry and update its confidence when those callers are traced.

### SF-055 building subtraction implementation

Building demolition now preserves the sign-extended price subtraction described above. Tests cover definition prices 0, 32767, 32768 and 65535 against zero and maximum dword balances. The native implementation does not correct this verified arithmetic quirk; its ordinary-play consequences and building-ledger initialization remain under investigation.

## SF-066 — land-sale repaint leaves clearing entries below the animation range

**Status:** confirmed producer/consumer interaction; native behavior preserved with bounded scanning; correction deferred.

Field cleanup and building demolition enqueue tile 664 through `0xa2f6`. Land sale subsequently rewrites non-tree terrain to grass at `0x3cb12..0x3cb4b`, including queued cells inside the plot. Clearing update `0xa490..0xa4f5` advances only its animation range or retires images whose incremented value is at least 672. Lower images fall through to the visited increment without clearing x or decrementing count. The queue can thus retain coordinates after their effects have been overwritten. The complete interaction is statically established; original runtime timing/visible consequences remain unverified.

Native land sale retains source order and this counter behavior. A regression composes field removal, sale and animation update, confirming the sold grass stays unchanged while count remains positive. Native scanning remains bounded to 64 entries (SF-061), so this does not recreate the original unchecked-array scan. Consider retiring overwritten entries during live animation integration, with an explicit fidelity decision; no security exploit is claimed.

### SF-064 follow-up — whole land-sale preparation

Native land sales now validate demolition as one transaction before crediting cash or clearing ownership. Shared count reservations catch aggregate shortages across multiple buildings; surviving machinery may not reference any removed machine, while links wholly inside the destroyed set are retained in inactive records. Tests confirm failed preparation leaves all accounts, map, records and clearing state unchanged. This does not settle all future delivery/home/default dependencies.

### SF-059 implementation follow-up — bounded forced sales

Native `forceAssetSales` now scans actual decoded inventory, animal and equipment slots once, and the 12×12 land grid, independently of unsafe source counts. It retains eligibility/order, failed-sale payment retries and ledger mismatch SF-046. Tests cover all eight source farms under unpayable debt, unrelated active inventory and the final legal slot of all three record arrays. This completes the scan-bound correction for the primitive; monthly/default UI/checkpoint integration remains pending.

### SF-046 implementation follow-up — category zero is equipment expenditure

The later default retry category zero is not an unclassified debit: `0x1c912..0x1c925` routes it to equipment expense `6190:3e7c`. Native forced sales now preserve that posting along with the swapped crop-stage categories. Tests stop successfully at each of crop/animal/equipment/land stages and verify the exact ledger, full amount and dword wrapping. Ordinary financial presentation is still pending.

## SF-067 — zero default amount still liquidates assets and reaches a terminal choice

**Status:** verified arithmetic/control-flow behavior; native preserved; ordinary-play reachability unresolved.

Debit returns the amount, so zero is tested as failure by forced-sale retries (`0x1d854`, `0x1d92f`, `0x1d9e8`, `0x1daeb`). Default does not guard a zero requested amount before selling. Both monthly callers test only their countdown before a normal debit (`0xcc40`, `0xccee`), and decrement toward default when that return is zero. Annual zero-assessment failure SF-044 can establish a zero tax debt/countdown in unusual states; full ordinary-game reachability is not yet demonstrated.

Native forced-sale arithmetic retains this behavior with bounded scans, and a test verifies a zero-value demand still sells an available crop and requests a decision. Revisit a correction together with SF-044 during live monthly/annual integration; no security claim is made.

## SF-068 — terminal default text claims the protected homestead was sold

**Status:** confirmed text/control-flow mismatch; native world protection preserved; UI wording deferred.

Terminal text at `6190:3efa` says the homestead was sold to pay debts. The preceding land scan explicitly skips the saved pair (`0x1db1a..0x1db2d`) and contains no final home sale before showing that text at `0x1db56`. Native exhaustion preserves the home plot on all eight farms and returns a pending decision. The future UI should describe inability to pay without inventing a home sale. Original text remains documented rather than silently used as simulation evidence.

## SF-069 — declining restart can be mistaken for successful default payment

**Status:** confirmed return-value/caller mismatch; native explicit outcomes separate payment and decision; live caller correction pending.

The default terminal dialog's nonzero result is left in AX when `0x1db72..0x1db7e` writes exit flag 1 and returns. Monthly callers test AX as payment success (`0xcc92`, `0xcd40`) and can clear the respective unpaid balance and emit a success notice even though no full debit succeeded. Exit is already requested, so visible/persistent consequences beyond this sequence remain unverified. A zero dialog result requests restart and returns zero instead.

Native `ForcedSaleResult.paid` remains false on exhaustion, independent of later restart/exit choice. The decision is single-use and does not itself mark debt paid. Monthly integration must retain this separation rather than translate a UI button result into payment success. No exploit or financial correctness claim beyond this code path is made.
