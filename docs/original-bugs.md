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

Native handling currently decodes only the cash and rental-expense entries needed for rentals, at separate verified offsets. The affected expense categories are not yet implemented. Revisit with complete finances and save/load; no exploit is demonstrated.

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

The existing-field planting branch resets age/accumulators and releases any crop contract before trying to consume/buy seed (`0x2f7de`–`0x2f83d`). If seed acquisition fails, it calls the abandon/expiry routine `0x1c2a8` (`0x2f97a`–`0x2f989`), clearing the crop. Thus insufficient cash or unavailable seed can destroy the existing crop and contract even though no replacement is planted. The new-field click path has different failure side effects and should be revisited when new-field placement is ported.

Native handling obtains seed successfully before resetting field/contract state. A regression verifies that insufficient funds leave the existing scenario state unchanged. Retain this documented difference when implementing calendar-scheduled planting.

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

**Status:** confirmed machinery-harvest failure path; native cleanup primitive added; integration fix deferred to harvest FSM.

`0x1aff0` reserves a crop-storage cell by changing its type from -1 to -2 at `0x1b17d`. Truck delivery later creates an inventory record at `0x15fef`. If the 512-slot table is full, the constructor returns zero and `0x15ffc` branches to `0x16032`, which sells the harvest. The common return path clears the field's storage-building word at `0x16093`, but this path contains no release of the reserved -2 cell. Repeated allocation failures can consume storage capacity until another operation clears it. No reachable exploit or normal-game frequency is claimed.

Native storage operations fail before mutation and provide `releaseHarvestReservation` to free a still-reserved cell. Tests verify exhaustion, unchanged storage on failed delivery and explicit release. The cleanup is not yet connected to a running harvest FSM; keep this entry open until that failure path is integrated and tested.
