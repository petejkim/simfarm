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

Native worker/chemical charges remain correct to the recovered debit paths. The native report primitive now preserves these omissions with tests; live report presentation remains pending. No silent correction or security-vulnerability claim is made. Revisit when connecting the financial report; retain the source omission even if a corrected display is later offered.

## SF-042 — annual ledger reset leaves worker expenses intact

**Status:** confirmed reset omission; native annual accounting integration and correction deferred.

Year-end calls reset `0x1d396` at `0xcdf9`. It clears dwords `3e60..3e84`, then skips `3e88` and resumes at `3e8c..3eac`. Worker debits post to skipped `3e88`, so that running ledger survives this annual reset. The loader separately fails to restore it (SF-014), and the aggregate report omits it (SF-041). The complete effects on player-visible financial views require their callers to be traced. This is an accounting defect, not evidence of a security vulnerability.

The native annual-reset primitive now deliberately preserves worker expenses, with tests across all eight farms and repeated resets. Live calendar integration and any correction remain deferred; retain this evidence alongside ledger migration and reports.

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

Native constructor rejects every non-integer or out-of-range type before mutation, and the layout accessor bounds-checks type and coordinates. Tests include negative, 15, 256 and NaN inputs while preserving unknown words in valid layout storage. With weekly development now live, native checkpoint loading also rejects type nibble 15 at the active town-owned site before replacing the current farm.

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

**Status:** confirmed generic branch behavior retained; normal manual shop excludes rentals; other caller reachability remains unproven.

Sale eligibility at `0x4c4e3..0x4c4ea` tests active and bits 1/8, not rented bit `0x40`. The generic sale therefore credits a rental's depreciated value. Removal at `0x3a07a..0x3a09e` skips owned-count and book-value deductions for rentals. The original shop filter was initially untraced; the manual-shop follow-up below now confirms it hides these entries, so this is not a proven player exploit. Forced-sale selection explicitly excludes rentals at `0x1d97d`, so that path must retain its own filter. Native generic sale preserves this distinction and tests it; live manual sales and forced-sale selection each enforce their own source rental exclusion.

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

**Status:** confirmed return-value/caller mismatch; native explicit outcomes separate payment and decision; live caller correction implemented.

The default terminal dialog's nonzero result is left in AX when `0x1db72..0x1db7e` writes exit flag 1 and returns. Monthly callers test AX as payment success (`0xcc92`, `0xcd40`) and can clear the respective unpaid balance and emit a success notice even though no full debit succeeded. Exit is already requested, so visible/persistent consequences beyond this sequence remain unverified. A zero dialog result requests restart and returns zero instead.

Native `ForcedSaleResult.paid` remains false on exhaustion, independent of later restart/exit choice. The decision is single-use and does not itself mark debt paid. Monthly integration must retain this separation rather than translate a UI button result into payment success. No exploit or financial correctness claim beyond this code path is made.

### SF-067 / SF-069 monthly caller follow-up

The monthly retry primitive now preserves the zero-debt failure/countdown behavior and tests its path into bounded liquidation. For exhausted defaults it stops further financial phases and preserves debt while the explicit restart/exit decision is pending, correcting SF-069 at the monthly caller. Choosing exit never clears the debt. Live calendar suspension, UI and checkpoint persistence remain pending; ordinary-play zero-debt reachability is still unresolved.

## SF-070 — final scheduled loan payment does not replenish available credit

**Status:** confirmed store-order discrepancy; native preserved; complete credit lifecycle and correction deferred.

Scheduled payment subtracts the installment from principal at `0xc5e2..0xc5fa`. On reaching zero, it clears installment `6190:b3b2` at `0xc657/0xc65b`, then reloads that now-zero amount at `0xc663` and adds it to available credit `b394` at `0xc670/0xc675`. Earlier installments add their full amount. Borrow-confirmation subtracts borrowed money from this credit at `0x46faf/0x46fb3`, and the selection limit uses it at `0x46ef4..0x46f0c`. The full credit recalculation lifecycle is still untraced, so persistence/duration of the lost replenishment is not proven. Native scheduled payment preserves this order and tests principal below/equal to the installment; no security claim is made.

## SF-071 — monthly loan arrears payment omits normal balance and town updates

**Status:** confirmed divergent accounting paths; native preserved; full lifecycle impact and correction deferred.

On-time scheduled payment `0xc5b4..0xc675` reduces principal, allocates half/quarter of the installment to town funds and restores available credit. Failure copies the installment to overdue balance `2d9f:d5ba` and sets a countdown. Monthly successful retry `0xccba..0xcce6` only posts category 1000, clears overdue amount/countdown and emits notice 170. It does not perform the principal/credit/town updates; forced-sale success similarly clears the overdue state separately. Thus the local sequence accepts cash without applying the normal loan-account changes. Later credit/loan recomputation and UI consequences remain untraced, so no claim of irreversible player loss is made.

Native scheduled and monthly primitives preserve the distinction. A composed regression establishes arrears then pays them, confirming that principal and town state do not change through the retry. Revisit at full loan integration, retaining this source evidence if corrected.

## SF-072 — new scheduled failures overwrite arrears and restart the countdown

**Status:** confirmed state replacement/timing interaction; native preserved; ordinary-play consequences and correction deferred.

Failure always assigns countdown four at `0xc586` and replaces overdue amount at `0xc59d/0xc5a1`, without adding prior arrears or checking the old countdown. Caller due months are 0, 2, 6, 9 (`0xd005..0xd029`), with gaps of 2/4/3/3 months. Monthly retries run first. A further failure less than four months later can therefore postpone expiry and replace an existing demand rather than accumulate it. The four-month gap can reach forced default before the next scheduled attempt. This is an accounting/control-flow quirk, not a proven security vulnerability.

Native failure retains replacement and the countdown value four, with tests starting from different existing arrears. Full calendar/borrowing integration will need to test player-visible consequences before deciding on a correction.

### SF-070 credit recalculation follow-up

Loan dialog `0x47028..0x47030` recomputes available credit through thunk `12c6` → `0x3da08` before displaying it. The native borrowing-limit calculator now follows that unsigned land/building valuation. This confines the proven final-payment omission to cached available credit; it does not prove permanent credit loss after the dialog recalculates. Preserve the scheduled-payment ordering and revisit other consumers.

## SF-073 — installment calculation wraps before signed division and can divide by a wrapped-zero term

**Status:** verified arithmetic boundary behavior; normal borrowing inputs do not establish a reachable failure; native wrap preserved, zero divisor guarded.

Calculator `0x476e2..0x47754` retains only 32 product bits, interprets them as signed for division by 100, adds principal with wrapping, then divides by a sign-extended 16-bit `term<<2`. Large/rate-mutated inputs can therefore yield negative raw installments. A nonzero principal with term 0 or a multiple of 16384 divides by zero. Known borrowing callers pass term five; source rate initialization is 15 and annual rates are 8–15, with the ordinary cash cap restricting borrowed amounts. Neither boundary is demonstrated reachable through that normal UI.

Native calculation preserves overflow/sign behavior with independent integer-oracle tests, but rejects the zero-divisor term before evaluating it. Zero principal still returns zero first. Do not label the helper's unusual arithmetic as a proven exploitable vulnerability. Full caller/input recovery remains pending.

### SF-065 / SF-060 financial checkpoint follow-up

Native fresh imports now explicitly start building book value from the executable's initialized zero, without guessing a saved field or summing building prices. The original indirect/warm-load lifecycle remains unresolved; this cold-import policy is not proof that the original always loses the ledger. Native checkpoint version 3 independently persists the live ledger and does not reset it on restore. The same checkpoint now preserves the bounded clearing queue and its explicit empty-sentinel initialization (SF-060), including all inactive/unused coordinate bytes. Actual clearing animation remains unconnected to the live clock.

## SF-074 — full loan payoff leaves the overdue installment active

**Status:** confirmed independent state paths; native preserved; ordinary UI sequence impact awaits integration tests.

Full payoff `0x47623..0x4768a` debits principal and clears `6190:b3ae/b3b2`. It never clears overdue amount `2d9f:d5ba` or countdown `4d9f:fed6`, set by a failed scheduled installment. Monthly retries still consume that separate amount. Paying the main balance while an installment is overdue can therefore leave another payment due. Native payoff preserves those fields; the loan UI should show the separate overdue balance instead of implying that all debt disappears. Revisit any correction together with SF-071; no security claim is made.

## SF-075 — borrowed cash-cap arithmetic can wrap in malformed/extreme states

**Status:** arithmetic boundary confirmed; normal UI reachability unproven; native command guards capacity.

Selection `0x46f21..0x46f43` wraps cash plus proposed loan before comparing with 9,999,999, and can subtract already-excessive cash from the cap. Ordinary source cash/credit constraints do not establish reachability of these extremes. Native submission computes nonnegative remaining capacity before clamping a request, rejecting already-full/over-cap cash without mutation. Tests inject maximum dwords to ensure this boundary cannot mint cash. Normal original borrowing and rounding remain unchanged.

### SF-069 / SF-074 live loan follow-up

Live monthly default now pauses before later financial/weather/crop phases and persists an unpaid terminal decision in checkpoint v4. End-session choice never turns into successful payment; restart reconstructs a fresh source farm. Integration tests preserve the home and debt through actual unpayable sales, same-frame suspension, save/load and both single-use choices. The Loans panel separately displays arrears and explains that main-loan payoff does not clear them (SF-074); the source accounting behavior remains preserved pending any explicit correction.

## SF-076 — annual region-count report sign-extends byte totals

**Status:** verified arithmetic boundary; normal player reachability and displayed impact unproven; native annual words preserve the boundary, correction deferred.

Annual routine `0x1f4d2..0x1f573` counts ownership codes 1 and 2 across the 12×12 world in bytes `6190:7510/750f`. Report routine reads the player byte at `0x1f589`, uses opcode `98` (CBW in this 16-bit code) at `0x1f58d`, and stores AX at `0x1f58e` to `6190:4460`. The town byte follows at `0x1f59f`, CBW `0x1f5a3`, store `0x1f5a4` to `4464`. Thus totals 128–144 become signed words -128 through -112, although they fit the unsigned count byte. The routine uses these signed values in subsequent word differences (`0x1f5af`, `0x1f5bd`). Segment pointers for these counts resolve to `6190` in initialized DS.

No claim is made that ordinary land purchases can achieve every such total, that a negative number is necessarily displayed, or that this is a security vulnerability. Live native town development does not use these report words. Annual report field ownership, original persistence, downstream rendering and reachability remain to be traced before deciding whether to preserve or correct this boundary; keep the evidence even after a future fix.


### SF-042 / SF-048 / SF-049 annual integration follow-up

Live annual reset preserves worker expenses (SF-042), after collection and any district choice. The native chooser keeps the reserved plot pending when random selection hits an unavailable recreation type, correcting the original unchecked timeout return (SF-048); the bounded RNG draw still persists. The button invokes that original random branch explicitly, without claiming a recovered real-time timeout.

Pending-choice tests exposed a distinction for SF-049: an original unowned plot can retain low nibble 15 when ownership is reserved before construction. Native v6 preserves that raw byte and permits it only under a validated, frozen pending continuation. The constructor replaces it before normal weekly development resumes. Rejecting it as an already-built district would prevent loading a valid mid-choice save; the active built-district guard remains in place after construction.


### SF-060 / SF-061 / SF-066 live clearing follow-up

The live clock now advances the persisted clearing queue, retaining the corrected empty sentinel and bounded 64-slot traversal (SF-060/061). Original changing-count retirement remains observable: a full 64-entry field retires 33 entries on its first finishing update, then 16, 8, 4, 2 and 1. Word-wrap and mid-animation save/load tests exercise the actual GameSimulation clock.

SF-066's overwritten low-tile entries remain pending in the live queue by an explicit fidelity decision; no cleanup is inferred merely from a non-animation tile. Native scanning is bounded, so malformed counter/slot combinations cannot recreate an unchecked scan. A future enhancement may retire overwritten entries, but source behavior and this evidence must remain documented.

## SF-077 — annual field-status aggregation trusts a count without bounding slots

**Status:** confirmed unchecked scan pattern under inconsistent count; ordinary reachability/impact unproven; bounded native scan implemented in weekly and annual paths.

Routine `0x1f020` initializes slot to 1 (`0x1f047`) and encountered-active count to zero. It tests field active bit at `0x1f070`, reads +54 at `0x1f078`, and increments the encountered count only for active slots (`0x1f09f`). Every iteration increments slot (`0x1f0a2`). The loop compares the encountered count against signed `6190:3e3e` at `0x1f0ac/0x1f0b1`, with no check against the 98-record field table or last usable slot 97. An inconsistent positive declared count can therefore continue reading beyond field storage while searching for enough active records.

This is static evidence of an input/state-boundary hazard, not proof that ordinary play produces the mismatch or that it is exploitable. The live native clock does not yet run this aggregate/advice routine. Its reconstruction must traverse decoded field slots 1–97 once and derive active counts, preserving valid-record order/status arithmetic without reproducing the unchecked access. Revisit original count producers/loader and the downstream report/helper before assigning broader impact; retain this entry after the bounded implementation is added.


### SF-077 bounded report implementation

The live Farm report now uses `summarizeFieldStatus`, which visits real slots 1–97 once and never reads a declared source count. Tests include the last legal slot, all 97 active records, an active sentinel record excluded from aggregation, inactive high-bit records and malformed table shape. This implements the scan-bound fix for current reporting; the annual wrapper/cache and automatic music integration remain pending. Original valid status masks, separate bit counts and unsigned cash thresholds are preserved.

## SF-078 — annual asset rating returns an unclassified low word above its upper threshold

**Status:** verified arithmetic/control-flow boundary; ordinary reachability and downstream display impact unproven; native annual rating preserves the boundary, correction deferred.

`0x3cc20` calls broader asset helper `0x3d980`, then classifies its signed nonnegative result into 0–7 for ranges ending just below 1,000,000. Final comparison at `0x3ccf8..0x3cd02` accepts only values below `000f:4240`; values at or above that bound jump to `0x3cd07` without assigning a rating to AX. AX still holds the original low value word. At exactly 1,000,000 the return is therefore `0x4240` (16,960), rather than a value 0–7. Annual report `0x1f5c8..0x1f5d1` subtracts its previous `4454` word from that AX and stores the result.

The native clock now executes this rating wrapper and preserves its raw return word (see follow-up below). Reachable asset totals, downstream presentation and intended behavior at the upper bound remain to be traced before deciding whether to preserve or cap it. This is not a proven ordinary-play defect or security exploit. Preserve this evidence and the distinct signed broader-asset calculation when adding the bounded native implementation; do not silently substitute the borrowing-credit formula.


### SF-076 / SF-077 / SF-078 persisted annual statistics follow-up

Version-7 statistics now preserve the original signed region-count words (SF-076) and asset-rating upper-range AX fallthrough (SF-078) in the live annual continuation. Tests include 127/128/144 regions, exact million-value threshold, repeated recurrences and raw checkpoint words. The native code never uses that unclassified word as a table index. No cap or unsigned reinterpretation is applied; original downstream presentation, normal-play reachability and intended upper-range behavior remain deferred.

The bounded aggregate correction (SF-077) now runs weekly before water/status refresh and again in the annual wrapper. It scans valid slots 1–97 rather than trusting a changing declared count. Its original raw presence/count caches persist separately from the current UI report. Native save validation bounds all cached storage while allowing historical values to differ from current map/fields. The original unchecked pattern remains documented above; no exploitability is inferred.

## SF-079 — annual homestead update skips cash at or above 999999

**Status:** verified unsigned caller boundary; preserved natively; intended behavior and ordinary-play display impact unresolved, correction deferred.

The final band at `0xceff..0xcf10` compares high word against 15 and low word against `0x423f` (999999), branching past the update for greater-or-equal. The highest house rank is therefore selected only for 750000–999998. Higher balances retain the previous remembered rank and terrain; there is no highest-rank clamp. Native cash capacity exceeds this boundary, but that does not establish original intent. This is a visible arithmetic/control-flow edge, not a security vulnerability. `homesteadRank` preserves the skipped update and tests exact boundaries.

## SF-080 — homestead repaint trusts saved coordinates and a rank-dependent local

**Status:** unchecked addressing/control-flow pattern confirmed; malformed-input reachability and original impact unresolved; native bounds checks implemented.

`0x1f313..0x1f33c` calculates terrain addresses from saved origin words `2d9f:000c/000e` without checking the 96×96 map. Loader `0x4604e..0x4607b` restores those words. Offsets reach origin+(3,3). The switch at `0x1f478..0x1f492` also permits invalid rank >5 to bypass assignment of local `[bp-2]` before painting. Known annual/startup callers supply only 0–5, so an invalid rank is not established as normally reachable. No exploitability claim is made.

Native import/update restrict origins to 0–92 and remembered rank to 0–5 or first-call sentinel 255; cash classification never calls the painter with an invalid rank. Bad inputs reject before terrain/state mutation. Tests include the last safe footprint, the first unsafe origin and invalid rank values. Retain this evidence if later input compatibility work changes the bounds policy.

## SF-081 — full building allocator returns the last occupied slot

**Status:** verified static full-table return; caller preflight/reachability unresolved; native construction fix pending.

Allocator `0x1a0a8..0x1a17d` scans slots 1–126. With all active, the last iteration loads AX=126 at `0x1a137/0x1a13a`, tests its active flag at `0x1a142`, and branches through the byte increment to slot 127. The comparison at `0x1a131..0x1a135` then jumps to LEAVE/RETF without clearing AX. Its result is therefore 126, rather than zero. Generic addition `0x3a347..0x3a34c` treats any nonzero result as success before incrementing definition count and building book value. Whether higher-level UI guards always prevent this state remains to be established; this is not a proven ordinary-play defect or exploit.

Native player construction is not live yet. Its implementation must return a clear allocation failure and preflight a free slot before debiting cash, modifying counts or painting. Preserve the exact original initialized/retained record bytes on successful allocation. Revisit the higher-level placement/capacity checks while wiring construction and update this entry with the chosen correction and tests.

## SF-082 — building rectangle query scans a dense prefix without active checks

**Status:** verified scan structure; caller/deletion lifecycle and ordinary impact unresolved; native construction handling pending.

Rectangle query `0x1a17e..0x1a243` begins at slot 1 with visited count zero. It reads each record's type and definition dimensions, compares its coordinates with the requested rectangle, then increments both slot and visited count (`0x1a22e/0x1a231`). The only loop limit compares visited count to global building count `6190:2430` (`0x1a234..0x1a23d`); there is no active-flag test or independent slot bound in this routine. Under a sparse table, it can consider retained inactive coordinates or omit active records beyond that prefix. An inconsistent large count could also exceed record storage.

The source instructions establish those conditional outcomes, not that all relevant callers encounter sparse or inconsistent state. Revisit compaction and caller guards while tracing construction. Native placement should scan bounded active records and validate their definitions before mutation; no construction implementation is claimed yet. Keep this evidence even if later caller tracing shows the original path maintains a dense prefix.


### SF-081/082 native construction update

Storage purchase now preflights a free slot before debit/allocation and uses the existing bounded active-only `findBuilding` query over all127 records. Tests include inactive retained coordinates, a high active slot beyond a sparse prefix, and a full table. Rejection leaves records, cash, counts, terrain and accounts unchanged. The static original conditions above remain verified; whether all original UI callers avoid them is still unresolved. Construction UI integration is the next increment.

## SF-083 — rejected purchase can leave clearing costs/terrain and mismatched refunds

**Status:** verified static ordering and conditional accounting mismatch; corrected by native atomic preflight. Ordinary reachability of every refund branch remains unresolved.

Purchase `0x1cb42` debits first, then invokes automatic clearing for every footprint tile before allocation and terrain validation. A tree can be cleared and charged ($25 through category500 at `0x26aaa`) before a later footprint tile rejects placement. Painting failure deletes the added object and refunds the building price with its original category at `0x1cc49/0x1cc5b`; it does not restore cleared trees or their worker charges. In the separate zero-allocation branch `0x1cca0..0x1ccae`, the price refund uses category0, so a successful prior building debit to `3e90` would not be reversed. SF-081 means full building capacity is not itself proof of reaching that zero-return branch.

Native storage purchase validates the whole transaction before mutation, including ordered post-price tree affordability, map eligibility and free record capacity. Failed placement changes no terrain, record, definition count or account. Tests explicitly retain the pre-failure complete state. No security exploit is asserted; revisit non-building generic purchase callers and original UI preflight paths.

## SF-084 — multi-cell building UI rejects cash exactly equal to its price

**Status:** verified original comparison/path distinction; preserved as an arithmetic/UI quirk.

The ghost-placement path sign-extends the price at `0x22451`, compares its high cash word, then branches on unsigned price-low >= cash-low at `0x2245f/0x22464`. Equality is rejected even though debit `0x1c88e` accepts an equal amount. The one-cell click path calls purchase directly (`0x24af6`). Native storage requires extra cash for a multi-cell footprint, preserves equality for the 1×1 building, and explains insufficient cash in the UI. Tests cover price−1/price/price+1 where relevant. No overflow exploit or security vulnerability is claimed.

## SF-085 — building ownership validation checks only the origin

**Status:** verified static ownership rule; preserved pending a deliberate enhancement decision.

Terrain validation iterates the footprint at `0x1ce04..0x1cf0a`, but ownership at `0x1cf17` reads only `(x,y)`; the UI repeats only this origin check at `0x22473`. A clear eligible footprint may extend from owned origin land into unowned neighboring cells. Type70 also has an explicit origin-ownership exception. Native storage retains the origin rule and tests a partially unowned footprint; it still rejects out-of-map coordinates and occupied buildings. This is an apparent gameplay loophole, not a proven security vulnerability. A future full-footprint ownership requirement would be an intentional native correction, not recovered original behavior.


## SF-086 — irrigation merge adds a packet again after saturation

**Status:** verified arithmetic sequence; ordinary reachability and intended behavior unresolved; native fix deferred with irrigation reconstruction.

In the zero-outgoing-neighbor branch of flow consumer `0x17b3e`, a second ring entry is popped at `0x17ca4`. `0x17cae..0x17cc5` sums the two unsigned byte strengths into a word and clamps at255. `0x17cc7..0x17cd0` stores its low byte, then adds the second strength again into that byte. Thus the resulting strength is `(min(a+b,255)+b)&255`, not a saturated sum: a=10,b=20 gives50; a=200,b=100 gives99. Coordinate reassignment and the topology needed to reach this branch still require tracing. Preserve this arithmetic evidence even if later gameplay analysis finds the branch unreachable. Native irrigation is pending; do not substitute an assumed merge rule without a documented decision.

## SF-087 — irrigation source save/load uses stride two for stride-three records

**Status:** verified original saver/loader mismatch with runtime layout; upper-capacity data loss conditional on source count; native import/persistence policy deferred.

Runtime registry add/remove/iteration use three-byte entries at `2d9f:f954`, with capacity64. Saver `0x449d0..0x44a27` and loader `0x459de..0x45a35` instead transfer bytes at `base+2*i`, `+1`, `+2` for i=0..63, writing/reading192 file bytes with duplicated overlap. They cover only runtime bytes0..128, or43 complete entries; entries43..63 are omitted. A save/load with >43 active sources cannot restore the complete registry through this path. Tail bytes may retain earlier runtime state; initialization and other rebuild paths remain unresolved, so ordinary player-visible loss is not yet proven.

SSM count0x210d2 and payload0x210d3..0x21192 must be decoded by the original overlapping writes, not interpreted as packed records. All supplied saves have counts1..9; applying the loader yields plausible source positions/strengths. Native original import must preserve the raw source and document cold/warm tail handling. Future native saves should persist the complete canonical registry independently. No native irrigation implementation is claimed yet.

## SF-088 — a full irrigation flow ring becomes indistinguishable from empty

**Status:** verified index arithmetic; maximum reachable occupancy unresolved; native handling deferred.

Flow append `0x17a78..0x17ac5` writes a three-byte entry at the current write index, increments it and masks with127 without comparing the read index. Pop `0x17ac6..0x17b3c` reports empty whenever the indices match. If enough pending appends advance write onto read, an occupied ring appears empty, and later appends can overwrite pending work. Flow branching can append multiple entries, but topology/consumer scheduling must be analyzed before claiming ordinary reachability. Native irrigation must select and test a bounded capacity policy; preserve this original evidence when that choice is made.

## SF-089 — irrigation source removal shifts one successor beyond the live list

**Status:** verified loop bound; full-capacity out-of-array read conditional on count64; native correction deferred.

Registry removal `0x17944..0x179d9` finds the coordinate, then copies entry i+1 into i while i<count (`0x17962..0x17998`) before decrementing count. It reads the inactive successor of the last live entry, and at count64 reads three bytes beyond the192-byte registry. Only the now-inactive trailing slot receives that copy, so active-list corruption is not established by this routine alone. This is a boundedness hazard, not a demonstrated exploit. Native removal should shift only remaining live entries and preserve/clear inactive bytes under an explicit policy when the registry is implemented.


### SF-086–089 irrigation primitive update

The reconstructed primitive preserves SF-086's exact merge arithmetic. Source import performs original overlapping writes (SF-087), rejects counts whose active tail was not transferred, and retains the source payload; native state can represent all64 entries without that lossy layout. SF-088 is corrected with an explicitly occupied FIFO bounded by the world plus source seeds. SF-089 shifts only live successors and retains inactive bytes. Tests cover these decisions. The original warm-tail lifecycle and ordinary maximum-occupancy/topology remain unresolved; live checkpoint/clock integration is still pending.

## SF-090 — zero-strength irrigation packets re-enqueue indefinitely

**Status:** verified control flow; native primitive consumes zero packets. Particular original-farm topology reachability remains unproven.

Consumer0x17b3e tests packet strength at0x17b71; zero jumps to0x17cd6, whose zero branch falls through to enqueue0x17ce9. No strength or position changes, so a queue containing only zero packets never empties. Junction division0x17b95..0x17b9d can produce zero when strength is less than outgoing-neighbor count, and still enqueues those branches. This can keep the driver active indefinitely, preventing subsequent alternating phases. It is a simulation-liveness defect, not a claimed security exploit. Native marks/enqueues the same branch tiles, then consumes zero packets without propagation. A four-way junction with strength1 is covered through successful completion.

## SF-091 — irrigation reads off-map neighbors and queues unclamped outlets

**Status:** verified unchecked accesses; native bounded reads and consistent outlet clamp implemented in primitive.

Neighbor query0x17636 reads four map words at offsets−2,+2,−192,+192 from the source index before any coordinate clamping. Edge coordinates can alias another column or read outside the map. Enqueue0x17a78 calls clamping marker0x17560, but writes its original coordinate bytes into the ring; a wind source at y95 seeds y96. Subsequent neighbor reads interpret that unbounded coordinate. Native neighbor enumeration ignores cells outside0..95 and stores the clamped outlet coordinate as well as marking it. Edge/corner/word-tick-wrap tests pass. Original ordinary-edge source reachability remains to be assessed; no arbitrary-code execution claim is made.


## SF-092 — special building purchase ignores a full irrigation registry

**Status:** verified caller/capacity behavior; native preflight correction is live. Ordinary UI maximum-capacity reachability remains unproven.

Registry append0x179da returns0 when count6190:240f>63 (`0x179e4..0x179ee`). Purchase types70/71 call it at0x1cc18, discard the arguments and immediately continue placement at0x1cc20 without testing its return. A paid building can therefore be allocated/painted without an irrigation source if the registry is full. Native construction checks capacity before payment, record allocation, clearing or painting and reports the source limit. Tests fill all64 entries, reject a further purchase without changing the complete save, and restore all64 sources from native v9. This is a conditional gameplay defect, not a security exploit.


## SF-093 — land-sale demolition leaves a special building's irrigation source behind

**Status:** verified static omission in the traced land-sale call chain; native cleanup corrected. Wider original deletion callers still need review.

Manual special-building cleanup explicitly calls registry removal0x17944 at0x25a93/0x25ab9; bulldoze also calls it at0x26657. Land sale instead calls content/map cleanup0x19f6a at0x3caa1 and generic deletion0x3a040 at0x3cab9. The latter's building branch0x3a0aa..0x3a0fa updates count/book value and calls0x19f4c, which only clears the active bit and decrements the building count. None of these traced routines removes the irrigation registry entry. A leftover strength48 source can still seed its old outlet when wind permits because the driver checks that strength independently of a live building; a leftover pump entry can also consume source capacity even when it no longer seeds.

Native building demolition prevalidates registry state for types70/71 and removes their first matching source on successful cleanup. Existing packets finish the current pass, matching manual removal's lack of queue cancellation. Tests purchase both types, reject malformed registry state before any sale mutation, then sell the plot and verify no source/wave restarts. Original omission evidence is retained. Manual field/building removal now directly exposes the verified registry cleanup through native commands and controls; original source deletion packets are allowed to finish. Exact ordinary-game incidence of the land-sale omission and other disaster/loose-asset deletion paths remain to be assessed.

## SF-094 — irrigation image connectivity ignores its fifth pump entry

**Status:** verified table/loop mismatch; visible intent uncertain; native preserves source behavior.

DS6190:56ae has five category entries:83/11,84/11,128/0x22,129/0x24,61/0x22 (dry, wet, bridge, valve, pump). Both neighbor helpers0x24b54 and0x24cf4 stop at index4;0x24cd1 explicitly compares the byte index with4. Pump120..121 therefore does not contribute a connection bit although the subsequent table entry describes it. Water propagation independently accepts those tiles at0x17636. This is an image/connection quirk, not proof of broken water delivery or a security vulnerability. Native placement retains the four-entry limit; a pump-only adjacent cell does not turn the new ditch image. Revisit original visual expectations before choosing an enhancement.

## SF-095 — automatic map-tool clearing precedes placement rejection

**Status:** verified mutation order; native irrigation placement rejects atomically.

Click path0x24210..0x24229 invokes auto-clear0x26faa before town/terrain guards0x24266..0x242a9 and the later price debit. The helper can remove trees and spend25, then the selected tool can fail its placement or affordability checks. With105 required for a paid tree plus an80 ditch but only104 cash, the source can clear and charge25 without creating the ditch. Native preparation checks the final terrain, clearing affordability and full purchase first, preserving all state on rejection. Both source tree categories still require25 available before clearing, and only535..538 debit it on successful placement. Tests cover104/105, free trees, flags and no mutation on rejection. This is a gameplay transaction defect, not a security claim. Other map tools retain their separately documented status; broader auto-clear entry points remain to be audited.

### SF-056 / SF-083 / SF-095 follow-up — animal purchase boundary

Native animal purchases expose only the four ordinary definitions160–163; the fifth duplicate-type definition remains intact and unclassified. Source allocator0x11a76 bounds its slot scan at256 and returns0, unlike the building allocator (SF-081). However generic purchase still allocates and consumes two random values before final placement failure, followed by the rollback paths previously recorded in SF-083. Its one-cell UI can clear trees before any payment/placement check, as in SF-095. Native preflight checks the complete operation before mutating RNG, records, world or ledgers. Tests cover full capacity, invalid land/terrain, exact original initialization and rejected-state identity. No new security implication is claimed.

## SF-096 — animal supply image can satisfy consumption without an inventory record

**Status:** verified branch; malformed/stale-map reachability in ordinary play unproven; native consumer corrected and connected to live care.

Supply scan0x12ea0 finds terrain base08fc+1 (176), looks up an inventory record at0x12f7f, then branches on zero at0x12f8c directly to success0x12f2a. Consumer0x12a4e treats that return as replenishment and clears animal byte+14 at0x12ae6. A matching image with no live inventory record can thus satisfy the need without consuming quantity. Valid placement normally allocates an inventory record; broader deletion/painting paths need auditing before asserting normal-game incidence. The analogous feed path0x131fe..0x13203 skips missing records instead. Native consumption now requires a matching active supply record with supported type and positive quantity; tests cover absent, empty and mismatched records. Live frame care uses the corrected consumer. This is a conditional gameplay consistency defect, not a demonstrated security vulnerability.

### SF-059 follow-up — animal needs traversal

Odd-day needs routine `0x12d8e` increments its slot index until the number of active records reaches DS230c (`0x12e4d..0x12e5b`), without an independent256-slot limit. A count exceeding available active records permits an out-of-table scan; ordinary-game reachability of that inconsistent state is unproven. Native need updates use the bounded decoded animal array and prevalidate ordinary types before writes. Sparse slots252–255 and unsupported-type atomic rejection are tested. This is separate from the proven changing-count problem in default sales; no security exploit is claimed.

## SF-097 — herd-centre accumulation overlaps count bytes and shifts species

**Status:** verified initialized segment pointers and address arithmetic; full visible movement consequences unmeasured; native movement policy/fix deferred.

Frame wrapper `0xdf48` clears four count bytes at DS22f8–22fb and four coordinate pairs at DS22fc–230b (`0xdf83..0xdfaf`). Its accumulation instead uses count address `0x2257 + animal.type` and word sums `0x2078 + 4*animal.type` / `+2` (`0xdfd3..0xe000`). For supported type160 these are count22f7 and sums22f8/22fa, so its coordinate writes overlap the count array and its own count is outside the cleared bytes. Types161/162/163 accumulate pairs22fc/2300/2304; the fourth pair2308 receives no ordinary species. The pointer words at DS:c6f4 and c6f6 both initialize to6190, so this is actual same-segment overlap, not two similarly named arrays in different segments.

The averaging loop reads counts as signed bytes and skips values<=0 (`0xe025..0xe033`), divides the cleared-array pairs by those counts, then adds two visual-RNG values&3. Type160 can therefore alter another species' divisor; counts>=128 also skip averaging. Movement's switch `0x12080..0x12143` reads22fc for161,2300 for162,2304 for160 and2308 for163, adding a separate producer/consumer mismatch for160/163. Purchases create ordinary types160–163, so the address collision requires no invented fifth species. The exact downstream visible effect and any additional writers require further tracing. This is demonstrated state overlap/arithmetic inconsistency, not a demonstrated security vulnerability. Retain source evidence even if native movement separates and corrects these arrays; that implementation decision remains pending.

### SF-059 follow-up — animal frame loop shortens when care deletes records

The frame pass increments its processed counter even after health deletes an animal (`0xe248..0xe250`), then compares it against the now-smaller active count (`0xe256..0xe264`). With two initially active animals, death of the first makes processed=1 and active=1, ending the pass before the second. This is an ordinary conditional skipped-update behavior, distinct from the out-of-bounds default scan. Native frame traversal is not implemented yet; use bounded records and explicitly choose/document whether to preserve the skipped update when integrating movement/care.

### SF-097 implementation follow-up — explicit retained herd cache

`animal-world.ts` now keeps exactly21 bytes for DS22f7–230b and reproduces the verified overlap, signed-divisor test, uncleared first counter, word wrapping, visual RNG draws and consumer mapping. This is ordinary native data processing, not CPU/DOS execution. Tests pin the executable operands and demonstrate a type160 animal writing the other count bytes, the resulting RNG consumption,128-count averaging skip and tick rollover. The mismatch is deliberately preserved for this reconstruction; correction remains deferred. Native v10 persists this frame cache; live clock integration retains the same tested operations.

## SF-098 — animal masked-ground predicate accepts only image962

**Status:** verified table/operand mismatch; native preserves it; gameplay correction deferred.

Walkability `0x13396..0x133b3` requires masked overlay>=table08a2 (graphic34/base962), but its upper bound is table08a8 (graphic37/base946) plus frame count09c3 (16). The inclusive interval is therefore962..962. Ordinary animals have base frames946/962/978/994; the predicate allows stepping onto that one masked image and rejects the other animal frames on otherwise eligible ground. The source does not validate the overlay's owning record here. Visible overwrite/overlap consequences require broader movement/collision analysis; no security vulnerability is asserted. Native tests cover all2048 terrain images with multiple masked overlays and pin the source tables/instructions. A broader animal-blocking correction remains deferred.

## SF-099 — failed storage entry can hide an outside animal

**Status:** verified mutation order; native corrects failed-entry occupancy loss.

Movement detects roof/interior terrain, finds a type68/69 building, clears the animal's old terrain0800 at `0x12346`, then calls generic storage `0x1a596` at `0x1236c`. The storage space search can return false at `0x1a751..0x1a753`; movement immediately returns without restoring old occupancy. The still-active animal can disappear until a later repaint. Native movement checks usable first-fit space before clearing the origin or updating the record. Full-store tests retain animal bytes, building content and the origin tile. Other generic storage callers retain their separate status; this is a gameplay defect, not a security claim.

## SF-100 — coincident pointer direction reads the movement timestamp as a direction

**Status:** verified helper/table boundary; conditional ordinary pointer coincidence; native corrects to bounded direction0.

Direction helper `0x128b8` compares origin−target signs with eight nonzero direction pairs at DS2274. For identical coordinates there is no match; it returns8 (`0x12943..0x12953`). The toward table DS22e0 is followed by the away table, so its index8 happens to read0. The away caller at `0x12111..0x1211e` instead indexes DS22e8+8 = DS22f0, the low movement timestamp. That byte need not be0..7. The pointer can coincide with an animal's tile; exact GUI timing incidence is not measured. Native equal-coordinate direction is explicitly0 for both callers, preventing an out-of-table direction/image on later movement. Tests cover equality and all eight surrounding directions. This is an out-of-table read into a known adjacent global, not proof of a security exploit.

### SF-059 animal-frame implementation follow-up

Native `advanceAnimalFrame` visits the bounded initial active slots once. Death of an early slot no longer suppresses later slots in the same frame. A two-animal regression verifies both care/deletion calls and exact definition-count cleanup. This intentionally corrects the skipped-tail behavior while retaining the original16-tick gate,320-tick herd refresh and movement-before-care order.

## SF-101 — trough refill discards unused reservoir contents

**Status:** verified helper mutation and ordinary source quantities; native partial-withdrawal correction implemented and live.

Empty-trough refill at0xc2e0 requests64 from helper0x1a244 and doubles its return into inventory quantity. The helper finds active type72 buildings with nonzero word+10. At0x1a29e it caps its returned total to the requested amount, but0x1a2a5 unconditionally clears the entire supplying building's word+10 instead of subtracting the amount actually delivered. Thus a reservoir containing more than the remaining request loses its surplus. This is direct instruction evidence; the production routine and normal reachable contents still need tracing before quantifying ordinary gameplay loss. No security claim is made. Native automatic refills are not implemented yet; revisit partial withdrawal, source arithmetic and open-interior repaint together when implementing them.

Follow-up source-data evidence: original SSM building records at0x5fc7+slot*70+10 already contain above64 quantities. SCEN0 slots19–21 contain250/255/255; SCEN3 slots1–2 contain255; SCEN5 slots6–17 contain50 followed by eleven255 values; SCEN6 slots11–14 and SCEN7 slots4–6 contain255. Each is active type72. Production0xc4e6 adds50 and caps at255 when adjacent to a wet ditch. Thus above64 contents are ordinary source state, not merely a malformed-save hypothesis. A64 withdrawal from a255 record discards191 stored units; native refill correction and its regression tests remain pending.

Implementation follow-up: native `withdrawStoredWater` subtracts only the actual contribution and repaints an open store from its remaining quantity. Weekly inventory uses that corrected helper, retaining source slot order,64 request, doubled delivery, partial shortages and no top-up for nonempty troughs. Primitive tests exercise multiple stores/troughs and live/browser tests retain191 after a normal255→64 withdrawal. The earlier pending notes above record the discovery sequence; this fix is now live. No original evidence is removed.

## SF-102 — supply purchases have no matching expense category

**Status:** verified accounting omission/quirk; intent unresolved; native preserves cash-only posting.

The ground feed/water handlers call generic purchase0x1cb42 with definition type300/299. Debit0x1c88e subtracts cash and dispatches expense categories at0x1c900..0x1ca20; neither type matches any category. Allocation0x3a468..0x3a4c8 increments goods counts without another expense posting. Successful supplies therefore reduce cash without directly increasing annual expenses in this transaction. This is not proof of an unintended original bug: later lifecycle/report treatment remains incomplete. Native purchase preserves the verified behavior and tests unchanged annual/statistical ledgers. Any accounting correction is deferred pending that wider evidence.

## SF-103 — water storage probes neighbors without map bounds

**Status:** verified coordinate alias/out-of-map reads; native ignores absent neighbors.

Producer0xc3cf/0xc41c/0xc469/0xc4b3 reads four terrain words using offsets−2,+192,+2,−192 from its map cell, with no preceding bounds check. A valid building at(1,0) therefore treats(0,95) as its northern neighbor; at outside edges a probe can leave the terrain array. Generic one-cell placement permits map-edge coordinates. A wet ditch in the aliased cell can incorrectly produce stored water. Native enumerates only valid cardinal neighbors; tests cover corners and that cross-column alias. This is a bounded native correction, not a demonstrated arbitrary-code execution vulnerability.

## SF-104 — weekly age words and water production wrap

**Status:** verified arithmetic quirks; preserved natively; correction deferred.

Weekly0xc058 increments building word+8 before comparing with1020. At65535 it wraps to0 and byte+6 becomes0 for a building not already flagged2. Inventory age word+6 similarly wraps at0xc344. Production0xc4e6 adds50 in16 bits before capping at255: prior65486 produces0 and prior65535 produces49. Ordinary produced water stays0..255, so the latter cases require inconsistent/modified retained state; age wrap requires extremely long-lived records. These are not proven security vulnerabilities. Native tests explicitly preserve the arithmetic and unknown prior words; revisit only with an intentional compatibility policy.

## SF-105 — water storage starts with the generic floor-image value217

**Status:** verified shared-field initialization quirk; intent unresolved; preserved natively.

Allocator0x1a0fc writes217 to all twelve building graphic words, including word+10. Type72 uses that first word as water quantity in production0xc4e6 and withdrawal0x1a28b. Its ordinary purchase path does not reset it, so a newly purchased water store starts with217 units despite no collection yet. This is verified initialization/consumer overlap, not proof of an unintended exploit: initial water could be intentional. Native construction preserves217 and all other initialized/retained bytes. All-eight-farm and browser construction tests verify it. Any change to start empty is deferred rather than silently imposed.


## SF-106 — old-age deaths leave species counts stale

**Status:** verified direct-call accounting omission; native lifecycle corrects the species count.

Weekly animal aging clears terrain occupancy at0xc1fa, then calls0x11b4c directly at0xc203. That helper removes stored content, clears active32 and decrements the global live count; it never decrements the per-species definition count. Generic removal0x3a10a normally performs that decrement at0x3a131 before calling the same helper. Old-age death therefore leaves definition counts larger than the actual population. Native old-age removal shares the validated care cleanup and decrements the species count. Tests cover all four lifespan boundaries and multiple same-week deaths, including stored animals. The shrinking-count skipped-tail defect is separately corrected under SF-059. No cash or speculative DS3e5c reversal is added.

## SF-107 — full animal capacity ends pregnancy without a newborn

**Status:** verified capacity behavior; intent unresolved; preserved natively with explicit feedback.

Gestation0x12d0e/0x12d39 clears pregnancy and resets its counter before the queued allocation pass. At0x12d72 it calls generic addition but never tests its result. Allocator0x11a76 returns0 if slots1–255 are full, so the pregnancy ends without producing a record and without a deferred retry. This is a gameplay capacity rule/quirk, not a demonstrated security vulnerability. Native preserves the original phase ordering and pregnancy reset, emits a birth-capacity notice, and consumes no initializer RNG or asset posting when allocation fails. Tests cover a full table and a high-slot parent producing into a free low slot. Any alternative retry policy remains deferred.

### SF-104 animal-counter follow-up

Weekly animal age0xc196 and gestation byte0x12cfa also wrap before comparisons. Age65535 becomes0 without clearing an already-set adult image byte18; gestation255 becomes0 without giving birth. Normal lifespan deletion and gestation completion happen much earlier, so these wraps require inconsistent/modified retained state rather than ordinary long-lived animals. Native preserves the exact arithmetic; boundary tests pin it. No additional vulnerability claim is made.

## SF-108 — animal avoidance reads uninitialized pointer coordinates outside a map window

**Status:** verified control-flow/stack-local omission; visible DOS incidence unmeasured; native corrected to the defined absent-window fallback.

Movement0x11bce initializes many stack locals but not words[bp−28]/[bp−2c]. With no current window,0x1206e initializes those words to0. With a current window, failed interior tests0x11fb0/0x11fd6/0x11ff8/0x12019 and unsupported types at0x12029 jump directly to0x12076. Only the accepted map-interior path writes coordinates at0x12048/0x12067. Subsequent distance/direction calls read both locals, so those rejected paths use prior stack contents. Static evidence establishes the undefined read; exact visible consequences and GUI timing are not measured. Native validates live coordinates and maps absent/outside input to the original defined(0,0) case. Tests cover pointer exit/blur and equal-position handling (SF-100). No exploitable security vulnerability is asserted.

### SF-104 equipment/chemical follow-up awaiting integration

Equipment0xbf2f increments word+18 with16-bit wrap before comparing against4;65535 therefore becomes0 without wear. Ordinary weekly processing resets values above4, so this extreme input requires inconsistent/modified state. Chemical0xc120 increments word+10 and0xc125 increments byte+9 without saturation, producing65535→0 and255→0. These operations and record offsets are verified; chemical-byte consumer semantics and ordinary visible consequences remain unresolved. Native equipment/chemical weekly integration and any intentional correction are deferred to the next increment. Do not classify these raw arithmetic facts as demonstrated exploits.

### SF-104 chemical consumer and native primitive follow-up

Helper0x1454e reads chemical byte9 and computes band3−(byte9>>6), while its price return and consumption0x146e0 do not scale by that byte. After256 weekly increments a retained chemical therefore regains the best condition band. Allocation0x14590 resets byte9 through word+8 but leaves word+10 unchanged, retaining a reused slot's prior age counter. These are verified arithmetic/initialization quirks with uncertain intent, not a demonstrated exploit or loss of treatment strength. The native weekly primitives preserve wrap and unknown bytes; any policy to saturate, expire or reset chemical age is deferred explicitly.

### SF-059 weekly equipment follow-up

Weekly0xc016 increments processed count even after sale deletes an equipment record;0xc023 compares against the reduced active count. Two initially active worn-out machines can therefore leave the second unprocessed. Native weekly aging visits the bounded initial active list, matching the existing animal/default traversal correction. Tests age/sell every original machine across all eight farms without skipping later slots.

### SF-083/084/085/095 follow-up — manual equipment purchases

The shared purchase/placement routines also serve machinery types0..7. Direct source tracing confirms the same destructive pre-placement clearing (0x1cb42/0x24224), multi-cell cash-equality rejection (0x22464), and origin-only ownership check (0x22473/0x24ad5). These are not building-only paths. Native equipment purchases retain equality/ownership quirks and preflight allocation, terrain and storage before cash/record/clearing changes. The equipment allocator0xf8be is explicitly bounded to slots1..126 and returns0 when full; unlike SF-081, a full equipment table reaches generic zero-allocation refund. For equipment category0..63 that category0 refund uses the same expense account. No separate equipment refund-category drift or security vulnerability is inferred. Ground and rotated-storage rejection/continuation tests cover the native policy; original defects remain documented.

### SF-104 follow-up — aircraft service arithmetic (implementation deferred)

Fuel payment0x309c1..0x309d6 uses a wrapping word subtraction255−fuel, multiplies by DS65f6, and discards the high product word. Repair0x30d4d..0x30d62 similarly discards the high word of condition×signed byte DS65f8. Initialized rates1 and10 with normal fuel0..255/condition0..255 do not overflow; no reachable service exploit is established. Payload loading0x30cef..0x30d08 instead retains both product words. Future service reconstruction must preserve these distinctions, bound/validate native service inputs, and examine field/flight writers before claiming a reachable arithmetic defect. No service fix is yet implemented.

## SF-109 — aircraft service selection is global rather than tied to the loaded plane

Status: retained source behavior; possible unequal-price refund mismatch documented, correction deferred. Confidence: high on data flow; no profitable exploit demonstrated in the supplied farms.

DS65fa/65fc initialize to chemical221 and persist across service windows. Readers0x30686/0x30940 obtain the current unit price from this global definition, not equipment word+34. Chemical switch handlers0x30a08/0x30a7e/0x30ae4 multiply the selected aircraft's payload by that prior shared price, refund its low word, clear payload, then change the global selection. Another plane can therefore change the selector independently of the first plane's retained loaded type. All four chemical definitions cost200 in all eight supplied farms, so these source states do not establish a monetary mismatch. A test with unequal saved definition prices verifies the conditional mismatch without claiming normal-game price variation or a security vulnerability. Native currently preserves this shared selection explicitly and checkpoints it; correction requires tracing price writers and deciding whether to price refunds from the loaded type instead. Original record word+34 survives selection and changes only on paid loading.

### SF-104 aircraft service implementation update

Native fuel/payload service preflight rejects out-of-range words above255 without mutation; source arithmetic remains documented. Valid fuel/repair costs retain low-word products; load keeps the full product; switch refunds keep the low word. Original zero-price loading does not fill the tank because its success branch tests a nonzero debit return. Tests cover all these distinctions and retained age after repair. This bounds native transactions without claiming an original reachable overflow exploit.

## SF-110 — first manual-flight spraying interval reads an uninitialized timestamp

Status: corrected in native flight and exercised through the live browser controls. Confidence: high on direct local-variable reads/writes; the first interval's observed DOS timing has not been measured.

Flight0x30f70 initializes movement, wear and fuel timestamps (0x31018..0x3103f), but not stack word[bp−0x3a]. After spraying is enabled at0x31216, the next spraying tick subtracts that word from the animation clock at0x3119a before its first write at0x311c6. Toggle/start handlers do not initialize it. Consequently the first payload-consumption gate can depend on retained stack contents; subsequent gates use a defined timestamp. The native primitive initializes the spraying timestamp to the takeoff animation tick, alongside the other flight clocks. Tests verify its first interval and16-bit wrap. The live simulation clock/checkpoint path uses this same initialization; arbitrary original stack contents are not reproduced. No out-of-bounds write, information disclosure or security exploit is claimed.


## SF-111 — northwest flight clamps horizontal offset using the vertical limit

Status: corrected in native flight and exercised through the live browser controls. Confidence: high on the wrong-axis assignment; exact DOS window configurations and visible incidence are unmeasured.

The northwest branch0x3148d loads horizontal limit byte[bp−0x22] and compares its negation with the decremented horizontal offset at0x31493..0x31499. On overflow,0x3149b instead loads **vertical** limit byte[bp−0x14], negates it and jumps to the horizontal assignment0x3142f. Other westward branches use the horizontal limit for both comparison and assignment. A nonsquare viewport can therefore displace the plane beyond its intended horizontal bound; sufficiently tall mathematical dimensions could produce a negative ground X. The original GUI's reachable dimension limits have not been established, so this is not classified as a demonstrated out-of-bounds access or exploitable vulnerability.

Native uses the horizontal limit for both operations while retaining all other movement asymmetries. Tests pin the offending original instructions and exercise all eight headings at map edges with square, portrait, landscape and odd dimensions. The8-column/40-row northwest example remains at ground(3,3), rather than assigning−17 as its horizontal offset. Original defect evidence is retained after the fix.

### SF-104 manual-flight arithmetic follow-up

Flight wear0x31131 increments byte17 before checking>250. A preexisting255 wraps to0 and avoids wear termination at that gate; ordinary flight stops at251 and normal weekly aging handles maximum wear, so no ordinary reachable exploit is asserted. Fuel uses wrapping16-bit decrement and signed≤0 clamp; valid service quantities stay0..255. Native primitives preserve these source operations and test255→0 wear and zero-fuel timing. Canonical saved-flight validation now enforces fuel/payload0..255 and coherent active aircraft/home references. Live commands and browser flight controls use these same boundaries.

### SF-058 manual-shop reachability resolved

The manual sale list does hide rentals: builder0x4baee selects equipment at0x4c0a6, and0x4bd7a tests flag0x40 before active0x20. All three visible-row buttons0x4c2d0/0x4c346/0x4c38a consume those filtered entries. Confidence is high on this direct list-to-handler path. Generic sale's rental credit/accounting quirk remains, but it is not reachable through this normal shop list. Other callers would need separate evidence before asserting an exploit. Native manual commands use the source filter; generic sale/default/weekly consumers retain their separate policies. Tests pin both the filter and preserved generic distinction. Original evidence remains recorded rather than deleting the entry.


## SF-112 — cancelling object demolition falls through to terrain removal

Status: verified control-flow fallthrough; player-visible incidence remains a hypothesis requiring original interior/terrain combinations to be traced. Native cancellation submits no removal command. No security vulnerability is asserted.

Building confirmation0x25a6e..0x25a72 and field confirmation0x25b74..0x25b78 jump to0x25f40 when the dialog returns nonzero. This skips whole-object cleanup and its25 debit but does not return from the tool. The subsequent terrain-range chain can independently reach the second25 debit0x26222 and terrain replacement0x2628c. Ordinary closed building roofs/field images do not necessarily match these ranges. An exposed matching tile (for example175/176 supply graphics in an open storage view) could therefore be changed after the user cancels without deleting its record; exact reachable content/view combinations and visible consequences are deferred.

Native field/building removal requires an explicit confirmation command against the selected object; deselection/cancellation leaves cash, records and terrain untouched. The original branch evidence remains documented. Revisit this when reconstructing building interiors and the remaining terrain-removal branches, rather than treating the potential desynchronization as a proven ordinary-game exploit.


## SF-113 — terrain removal preserves isolated connection images and skips gate-neighbor repair

Status: verified original visual quirks, retained natively; no security implication. Confidence high on branch conditions, with no claim that an isolated straight tile must have a different intended image.

Neighbor repair0x25398 snapshots the nearby connection types, then obtains each neighbor's own mask. Zero masks skip repaint at0x2541e/0x2548f/0x25503/0x25576; the exact first test0x2541e is pinned. Fixed-orientation table flag0x20 also prevents rewriting gates, valves and crossings. Removing the only connection therefore retains the neighbor's old graphic. The manual handler repairs fences only for177..187 at0x26468..0x2649e. Gate188..191 is accepted for removal earlier but never enters a fence repair call, so adjacent fence images remain unchanged. Native removal preserves both asymmetries; a future visual enhancement may deliberately recompute these images after comparing expected original appearance.


## SF-114 — map movement accepts aircraft that the ground dispatcher never advances

Status: verified handler/dispatcher mismatch; native rejects aircraft ground orders and retains dedicated flight controls. Confidence high on source control flow; exact original cursor availability over parked aircraft has not been measured in DOS.

Equipment point finder0xf7fe tests active32 and the footprint without a type filter. Pickup0x13712/drop0x13c7e reject flags3, not type8; successful drop sets moving2, relocation state1 and manual0800 through0x13d5a/0x13d66. Dispatcher0x14c38 compares the type against7 and skips greater values, leaving type8 outside both driving and towing branches. If this normal map action is invoked on an idle parked plane, that order cannot advance through this dispatcher. No security implication or broader aircraft failure is claimed. Native preflight rejects the action before altering the aircraft/home/map; its existing manual-flight path remains available. Tests pin the type limit and exercise aircraft point selection/rejection.

## SF-115 — automatic equipment allocation can supersede a manual movement order

Status: verified original allocation semantics retained; whether this is an intended work-priority rule or a gameplay defect is unresolved. Confidence high; no security implication.

Manual drop0x13d47/0x13d66 sets moving2/manual0800 but not reserved1. Owned allocator0x1162f tests only low flags09 (reserved1/fieldWork8), alongside rental64, condition and attachment checks. It does not reject moving2 or high manual0800. A healthy, owned, manually moving machine can therefore be selected for farm work before completing its manual trip. Native preserves these rules, with a test checking availability immediately after each ground-type order. Revisit only as a deliberate gameplay enhancement or if another original caller-level exclusion is found; do not silently turn manual movement into an exclusive reservation.

## SF-116 — trough relocation has unchecked selection and early withdrawal branches

Status: source hazards documented; native transfer primitives now correct the pickup/occupancy/content hazards as detailed in the implementation update below. Live commands and browser controls use these corrected primitives. Confidence high on the direct branches, conditional on reachable inconsistent map/storage states for the missing-slot case. No exploit is established.

Trough pickup0x13a50 calls the inventory point finder without testing for a zero result, unlike the adjacent seed/harvest/feed branches. If a trough graphic exists without a matching inventory record, later coordinate/quantity accesses use the captured zero slot. The same pickup calls storage removal0x1aeb0 at0x13a91 before any destination has been accepted, so cancellation or repeated invalid drops can leave the original storage state changed. Drop0x14188 accepts ground15..31 but omits the terrain0800 occupancy guard present for feed/chemicals/seed/harvest. This can repaint ground beneath a masked occupant. Exact cancellation recovery outside this handler and ordinary-game reachability of inconsistent trough states remain to be traced. Future native relocation should validate a matching active record and stage source withdrawal until an accepted drop; retain the source behavior/evidence here after fixing it.

### SF-011 manual equipment movement update

Manual movement preflight validates every cell of the rotated source footprint against both equipment type and slot before withdrawal, then checks destination ownership and source identity without mutation. Tests exercise all original stored machines and a deliberately mismatched second footprint cell. Native rejects malformed storage atomically; no new claim about original loader exploitability is made.


## SF-117 — generic seed insertion bypasses the building-type gate

Status: verified conditional grouping, retained in native supply transfer primitives; classification as unintended storage compatibility remains provisional. Confidence high on instructions and decoded definition types. The earlier note incorrectly named192..215 harvested goods; these are **seeds**, while168..191 are harvested goods. This naming correction is ours, not an original defect.

Generic insertion0x1a596 first checks building types64/65 at0x1a5ca..0x1a5d8 and accepts harvested types168..191 through0x1a5da..0x1a5e6. Building mismatch branches to0x1a5e8, where seed types192..215 can still enter0x1a5fc. Seeds therefore bypass that building compatibility gate whenever first-fit space exists. The later fallback also accepts any item definition into equipment buildings66..69, with the separate coordinate omission recorded in SF-118. Native preserves these destination rules for the16 populated crop definitions; tests cover every building64..72 for seed, harvest and chemicals. A seed in type72 aliases its first content graphic with the retained water word at building+10, as the source record layout dictates. The compatibility rule and potential water/presentation side effects are retained pending an explicit enhancement decision; no memory-safety exploit is claimed.

## SF-118 — generic insertion paints harvested goods in equipment storage without moving their inventory record

Status: corrected in native supply transfer primitives; original evidence retained. Confidence high on direct control flow; exact original user-visible recovery paths remain unmeasured.

Harvested goods168..191 enter the general66..69 storage branch when the64/65 special case fails. The branch0x1a76b..0x1a8b1 changes record coordinates only for animals160..167, equipment0..63, chemicals220..223 or feed300. Harvests match none of these and fall through to0x1a8b1, which still writes their graphic/type/slot into the building. Manual transfer0x13fcf then clears the old source, but no later code corrects inventory+8/+9. The building therefore refers to a crop whose record remains at the old location. Native accepts the same storage destination and updates its inventory coordinates, allowing later sale/removal to address the actual contents. Tests exercise every building type and successful relocation→aging→sale from type67. No unrelated inventory fields are rewritten.

## SF-119 — manual crop insertion leaves the loss-rate flag unchanged

Status: verified flag behavior retained; intended meaning and consistency with all producers remain open. Confidence high on the reconstructed call and consumer, not a proven exploit.

The crop insertion body0x1a626..0x1a6f6 writes inventory coordinates and building contents but does not set inventory byte10 bit4. General storage sets this bit for feed at0x1a8ab and for chemicals in their separate record at0x1a861. Weekly inventory0xc230..0xc362 uses inventory bit4 to choose loss increments1 versus4. A newly created crop with that bit clear therefore continues the4-unit loss increment after manual insertion. Native retains the flag exactly and tests this loss behavior; it does not silently infer bit4 from physical storage. Similarly, chemical ground relocation0x13f37..0x13f95 does not clear chemical bit4 after storage, and native retains it. Further producer/consumer tracing is needed before choosing a correction.

### SF-116 supply movement implementation update

Native trough/feed transfer preflights a matching active record and source content, then withdraws only after a valid drop. Occupied trough destinations are rejected, and source interior floors remain correctly refreshed. The source trough path instead paints grass over the original cell even after an interior withdrawal0x14227..0x1426c. Feed pickup forces source-building slot0 at0x13b6d, so stored feed can leave stale contents when moved out; native releases a matching stored-feed reference on accepted transfer. Tests cover read-only selection, invalid drops and both accepted departures. These corrections run through the live move-supply command and browser controls, with exact saved continuation. Original unsafe branches remain documented above rather than deleted.


## SF-120 — disaster field traversal repeats an inactive slot and skips the active tail

Status: verified loop-control defect on sparse field tables; corrected in live native high-wind traversal. Confidence high on source branches, with original visible incidence not measured.

Disaster dispatcher0x3709e, bit8 branch0x37112..0x37169, initializes record slot1 and processed count0. Inactive test0x37126 jumps directly to0x3715a. Slot increment0x37157 is reached only for active records, while0x3715a increments processed count unconditionally and0x37164 compares it to the active-field count. An inactive slot therefore repeats until the processed count reaches the bound; active records after that hole are skipped. Field removal can leave sparse records, but exact original storm timing after removal is not yet traced. Native uses bounded active-record traversal; tests prove damage reaches active slot5 after inactive intervening records. The source evidence remains retained. No security vulnerability is asserted.

## SF-121 — disaster rendering can read an uninitialized map-window local

Status: conditional original uninitialized-local read; native simulation is viewport-independent and the renderer uses an explicit canvas ref. Confidence high on the missing assignment; reachability of a missing map window while the effect is active remains unresolved.

Dispatcher0x370ae..0x370b7 tests global far pointer13ae/13b0. Only the nonzero branch initializes stack locals[bp−0x10]/[bp−0xe] at0x370c2/0x370c5. The bit20 effect later passes those locals to redraw call0x37215, and tests their combined value0x372c3..0x372c9 before window dereferences. A zero global does not initialize the locals to zero. Native keeps simulation effects independent of drawing; offscreen and absent viewport updates do not use DOS window locals. No null-window DOS configuration or exploitable memory consequence has been established; do not label this a demonstrated security vulnerability.

## SF-122 — disaster trough/feed destruction leaves definition counts unchanged

Status: verified accounting asymmetry retained in the native damage primitive; aggregate consequences remain to be traced. Confidence high on the direct calls. No exploit is established.

Disaster helper0x26598 calls raw inventory deletion0x152b0 at0x2672e and0x26791, rather than generic deletion. That helper clears inventory byte10 active32 and reduces total DS23d8, but does not decrement the matching goods definition count. Later clearing calls do not repair it. Native derives active totals from records and deliberately retains definition counts here, unlike manual bulldozing and building-content destruction. Tests buy both supplies, destroy them and check exact counts, retained bytes and saved continuation. Revisit downstream definition-count consumers before deciding whether to correct this asymmetry.

## SF-123 — disaster clearing of terrain535..538 requires cash and posts worker expenses

Status: verified cash-dependent damage quirk retained; intended design is unknown. Confidence high; no security implication.

At0x26aaa..0x26ab1 the damage helper pushes amount25 and debit category500 into0x1c88e. Failure returns without clearing the tile; equality25 succeeds. Debit category500..503 posts to DS3e88/3e8a at0x1c9c4 (worker expenses), with32-bit wrapping. Other accepted terrain families have no debit. Native retains the charge, low-cash immunity of these four tiles and expense wrap, all covered by tests. The live native caller reports insufficient cash with bounded transient notices; it does not recreate the exact source notice42 dialog. Do not generalize this into a fee on all disaster damage.

## SF-124 — disaster network cleanup omits gate/valve/crossing repair and retains water flags

Status: verified differences from manual removal retained; intended visual/flow semantics remain unresolved. Confidence high on branches; no security implication.

The post-clear repair chain0x26b30..0x26c58 handles road150..171, fence177..187 and ditch87..108 only. Accepted gates188..191, valves122..125 and crossings172..173 never enter those calls. Unlike manual crossing cleanup, terrain2000 is not cleared; unlike manual shoreline cleanup, there is no shore reconstruction or visual RNG. Native follows the disaster-specific chain and tests unchanged neighbor images/high flags. SF-113's shared isolated-neighbor behavior also remains. Revisit as an explicit enhancement only after original disaster presentation/flow has been reconstructed.

## SF-125 — destructive cell helper reads terrain without local coordinate bounds checks

Status: native primitive rejects out-of-map/noninteger coordinates before access; original caller reachability still unproven. Confidence high on direct indexing, conditional on unsafe coordinates being supplied. No demonstrated security vulnerability.

Entry0x265a8..0x265b1 calculates16-bit `x*96+y`, doubles it and reads the map without a local bounds check. Individual disaster callers may constrain their coordinates; those constraints still require complete tracing. Native accepts only integer coordinates0..95 and leaves state unchanged on rejection. Tests include negative,96,NaN and fractional inputs. Retain this entry and revisit each dispatcher caller rather than inferring a reachable overflow from the helper alone.

Moving-caller update: tornado0x3746f clamps its origin to0..95, but0x37482 damages `(x+1,y+2)` without another clamp. An edge origin can therefore pass96/97; the native moving test exercises that exact state and rejects the damage while retaining movement/RNG. Swarm bounds are field origin..origin+5, followed by offsets up to2; ordinary8×8 fields fit, but narrow edge records need the same native guard. A complete natural RNG/trigger route to a DOS edge origin has not been established, so exploitability remains unclaimed.

## SF-126 — random field selection doubles the first ordinal and excludes the last

Status: verified selection bias retained in native moving-disaster primitives. Confidence high on bounded RNG and selector instructions; intended distribution is unknown. No security implication.

Field selector0x1b802 calls bounded RNG0x8273 with the active count, then replaces zero with1 at0x1b827..0x1b82b. The subsequent active-record scan uses a1-based ordinal. The RNG yields0..count−1, so results0 and1 both select the first active field, while the last active field cannot be selected when count>1. Swarm start0x36bb6 and crop-circle start0x36736 both call this helper. Native swarm retains the bias but scans a bounded actual active list, avoiding the source's unbounded scan if a global count is inconsistent. Tests cover256 bounded seeds and sparse slots1/5/97, with only1/5 selected. Crop-circle integration remains pending.

## SF-127 — disaster restart retains animation phase and tornado frame clock

Status: verified retained-state behavior, preserved natively; whether intentional continuity or a defect is unresolved. Confidence high on complete start/stop branch writes; no security implication.

Tornado start0x36874..0x369bb sets position, directions and start tick69a2 but does not write frame6998 or last-frame tick699a. Swarm start0x36bac..0x36ce7 writes position, field and both clocks69a8/69b0 but leaves frame69a6 and direction bytes unchanged. Stop branches clear flags/menu checks without resetting these fields. A restarted effect can therefore damage sooner than four fresh frame iterations, and a tornado may advance immediately when its old frame clock is sufficiently distant. Native retains those fields and tests restart phase/clock behavior instead of resetting them for convenience.


## SF-128 — disaster building deletion does not clean affected machinery jobs

Status: native correction implemented for live destruction; original cleanup omission verified, exact user-visible incidence conditional. Confidence high on direct deletion calls; no demonstrated security vulnerability.

Building cleanup0x19fe2..0x1a00a invokes generic asset deletion for stored contents; disaster helper0x26662/0x2667a invokes building cleanup/deletion without checking field or external machinery references. These paths do not cancel jobs referring to destroyed equipment/storage. Normal reservation can select a stored machine before collection, so an active field job can retain the now-inactive slot. The full original recovery behavior after such a hit remains unmeasured.

Native `prepareDisasterBuilding` preflights actual contents, closes over affected field jobs and linked machines, releases harvest destination reservations, cancels affected work to Growing for an existing crop or Waiting otherwise, and clears surviving job/movement links before destruction. Crop/plans/loss/terrain/ledgers are retained; no completed harvest or refund is invented. Lost records retain their source inactive bytes. Default manual demolition still uses the SF-064 conflict guard. Tests destroy a building with reserved machinery through both direct damage and a live moving effect, verify accounting/references, and continue a checkpoint35 days. This interruption policy is a deliberate native correction, not recovered original cancellation behavior.

## SF-129 — wind damage does not advance its reference clock

Status: verified branch behavior retained; a possible indirect clock writer remains unresolved. Confidence high for the dispatcher, limited for whole-program absence of indirect writes. No security implication.

Wind branch0x370ff..0x3710b subtractsDS6aa8 and compares unsigned elapsed against day-delayDS1f8c. The branch through0x37169 does not writeDS6aa8; initialized data at0x8b198 is zero, and the current whole-code index identifies the read without another direct write. Consecutive eligible animation calls can therefore each remove one nutrient unit from unprotected fields rather than waiting another day. Native persists the reference word and retains that behavior, with equality/wrap/repeated-call tests. Revisit indirect writes and original timer initialization before declaring an unconditional original gameplay defect or replacing it with a cooldown.

## SF-130 — disaster crop-price adjustment wraps before its cap

Status: verified arithmetic semantics retained; overflow reachability through ordinary source crop prices is unproven. Confidence high on instructions; not a demonstrated exploit.

General start callback0x4b090 selects wind mode6 at0x4b1be. It adds the shifted unsigned current price in a16-bit word, then compares against a16-bit four-times-base cap. Either addition or cap multiplication can wrap before the clamp; a nominal increase can become a decrease for sufficiently large values. The callback runs before mode eligibility, so an enabled wind start request can reprice even when existing flags prevent activation. Native preserves both ordering and width. Tests distinguish disabled starts, failed activation, ordinary cap behavior and a constructed65530/base30000 boundary yielding32759. That constructed boundary does not establish a reachable original save/game exploit. Further producer/range tracing is deferred.


## SF-131 — flood scanning uses an asymmetric footprint and excludes far-edge origins

Status: verified source scan semantics retained in live native floods; whether intentional coverage or a defect remains unresolved. Confidence high on loop bounds/clamping; no security implication.

Dispatcher0x37889/0x378a1 ends each coordinate at94 (origins0..93). A water origin initializes X toorigin−2 at0x378e3..0x378e9 then increments before processing; its comparison at0x37863..0x3786f permits X−1 andX only. Y starts atorigin−1 (0x37875..0x3787a) and continues while less thanorigin+2. Clamp0xa254 mutates those counters, collapsing negative candidates. The effective footprint is two columns by three rows, not a centered3×3 square, and permanent-water origins94/95 are never scanned. Native preserves this, including final X94/Y0/inactive and64 origins per call. Tests cover interior/zero/far edges, full8836-origin scans and the absence of Y95 flooding. Revisit only with further source evidence or an explicit enhancement policy; do not silently expand to the whole96×96 origin grid.

## SF-132 — flood stop counter cannot recover through the traced weekly updater

Status: verified negative-counter/gate mismatch retained in live native weekly updates; correction deferred. Confidence high for direct source paths, conditional on absence of an indirect reset elsewhere. No security implication.

Flood stop0x3705f writesDS6997=0xf8(−8) after clearing active flag04. Weekly helper0x3792b..0x37936 increments that byte only if04 is active. Natural flood eligibility0x3650f..0x36514 requires counter==0. After a normal stop, this updater alone cannot advance the inactive counter back to0, apparently preventing another automatic flood until manual start or another reset. Manual start0x36b1c does reset0 and bypasses this counter gate. The current indexed code has these direct counter writes; indirect writes and full initialization remain research limits. Native preserves the source counter/weekly gate, tests20 inactive weeks and manual restart, and records signed-byte wrap separately from a proven reachable overflow. A future fix would need an explicit countdown/reset policy rather than assuming−8 already counts down.

## SF-133 — flood drainage replaces the complete terrain word but retains its overlay

Status: source flag-loss asymmetry retained in live native floods; downstream visible consequences remain to be traced. Confidence high on direct writes, not a demonstrated memory-safety vulnerability.

Flood stop processes terrain2000 without1000. For ordinary graphics,0x36fcd..0x36fe1 writes base15+13 as a complete word, unlike drought stop's high-bit-preserving OR. It then clears2000. Thus other terrain flags such as0800/4000/8000 are lost while the secondary word and attribute remain untouched. Pump120..121 and crossing172..173 branches skip the replacement and only clear2000. Native tests both paths, including a retained overlay4000 occupant marker. Working fields survive flood deletion and loose assets are not separately removed, so flag/overlay consistency still deserves targeted examination beyond the live integration tests. The current implementation retains source behavior; any correction remains deferred with this evidence preserved.


Live integration evidence for SF-131..133: v14 checkpoints retain scan progress and the negative stopped counter, including unknown words. All eight original farms run70 days through flooding/drainage with repeated load validation; focused tests retain exact paired continuation before and after occupied-storage/field destruction. These checks do not establish that lost terrain flags are harmless for every working field or loose occupant. SF-133's correction and targeted downstream interaction investigation remain deferred; none of these entries is resolved by adding live controls.
