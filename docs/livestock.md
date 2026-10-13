# Livestock reconstruction

Evidence is static inspection of supplied SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets. No DOS/x86 execution. Records and sale behavior are documented in [finances.md](finances.md); source distribution remains untouched.

## Purchases and original records

Implemented `animal-purchase.ts` follows generic purchase0x1cb42, one-cell map guards0x24266/0x24295/0x24ac8, allocation0x3a37a ->0x11a76, and masked painting0x1cfd4. Ordinary source definitions160–163 at SSM0x20cbe have graphics37/34/35/36 -> tiles946/962/978/994 and prices880/480/380/180. The fifth definition repeats type163 with price2180; it is preserved without inventing a fifth shop species. Four adjacent seven-byte strings at DS22a0 contain Horse/Cow/Pig/Sheep; their consuming name lookup still needs tracing before mapping every label.

The original first free animal slot scan covers1–255 and returns0 on exhaustion. Initialization writes x/y, type+6, direction+4 from visual RNG0x824d &7, +5=1, condition+8=255, +10word0, +12=1, +13/+14=0, +16word0, +18=0, +20word0, flags+2=0x20, +26word from DS2294 bytes48/40/44/24, and +28=0. Simulation RNG0x8273 &1 optionally sets flag2. Bytes9/15/19/22–25/29–31 survive slot reuse; no age/sex/name semantics are assigned merely from initialization. The initial map image uses the definition base, independently of the randomized direction.

Price helper0x1d2c2 returns a word; purchase sign-extends it before unsigned affordability/debit. Debit0x1c962 adds to livestock expenses DS3e98. Successful generic allocation increments the definition count and adds signed price×quantity to DS3e5c (`0x3a3ab..0x3a3ca`), now canonical `finances.statistics.ds3e5c`. This confirms a purchase posting, not the complete meaning/lifecycle of that previously raw account. The traced generic animal sale/deletion does not subtract it; do not invent a balancing write without tracing its broader producers.

Ground must be unmasked grass15–30 or road150–171 and owned at the selected tile; town bit0x4000 rejects. Animals do not enter the generic purchase-to-storage branch. Native bounded occupancy checks reject overlapping active records/buildings. Single-cell auto-clear runs before the purchase debit: both tree families require25 initially;535–538 costs25 and131–146 is free. Native failures preserve cash, terrain, records, definitions, accounts and RNG (SF-083/095 correction). Success restores cleared grass using signed moisture and attribute>>2, then enables terrain0800 and writes the original masked tile with overlay upper flags retained.

Four tests cover all eight farms/four ordinary types, exact source bytes and initializer, both RNG streams, retained unknown bytes, all map corners, sparse/final/full slots, occupancy/ownership, clearing affordability, signed word prices/wrapped ledgers, v9 saved records/accounts/RNG and original resale. Type checking and build pass. Purchase remains a tested primitive without a shop control; the live care integration is described below.

## Care dependencies under investigation

Routine0x12d8e, called at0xd28b in odd-day work0xd1ae, saturates need bytes+13/+14 at255 using DS2298 `[8,8,4,2]` and DS229c `[2,2,1,1]`. Signed temperature outside32..95 subtracts5 from condition+8 with a floor at0, except stored flag4. The native implementation traverses bounded active records instead of the original count-driven scan. Its full simulation integration must accompany consumption and movement; activating only growing needs would kill animals unable to seek/use supplies.

Frame wrapper0xdf48 compares animation tick elapsed against DS2286 (`0xe095..0xe0af`), moves an ordinary animal through0x11bce at0xe23d, then calls consumption/health0x12a4e at0xe248. The latter consumes supply for +14 through0x12ea0, then +13 through0x12fde, with threshold/condition/death logic and special stored behavior. Need increments, movement timing, source-seeking, resource use, reproduction and deletion must be composed in source order before declaring live livestock complete.

**Correction to earlier planning terminology:** do not assume building type72 is the animal trough. The traced water-like consumer0x12ea0 looks for tile176 and an inventory record; seeking code0x11cd4 explicitly requests other-goods type299 (graphic79/base175). The separate feed-like path requests type300 (graphic81/base1020), consuming its inventory quantity and changing masked images as it empties. Building72 has graphic103/base481 and a separate content-derived interior; its actual role remains unresolved. The source hover string “Water Trough for Animals” is at0x4f1f4, but its full UI dispatch mapping still needs verification. These distinctions prevent enabling a misidentified building as a working trough.

## Need increases and supply consumption

`animal-needs.ts` implements the odd-day need increases and the two local supply consumers as independent primitives. Both now participate in the live odd-day/frame work described below. The source searches an inclusive, coordinate-clamped 5×5 area in x-major order. Water uses terrain176 and inventory299; feed uses overlay1020–1024 and inventory300. Consumption subtracts the animal need with a floor at zero. The caller, not these consumers, resets needs and handles health/death.

An emptied water record remains active with its definition count unchanged; terrain becomes175 with upper flags retained (`0x12ef2..0x12f25`). Empty feed clears terrain0800, restores the overlay's grass expression using signed moisture, decrements the definition count and clears only the inventory active bit (`0x13030..0x13089`). Nonempty feed uses remaining-quantity boundaries102/206/308/410 for images1024/1023/1022/1021/1020. Unknown inventory bytes survive. Native consumers require a matching active, positive-quantity supply; this corrects the missing-record success in SF-096 and rejects inconsistent image/type pairs.

Four additional tests cover source tables/call bytes, all ordinary species, signed-temperature edges, saturated needs, stored temperature immunity, sparse final slots, search order, corner clamping, every feed-stage boundary, empty-resource behavior and atomic invalid-cleanup rejection. Live timing, movement, health/death, supply purchases/refilling and UI remain outstanding.

## Post-movement health and deletion

`animal-care.ts` implements routine `0x12a4e..0x12c36`. Water need is processed before feed; a successful consumer resets its entire corresponding need, even when the remaining supply was smaller. DS22d8 water thresholds are50/35/56/56 and DS22dc feed thresholds are160/160/80/64. Failed water consumption warns with notice57 and subtracts one condition only when need is strictly above half and strictly below the full threshold. Failed feed warns with59 and subtracts one condition whenever above half. Both die only above the full threshold; equality alone does not kill. Condition loss floors at zero, and condition zero by itself does not delete the animal in this routine.

Water death stops before feed search, clears terrain0800, deletes the record, requests sound6 and notice58. Feed death follows its warning, requests sound6, clears occupancy, deletes and requests notice56. Generic deletion `0x3a10a..0x3a13d` decrements the definition count and invokes `0x11b4c`. The latter clears stored contents when flag4 is set, then clears only active bit32. No sale proceeds, expense, or DS3e5c reversal occurs. Native validation checks animal/count/storage consistency before care; stored deletion refreshes the original building interior while preserving its open/closed state.

Stored flag4 replenishes both needs and adds30 condition, saturated at255, **only if water need was nonzero**. With zero water need, the original still enters ordinary feed handling when food need is nonzero. This asymmetry is retained; it is not evidence that ordinary play can starve a correctly scheduled stored animal. Source notice/sound identifiers are returned for later presentation integration, not played by simulation code.

Five tests cover all256 need values for every ordinary species and each resource, all eight farms, partial-supply fulfillment, water-first early exit, two-condition-loss saturation, stored recovery boundaries and deletion, retained unknown record bytes, unchanged ledgers, invalid references, and exact v9 save/reload continuation through depletion and death. No new save schema is needed for these existing record fields. Full movement/frame scheduling, supply purchases/refilling and controls remain to be connected before live livestock is claimed.

## Frame and movement integration evidence

The complete wrapper `0xdf48..0xe279` adds dependencies beyond a16-tick movement interval (initialized DS2286=16). It first refreshes herd-centre state when unsigned16 elapsed from DS22f2 is **greater than320**, consuming visual RNG twice per positive signed species count, then advances animals when elapsed from DS22f0 is **at least16**. Both timestamps initialize0. Centre counts/pairs contain a verified overlapping-address defect, SF-097; do not silently implement idealized averages and call them the original behavior. Movement reads the pairs at `0x12080..0x12143`; native preservation/correction and checkpoint representation are still pending.

Stored animals follow a separate frame branch: clear water need at `0xe0e2`, draw visual RNG&7, and only on5 try exit cells `(building.x−1, building.y +0/1/2)` in order through walkability `0x13256`. A successful exit clears stored content/flag4 and updates coordinates; both successful and unsuccessful stored branches skip ordinary movement and health until a later frame. Consequently the stored recovery in `careForAnimal` is relevant when ordinary movement enters storage before its same-frame care call, not unconditional healing of every stored animal on every frame. Native integration must retain that distinction.

Ordinary animals call movement `0x11bce` then health `0x12a4e`; the source loop's shrinking-count behavior after death is recorded under SF-059. Supply seeking calls `0x155e4`, which searches active matching inventory with nonzero quantity, compares the distance helper `0xfb54`, and keeps the first strict minimum. Full movement still needs terrain/collision checks, source/building targets, herd behaviour, direction/animation updates, storage entry and reproduction-related transitions. The source-based movement and care operations are now connected; remaining dependencies are listed below.

Trough image correction: direct initialized table verification at file `0x4ec60+0x8fc` gives175 (empty). Consumer `0x12f71..0x12f76` subtracts this base and then decrements, accepting176 (full). The earlier consumer implementation and its fixtures were off by one; both are corrected and the test now pins the table word and comparison instructions. This was a native reconstruction mistake, not an original-game defect.

## Native movement primitives

`animal-world.ts` and `animal-movement.ts` implement the full ordinary movement routine `0x11bce..0x1285e` and frame wrapper as independent TypeScript operations. The frame wrapper is now called by the live clock as described below. The movement context receives canonical world/finances, crop definitions, deterministic generators, animation tick, frame cache and map-pointer coordinates; it owns no React or canvas state.

Target priority is the existing random-direction countdown, thirst above its threshold>>4, hunger above its threshold>>4, then pointer avoidance/herd targeting. Water compares nearest active nonempty inventory299 with nearest type68 and69 buildings, with strict distance ties retaining earlier choices. Feed first seeks nonempty inventory300, otherwise the nearest active field whose crop byte62 lacks bit4. Helpers are inventory `0x155e4`, buildings `0x1b3cc` (not the earlier informal1b8cc calculation), field `0x1bfd8` and squared distance `0xfb54`. Field targets use two visual draws&7 plus2 from its origin. Water/feed headings perturb on simulation RNG&15==3/6 respectively.

Direction sign lookup `0x128b8` uses DS2274 eight direction pairs, DS22e0 toward and DS22e8 away. Equal-coordinate away lookup is corrected explicitly (SF-100). Pointer avoidance uses squared distance<50; herd steering uses distance>40 and visual RNG&7<4. A null map pointer retains source initialization(0,0), not an invented disabled-avoidance rule. UI pointer delivery still needs integration. Source walkability ranges are generated by initialized graphics tables, with the exact masked962-only quirk retained (SF-098). Bounds reject before accessing a native map cell.

Successful motion clears old terrain0800, retains overlay flags and writes base+direction*2+record byte18, or type+878 while collision flag8 is pending. After elapsed>640, flag8 clears and source `0x135f8` requests horse1.voc/cow1-or2.voc/pig.voc/sheep1-or2.voc for types160/161/162/163. The cow/sheep choice alone consumes a visual RNG value. These calls independently confirm the species labels previously left unresolved; audio delivery/decoding of those resources is still pending. Byte18 animation-phase producers, aging and reproduction remain separate work.

Entering eligible crop terrain680..840 finds its active field. If crop byte62 bit4 is clear, `0x12675` adds1024 to field word18 with65535 saturation, paints terrain36 while retaining upper flags, and clears food need. On a blocked fence177..187, needs above half a threshold permit simulation RNG&127==5 to paint192 and return notice67; then every blocked move consumes another simulation value&7, turns and sets the random-direction countdown8. Ordinary successful movement does not invent extra RNG draws.

Storage entry uses first-fit space and original definition base, updates coordinates, flag4 and building word16, then refreshes the building twice. A full building leaves origin occupancy intact natively (SF-099). Stored exit follows the previously documented three-cell/visual-RNG rule, preserves the building reference after clearing flag4, and defers occupancy/repainting until a subsequent ordinary frame. The wrapper refreshes herd state before movement and then applies care immediately after ordinary movement, including its successful storage-entry path. Native bounded traversal processes every initially active animal despite earlier deaths (SF-059 correction).

Seven tests cover original table/branch bytes, every terrain image and masking, all source farms/species/eight directions, retained bytes/flags, strict resource ties and RNG perturbations, grazing saturation, fence breaking, countdown and collision recovery, full/edge storage, exact herd overlap/signed count/RNG/rollover and frame/care ordering. An additional read-only1024-frame exercise on each unmodified imported farm completed without exceptions (initial animal counts4/0/0/10/0/57/18/9). Pointer delivery, animal/supply controls, aging/reproduction, animation-phase updates and remaining sound lifecycle are still outstanding.

## Live clock, native v10 and browser presentation

GameSimulation invokes the frame wrapper after irrigation (`0xbd53`) and suspends it during pending town/default decisions. Odd-day needs run after field-condition/status changes at `0xd28b`, before calendar wrap and daily weather/display refresh. The temperature operand is the prior signed display byte DS43dc, **not** the mean weather word: `0xd0b5..0xd0cc` adds bounded jitter to the mean and stores that display byte later in the day. An integration test deliberately separates display31 from mean50 and verifies condition loss, day parity and day-seven ordering.

Native v10 saves both word timestamps and the21-byte overlapping herd cache. Versions1–9 migrate once to initialized zero state; current saves require exact bytes and bounded timestamps. Every React snapshot gets a detached cache and record copies. Pause freezes both clocks; source imports retain their original animals. Native timing checks run before record scans on intervening ticks, retaining behavior while keeping the eight-farm/year test within its existing15-second limit.

The React Livestock panel shows counts and the most recent20 notice entries (source56–59/67). Notices are transient presentation feedback, not checkpoint state. Pointer input is currently null, following the original absent-window(0,0) path; delivery from the browser is still pending. Movement returns source vocal requests and care returns sound6, but those audio requests are not yet delivered; existing MIDI/homestead audio remains separate. Do not claim complete livestock lifecycle: shop/supply controls, refills, aging, reproduction and byte18 animation producers remain unfinished.

Four live tests verify exact v10 continuation, source imports, detached snapshots, pause, odd-day ordering, all nine legacy versions, strict malformed-cache rejection and transient death notices. Two browser flows compare a moved cow against decoded original planar pixels, consume real supply quantity, save/reload across herd refresh, display loss notices, reject malformed frame bytes without replacing the game and verify390px layout. The initial malformed-save browser assertion used an incorrect expected error phrase; it was corrected to match the established native-save error format without changing product validation.

## Next purchase/refill evidence

Generic allocation `0x3a468..0x3a496` creates type300 with quantity512 and loss0; `0x3a49a..0x3a4c8` creates type299 with quantity256 and loss0, then increments the corresponding saved definition count by the requested item count. Both call inventory allocator `0x15234`, which searches slots1–511 with an explicit upper bound and returns0 when full. It writes type+0, quantity+2, loss+4, word+6=0, x/y+8/+9, resets flags byte+10 then sets32; byte+11 survives reuse. There is no RNG call in that initializer.

All eight supplied farms have type299 graphic79, price15 and1×1 dimensions; type300 graphic81, price100 and1×1 dimensions. Generic placement permits type300 to enter the storage branch at `0x1cdb3`; type299 falls through map placement. The ground-shop path is now reconstructed below. Storage transfer through other original UI paths remains separate.

## Ground purchases and refill dependency

Water selection `0x21a86..0x21a90` adds1 to the graphic79/base175 table word, selecting176. Feed selection uses graphic81/base1020. Ground click branches `0x242ba..0x2434b` and `0x243e6..0x2447e` accept owned grass15..31 inclusive or roads150..172 inclusive without an ownership check on the roads. Common guards reject town4000 and terrain occupancy0800. Generic placement `0x1ce04` then requires the narrower15..30 or150..171 ranges. The final generic guard0x1cf17..0x1cf25 also requires ownership for both supplies (only type70 bypasses it). Native preflight combines all these guards, with bounded free inventory slots and collision checks. Auto-clear uses the existing tree rules before purchase; failures are atomic (SF-095).

Both click branches call purchase `0x1cb42`. Price is sign-extended to the unsigned32 affordability/debit amount. **Types299/300 match none of the expense categories at0x1c900..0x1ca20:** cash decreases, but no annual expense ledger or asset accumulator is invented (SF-102). The allocator increments the appropriate definition count with word wrapping. Feed success paints masked overlay1020 and terrain0800 at `0x24385..0x243a3`; water success paints terrain176, retaining upper flags, at `0x244a6..0x244d0`. Generic failure returns0 through `0x1cc83..0x1cc90`, including the failed-debit jump from0x1ccb6; a tentative hypothesis that failed debit could still paint supply was disproved by tracing that shared exit.

`livestock-purchase.ts` implements ground purchases and dispatches animal purchases through the existing recovered initializer. Four primitive tests cover all eight farms, exact bytes including retained byte11, executable operands, prices/count wrapping, no invented annual postings, grass/road ownership, generic boundary intersections, sparse/full inventory, atomic clearing/failures and real consumption/depletion/rebuy.

Automatic empty-trough refill is in `0xc2cf..0xc32f`: for inventory299 quantity0, call `17d4:0304` (file0x1a244) with64, then store twice the returned amount and repaint176 if nonzero. That helper scans active type72 buildings and consumes their word+10 contents, with an original whole-reservoir clearing issue (SF-101). Therefore the refill dependency is **type72 water storage**, not a player-paid manual refill action. Its production routine begins0xc364; the calendar call order, production/capacity, construction and native integration still need reconstruction. Purchased troughs already provide their original initial256 units. No refill or complete livestock lifecycle is claimed yet.

Further call-chain evidence for the next increment: refill belongs to the inventory tail of weekly routine0xbf02, called at0xbe4d. Water production0xc364 is called at0xd296 immediately after odd-day animal needs. It considers active type72 with condition byte+6 below255 and flag0040 clear; four adjacent terrain checks use graphic84/base98,count11 (wet ditch98..108). On a match it adds50 to building word+10, caps the wrapped word at255, and paints83+(quantity>>6) when the interior is open. This establishes the irrigation dependency and makes above64 contents plausible; native implementation still needs bounded edge handling, purchase initialization, weekly phase order and original aging/degradation reviewed together.

## Live animal and supply shop

GameSimulation owns `buy-livestock` commands, combining the existing animal initializer/RNG/accounting and ground-supply primitive. React **Map tool → Animals & supplies** provides product prices, one-tile validity previews, tree-clearing controls, placement/cash errors, supply totals and purchase feedback. **Livestock → Buy animals and supplies** opens the same tool. Pending town/default decisions suspend purchases. Results are transient detached snapshot data; canonical records, quantities, definition counts, accounts and RNG already persist in nativev10 without a schema change.

Live tests buy all four species, run purchased supplies through actual movement/care, reject purchases without mutation, preserve tree costs and financial-choice suspension, and reload exact ongoing state. Newly purchased animals have the source random-direction countdown1, so their first move need not target supply; the fixture's cow reaches its nearby supplies on day4. This differs from the older movement fixture with countdown0. Browser checks cover real pointer placement, panel shortcut, full-trough source pixels, consumption, exact downloaded/reloaded state, clearing, insufficient cash and390px layout. Automatic water storage/refill and other lifecycle gaps above remain unfinished.

## Water-storage dependency completed

The earlier pending refill/construction notes are now resolved by [water-storage.md](water-storage.md): type72 purchases, wet-ditch collection, weekly wear, inventory aging and automatic trough refills are live and persist in v10. Native partial withdrawals correct SF-101; source initialization217 and arithmetic remain explicit. The shop explains how to build the supply, and Livestock displays stored water/worn-out locations. Animal aging/reproduction, animation phases, pointer delivery and remaining audio lifecycle are still unfinished.

## Next lifecycle evidence

The unimplemented animal phase of weekly0xbf02 is0xc14c..0xc21f, between chemical aging and the now-live inventory tail. It draws simulation RNG per active animal, requesting vocal helper0x135f8 when low7bits==75; this is an audio trigger, not reproduction. It increments word+10, sets byte+18 to1 when age exceeds byte tableDS2290=[192,80,32,12], and removes animals past word tableDS2288=[960,960,720,480]. Source deletion/storage cleanup and bounded traversal need integration with those age rules.

Monthly caller0xd032 invokes0x12c38 after the scheduled-loan branch;0xcc0d skips to0xd03c when the month has not ended. The helper requires active,flag2,notflag1,age strictly aboveDS2290 and condition>110, then setsflag1 and clears byte28. Weekly0xbe81 invokes0x12cae after wind: it increments byte28 for active flag2+flag1 animals and, aboveDS2294=[48,40,44,24], clearsflag1, resets byte28 and queues the parent's type/coordinates for generic allocation0x3a2ca. No mate-distance requirement appears in these routines; do not invent one. Birth allocation/painting/capacity, accounting, stored parents, boundary arithmetic and complete source call order remain the next reconstruction work. These observations are evidence, not implemented lifecycle behavior.

## Age and reproduction now live

The preceding lifecycle investigation is implemented in [animal-lifecycle.md](animal-lifecycle.md), including shared allocation, weekly age/vocal selection, adult image changes, old-age storage cleanup, monthly eligibility, queued births, capacity handling and v10 continuation. SF-106 corrects species-count drift on old-age removal; SF-107 retains the original full-table behavior. Byte18 is verified as the adult image selector, not a per-frame animation toggle. Livestock now shows ages, pregnancies and transient birth/death/capacity feedback. Pointer delivery and actual animal audio remain pending; earlier lifecycle-pending paragraphs record the investigation sequence.

## Correction: death call6 is report state, not sound

Direct tracing of both care calls0x12b68/0x12c00 identifies their destination1c78:0956 = file0x1f2d6. It sign-extends the index argument, reads DS448e+index, and increments only below255 (0x1f2e6..0x1f2f2). It makes no audio call. For index6, this is DS4494, already retained in native `statistics.fieldPresence[6]`. The earlier “sound6” label was our reconstruction error, not an original defect. Care now performs that saturating increment on either need-related death; old-age removal does not use it. Distinct-status count4560 is untouched. The weekly field aggregation still clears/replaces these bytes, as verified previously.

Native statistics/save validation now accepts the full byte range0..255 for this shared report array, without renaming saved keys or changing v10 layout. Tests pin the call and helper bytes, saturation, unchanged distinct count, malformed counts and exact checkpoint round trips. Source vocal requests from0x135f8 remain actual audio calls to212a:08b6; death does not acquire an invented sound.

## Pointer and vocal delivery now live

[animal-input-audio.md](animal-input-audio.md) documents map-coordinate conversion, bounded transient simulation input, zoom/scroll/exit handling, original vocal assets and event playback. Source-based weekly and collision-recovery voices now use Enable sounds independently of MIDI. SF-108 records an uninitialized original pointer-local path; native outside-map input uses the defined absent-window fallback. Earlier pointer/audio-pending paragraphs are historical. Original audio arbitration, equipment/chemical aging and other systems remain unfinished.

## Next weekly-phase dependencies

Weekly0xbf02 starts with equipment: active records increment word+18 at0xbf2f. Above4,0xbf43 invokes the existing wear helper0x11972 with amount1, then resets that word to0. Condition255 and rental flag64 clear lead to generic action2 at0xbf8c; resident stub0x28042 selects overlay27 entry0x0fcc (file0x4c41c), the already-recovered asset-sale routine. Its failure result skips the remaining destruction presentation. Successful outside-building removal also obtains the footprint, requests per-cell clearing and notice73. Before integration, verify stored/linked/busy equipment, financial credit and clearing order rather than assuming this is a free deletion.

Building aging follows at0xc03a. Chemical records then run0xc110..0xc13d: active flag32 at record+2, word+10 increment at0xc120, byte+9 increment at0xc125, both wrapping. Segment pointerDS:c674 initializes2d9f, confirming the20-byte record baseedbe. Animal age follows at0xc14c. The chemical byte's consumers still need tracing before naming it. These equipment/chemical phases remain unimplemented; existing native v10 already retains their record bytes.

## Original livestock quick messages restored (2026-10-11)

Retirement audit found that care/fence events reached only the native Livestock panel. Verified caller bytes `6aNN 9ab42b751d` at12b11(code57),12b70(58),12bce(59),12779(67);12c2f pushes56 then jumps to12b72's same call. Destination1d75:2bb4 is file22504, the ten-entry Edit history writer, not a modal Message. High confidence: source call instructions and existing movement/care ordering agree. GameSimulation now appends each returned code in per-animal movement-before-care order; existing adjacent duplicate suppression applies. Canonical animal state, clocks, RNG, accounting and saves are unchanged. These were native presentation omissions, not original defects.

The following archived qmessage.dat64-byte records are rendered as actual HTML text. Hashes cover the entire record; offsets are code×64.

|Code|Original text|SHA256|
|---|---|---|
|56|Livestock are hungry.|6aaa4715ed43cf506ae6c008e3dce04184e56460cd3555c818642c5448fa9cc9|
|57|Livestock are thirsty.|419f56bf23ed80acf3560d5965737c37a7d5b06380e24ec97cb49b3dda1c1498|
|58|Livestock are dying!|236ac0466851b0658516a41b823412e0715b8a7c285fc1b2314684ef939dfa04|
|59|Livestock cannot reach food.|362d4fba4a77936ffbf5330c757ade442ebcefe1a9d56122fdc74999c388594b|
|67|A section of fence has broken!|5ccf8a7bacbbe3d4ad0ac704fd96a4e7a3a573cd0405639629d998a2f2adb821|

Preserve these actual source captions even though code56 follows feed death and code59 is the feed warning. Native species-specific diagnostic prose is not the original text. Live tests verify57,58,59 and feed-warning→56 history order, source tests pin all five callers, and movement tests retain fence-break/RNG checks. Browser verifies source death text/history, no popup, save/reset and original movement/supply pixels. Birth/old-age/capacity diagnostic notices remain explicitly native; no original IDs are invented for them.

## Animal Buy placement sounds

Animals placed from the Buy window now request the original placement sounds; before this they were silent. Evidence, from executable `8b86a2d3…58ce` (static disassembly only):

- **Buy placement loop `0x2239a..0x22503`.** The same loop serves every selected Buy product (type from `[fa3a]+2`), animals 160–163 included.
  - It first applies the visible-window bounds test `0x22626` (called twice, for both footprint corners).
  - Then it compares the price from `1a66:0a20` with `DS3e48/3e4a`. That pair is assumed to be cash, which is plausible but not separately traced. When the price is not lower, `0x224ca` requests DS`5736` `uhoh.voc` and calls `0x22504` with 0x2a.
  - Then it tests ownership flag 8 at terrain `+0x4c25` (`0x22473`); only type 0x46 bypasses it. That rejection is silent.
  - Finally it calls generic purchase `0x1cb42` at `0x224a4`. No `ploptool.voc` is requested anywhere in this loop.
- **Generic purchase `0x1cb42`.**
  - Success requests DS`3ece` `plopitem.voc` at `0x1cc92`.
  - A failed debit (`0x1ccb6`, DS`3ee4`), a failed allocation (`0x1cca0`, DS`3edb`) and a failed placement (`0x1cc7f`, DS`3ec5`) each request `uhoh.voc`.
  - The callers at `0x24364`, `0x24497` and `0x24af6` are the edit-tool feed, water and tree branches. Only those add `ploptool.voc` through `0x24b24`.

Native mapping in `GameSimulation` (`buy-livestock`, types 160–163):
- Success requests `plopitem`.
- `occupied`, `blocked-terrain`, `no-animal-slots` and `insufficient-cash` request `uhoh`.
- `outside-map`, `not-owned` and `unsupported-animal` are silent.

Confidence is high for the success sound, the unaffordable sound and the silent ownership rejection.

Approximations:
- Native `not-owned` also covers the town bit 0x4000, which this loop does not test, so the original would reach the generic routine and probably play `uhoh`.
- Native `occupied` is a native bounded collision check.

Deferred:
- The price comparison appears to require price < cash, while native accepts price == cash. This needs the `DS3e48` identity confirmed before it is recorded as a defect.
- `0x22504` with 0x2a is probably the Edit status line and is not shown here.
- Buildings and equipment use the same loop and generic routine but remain silent natively.

Tests: `tests/live-livestock-purchases.test.ts` covers all four species, occupied, bounds and unaffordable cases. `livestock-shop.spec.ts` covers the real Buy → map placement requesting `plopitem.voc` without `ploptool.voc`, then `uhoh.voc` on the occupied tile.
