# Animal age and reproduction

Evidence is static analysis of SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. File offsets identify instructions; initialized6190 data starts at0x846f0. No original executable is run.

| Species/type | Adult threshold, weeks | Old-age threshold, weeks | Gestation threshold, weeks |
| --- | ---: | ---: | ---: |
| Horse160 | 192 | 960 | 48 |
| Cow161 | 80 | 960 | 40 |
| Pig162 | 32 | 720 | 44 |
| Sheep163 | 12 | 480 | 24 |

All comparisons require **strictly greater** than the table value. Tables are DS2290 (adult bytes),2288 (lifespan words),2294 (gestation bytes). These are recovered game values, not modern real-world animal assumptions.

## Weekly age

Animal phase0xc14c..0xc21f of0xbf02 follows chemical aging and precedes inventory aging/refills. Every active animal consumes simulation RNG; low7bits==75 calls vocal helper0x135f8. Horse/pig request fixed filenames, while cow/sheep consume one visual draw to choose variant1/2. Muting presentation must not alter the source RNG sequence.

Word+10 increments with16-bit wrapping. Above the adult threshold, byte+18 becomes1; below/equal does not clear a prior1. This byte selects the alternate image in each directional sprite pair (`0x123f4/0x125de/0x1281a`), so it is an **adult image selector**, not an unfinished per-frame animation phase. The only identified writes are initializer0x11b08 (zero) and aging0xc1be (one).

Above the lifespan threshold, the source clears terrain0800 and calls direct removal0x11b4c, which cleans stored content and clears active32. It does not go through generic removal0x3a10a, leaving species definition counts stale (SF-106). Native removal uses the shared count/storage preflight and decrements the corresponding count, with no cash proceeds or invented reversal of DS3e5c. Bounded initial traversal processes animals after an earlier death instead of truncating the scan (SF-059).

## Monthly eligibility and weekly births

Monthly0xd032 calls0x12c38 after scheduled loan collection; non-month-ending weeks jump from0xcc0d to0xd03c and skip it. Active animals qualify with flag2 set, flag1 clear, age above the adult table and condition byte+8>110. The helper setsflag1 and clears byte28. There is no mate count, proximity, land-ownership, cash or nonstored condition in this predicate. Flag2 is the breeding-eligibility bit set by the allocator's simulation RNG; flag1 denotes pregnancy.

Weekly0xbe81 calls0x12cae after wind and before reported field status. It increments byte28 with8-bit wrapping for active flags1+2 animals. Above the gestation threshold it clearsflag1, resets byte28, and records the parent's type/x/y for later allocation. The entire scan finishes before allocating newborns, so a new low-slot animal cannot be processed again that week.

Births call generic addition0x3a2ca, which invokes allocator0x11a76 and increments the species count and raw accountDS3e5c by signed definition price. No cash/expense debit, ownership/terrain preflight, storage insertion or painting occurs. A child initially shares its parent's coordinates but has fresh outside flags and building reference0; its ordinary movement frame produces its first image. Unknown bytes9,15,19,22–25,29–31 survive slot reuse. The same helper now serves purchases, which retain their separate price/clearing/painting steps.

A full255-animal table makes allocation return0 with no RNG/count/account changes. The original ignores that return after ending pregnancy; native preserves this capacity behavior and returns explicit transient feedback (SF-107). No deferred birth queue, extra animal slot or invented refund is introduced.

## Native implementation and checks

`animal-allocation.ts` shares exact initialization and vocal selection. `animal-lifecycle.ts` implements age, monthly eligibility and queued births independently of React/canvas. Source sound requests are returned separately and delivered by the live event/audio layer; see [animal-input-audio.md](animal-input-audio.md).

Six primitive tests pin executable instructions/tables, all eight source farms, exact newborn bytes/RNG/accounts, every byte-valued condition around maturity, strict gestation/lifespan boundaries, wrap behavior, high-slot parents/free low slots, full capacity, stored death cleanup and rejection of invalid state before mutation. Existing purchase/movement/care tests remain unchanged and pass after sharing allocation/removal/vocal helpers.

## Live integration and presentation

GameSimulation runs animal age after building age and before inventory/refills, then gestation after weekly wind and before reported field status. Monthly eligibility follows scheduled loan collection and also runs once when a pending annual town choice resumes. Canonical age/image/flag/counter bytes, count/asset changes and RNG already persist in nativev10; no schema change or new save-owned UI state is needed.

The Livestock panel shows adults/expecting totals and expandable per-animal ages/gestation counters, plus transient birth, old-age and capacity messages. Native lifecycle notices include the species at the time of the event so an old horse's message remains a horse after a calf reuses that slot. Care notices also capture species instead of looking it up later from a reusable record. Notices are detached snapshots and are deliberately cleared by loading a save; they are native presentation, not invented original string IDs.

Two live tests run a stored cow through maturation/monthly eligibility and the full41-week gestation, preserve saved continuation into birth, verify death frees a slot before that week's birth pass, retain event identity across cross-species slot reuse, and freeze pending default. Browser checks compare the adult cow against original masked tile119, show monthly/weekly counters, save/reload births, report old-age death and full-table failure, and verify390px layout. The new nested details element required browser selectors to target the outer Livestock summary directly.

Animal pointer delivery and vocal playback are now live, as documented in [animal-input-audio.md](animal-input-audio.md). The earlier death-sound interpretation was corrected to report-counter state, not audio. Source byte18's age transition is now live; no further animation phase is asserted merely because there are two sprite images per direction. Equipment/chemical weekly aging and other original systems remain separately unfinished.
