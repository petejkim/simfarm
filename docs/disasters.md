# Original disaster reconstruction

Source SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. File offsets below are static call/branch evidence; flag masks and DS addresses are hexadecimal. The implemented and remaining branches are distinguished below.

Tornadoes, locust swarms and high winds now run through canonical simulation, native v13 checkpoints and React controls. The original damage/movement rules, July requests, weekly wind triggers, windbreaks, price callback, original sprites/PCM and tornado-flight interaction are connected. Drought, flood, frost, crop circles and toxic-land events remain unfinished; this is not the complete disaster system.

Main-loop overlay stub24e6:0fb0 resolves to dispatcher0x3709e, called after animals at0xbd85. Shared flags live atDS6996, with separate retained clocks and moving-effect state. Simulation runs independently of map/window presence (SF-121); drawing uses native canvas clipping.

## Destructive cell helper

`src/simulation/disaster-damage.ts` reconstructs233c:0fd8/file0x26598..0x26c62. Confidence is high on the direct instructions and tile tables, independently pinned in `tests/disaster-damage.test.ts`; the helper is now called by live moving disasters. It is not a direct player command. The original has no ownership, field-work, confirmation or general25 demolition-fee gate.

The first matching building takes precedence (finder0x1a17e called at0x265c8). Windmill secondary1010..1013 or pump terrain120..121 invokes irrigation removal0x17944 at0x26657, using the building origin. Cleanup0x19f6a at0x26662 and generic deletion at0x2667a destroy contents, enqueue clearing and reduce definition counts/book value without sale proceeds. Native reuses validated building demolition, including its record-type irrigation correction SF-093 and preflight of malformed content/references. Native disaster demolition interrupts affected jobs and clears surviving equipment references before deleting contents (SF-128). Manual demolition retains its existing conflict guard; occupied buildings are not immune to disaster damage.

Otherwise field lookup0x1b928 at0x2668c takes precedence over loose inventory. Only terrain680..839 enters0x266c2: `(terrain & 0xf824) | 0x24` leaves tile36. The call0x266d9 adds256 through0x1b7c6 to field word18, saturating at65535. Field state, plans, assignments and all other bytes survive. Repeating the same hit cannot add loss again because tile36 is outside the crop range. A field containing a noncrop tile still suppresses the inventory lookup before the common terrain chain.

Without a building/field, trough terrain175..176 or feed secondary1020..1024 finds the first active inventory at that point. Calls0x2672e/0x26791 use raw deletion0x152b0, leaving definition counts unchanged (SF-122), and enqueue0xa2f6. Feed additionally clears terrain0800 at0x267ab; the secondary word survives. No matching record falls through. Loose chemicals, animals and machinery are not independently deleted by this helper.

The common chain0x267b1 rereads terrain after object cleanup. Tile bases/counts are stored at file segment base0x4ec60, using DS085e/DS099e tables. Accepted ranges are150..171 (roads),87..108 (ditches),177..191 (fences/gates),131..146 (trees),175..176 (troughs),122..125 (valves),172..173 (crossings),535..538 (paid clearing). Unlike the manual bulldozer,193 and aircraft crash tiles73/74/113/114 are absent. Only535..538 charges25:0x26aaa..0x26ab1 calls debit0x1c88e with category500, posting to worker expenses0x1c9c4 and aborting if cash is insufficient (SF-123). The live caller reports insufficient cash; the primitive itself performs no UI work.

Ground restoration0x26af7..0x26b2b preserves high terrain bits and combines15, signed soil moisture and `attribute >>> 2` with16-bit wrapping. Repair0x25398 is selected only for roads150..171, fences177..187 and ditches87..108. Gates, valves and crossings receive no neighboring repair; crossing2000 survives. There is no shoreline reconstruction or RNG use (SF-124). Native bounds validation rejects coordinates outside the96×96 map before reads (SF-125).

Eight primitive tests pin calls, saturation instructions and every accepted table range; destroy every building across all eight farms; cover all256 field states and2048 terrain IDs; check network repair, cash equality/wrap, malformed demolition atomicity, pump/windmill sources and unaffected loose assets. Bought trough/feed damage retains the raw count/secondary quirks and resumes35 days exactly from native v12. This proves the primitive and its existing checkpoint fields, not a playable disaster lifecycle.

## Initialization, moving effects and resources

Start0x36574 uses jump table0x36cf8 (segment base0x364b0), and stop0x36d16 uses0x3708e. Source strings at file0x846f0+DS69ba..6aa6 identify resources. `events.dat` contains8-row records of30 characters plus line terminators, and event records48..58 confirm the user-facing names. Member offset896380, length16282, SHA256 `616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb` in MEGADATA.EEA. Confidence high on these combined branches/resources; not all branches are implemented.

| Mode | Flag | Start file offset | Stop file offset | Evidence |
| --- | --- | --- | --- | --- |
| 1 tornado | 01 | 0x36874 | 0x36d9c | tornado.spr/tornado.voc, event52 |
| 2 drought | 02 | 0x369be | 0x36e08 | event53; ending58 |
| 3 flood | 04 | 0x36b12 | 0x36f38 | flood.voc, event54; ending56 |
| 4 locust swarm | 20 | 0x36bac | 0x3706c | swarm.spr/swarm.voc, event55 |
| 5 frost | 10 | 0x365a0 | 0x36d38 | wind.voc, event49 |
| 6 high wind | 08 | 0x36694 | 0x36d52 | wind.voc, event48; ending57 |
| 7 crop circles / close encounter | 40 | 0x3672c | 0x36d4a | alien.xmi, event50 |
| 8 toxic land warning | 80 | 0x36836 | no table entry | event51 |

`src/simulation/moving-disasters.ts` implements moving start/stop/advance branches, owned by GameSimulation and native v13. The weather result formerly called `hurricane` is now correctly named `tornado`. The earlier interpretation of call24e6:126c as “attempt statistics” was incorrect: it adjusts crop prices for selected modes and is a no-op for tornado/swarm, as traced below.

Fresh-process bytes at file0x8b084 (DS6994) initialize enabled6995=1, flags6996=0; tornado frame6998/clock699a/origin699c,699e/start69a2=0 and directions69a0/69a1=1. Swarm field69a4/frame69a6/clock69a8/origin69aa,69ac/start69b0=0, directions69ae/69af=1; shared delay69b2=4, last start69b4=0. These are executable initialization bytes, not SSM offsets. Successful starts update69b4. Source restart does not reset frame phases, and tornado start does not reset699a (SF-127); swarm start does reset69a8.

Tornado start refuses an existing tornado, stops an active swarm, chooses x/y=`(nextVisual() &63)+16`, then consumes four more visual calls for dx/dy: each magnitude is0/1 and each sign gets a separate call. Swarm start refuses either moving effect, invokes field selector0x1b802 and starts at its origin. That selector uses bounded RNG, with zero mapped to ordinal1, preserving a first-field bias and excluding the last field when multiple fields exist (SF-126). Native bounds the scan by actual active records. Enabled6995 gates new starts; it does not suppress updates to an existing effect.

Every accepted moving iteration requires unsigned16-bit elapsed **strictly greater** than69b2, advances the retained frame0..3 and updates its own clock once. Large elapsed gaps do not loop through missed frames. On swarm frame wrap the four damage calls occur before two visual calls choose independent±1 directions; position is clamped to retained field origin..origin+5 even if the field was removed. Native permits the retained coordinates beyond95 for a narrow edge record but rejects out-of-map damage. After every eligible swarm iteration, unsigned age>512 stops it; equal512 and ineligible iterations do not. Its actual sprite is64×40, although source invalidation regions include3×4 cells and a4×4 dirty scan: do not derive image dimensions from those redraw arguments.

On tornado frame wrap, movement first clamps origin to0..95 through0xa254, then damage hits `(x+1,y+2)` (SF-125). If y>86 set dy=-1; if y<10 set dy=1. One visual call selects whether to change direction (`&15 ==6`), and only then consume the four magnitude/sign calls. This random change can override the edge correction. Stop requests refuse unsigned age<1920; reaching1920 alone does not stop the effect. Actual stop requests must come from source callers, including the weekly wind path, not an invented lifespan timer.

Original sprite imports are reproducible through `tools/import.ts`, using the existing five-plane sprite decoder. Every pixel/mask/atlas position is independently tested for both effects alongside flight sprites. Generated PNGs stay ignored.

| Member | Archive offset | Bytes | Frames / dimensions | SHA256 |
| --- | --- | --- | --- | --- |
| tornado.spr | 1785116 | 5770 | 4 ×48×48 | `ac8960867e84acd422ea9e6ffd26a77e63f5af65f748b83c86011231f6fdb2f7` |
| swarm.spr | 1790886 | 6410 | 4 ×64×40 | `9217f7d2e3896e2072f36fd4c4e544d989009ad185ce40787478b914e8a67603` |
| tornado.voc | 2188601 | 11582 | unsigned PCM, rate byte75 | `9d07506ad9833c92711ad6cc623d430e859af19c0974bb597cdefd8a5058fee8` |
| swarm.voc | 2143313 | 7292 | unsigned PCM, rate byte166 | `694dc046f73a3a99034d59febbd1ade9509c13ec4b7c4a64e0ae6799565e43f0` |

## General start callback and high wind

Stub24e6:126c/file0x282cc bytes `e81ef3ea500ace271a00` resolve to overlay26 base0x4a640 +0xa50 =0x4b090. Jump table0x4b226 bytes `f60b640ac20af60b200b7e0bf60bf60b` maps modes1/4/7/8 to no-op0x4b236; drought2 to0x4b0a4 (crop byte71), flood3 to0x4b102 (byte70), frost5 to0x4b160 and wind6 to0x4b1be (byte72). This corrects the earlier research label “attempt statistics”; no new statistics state is justified by this call.

Enabled gate0x36580 precedes callback0x36593, which precedes individual mode eligibility. Wind therefore updates prices even when an existing wind/tornado prevents a new activation. For nonzero crop byte72, shift count is masked31; the current unsigned price gains its right-shifted value, wrapping16 bits before capping at four times base crop word34 (also word-wrapped). Counts16..31 contribute zero. Both native representations of the original price are updated. SF-130 distinguishes this arithmetic from a proven reachable overflow exploit.

Wind start refuses flags09, cancels swarm20 and sets08. If wind is below30 it sets signed-byte anomaly to40−wind; successful start records the shared tick. `src/simulation/wind-disaster.ts` reconstructs tree helper0x1e250..0x1e4d7: the field rectangle expands two cells, each signed-byte bound is clamped0..95, then each covered row/column counts once if any of its four boundary candidates contains tree131..146. This is coverage, not a total of tree tiles. Wind dispatch writes the count to field byte55; signed byte<8 applies condition mode13 amount1, reducing nutrient byte29 with the existing regional arithmetic.

The wind branch0x370f4..0x37169 runs when unsigned animation tick minusDS6aa8 exceeds day-delay word1f8c. DS6aa8 is initialized0 at file0x8b198. This branch never advances it, and the current code index found only the read; indirect writers remain a research limitation. Native retains this reference rather than inventing a daily cooldown, so successive eligible animation calls repeat damage (SF-129). Bounded active-field traversal corrects sparse-slot SF-120.

## Trigger order, flight and presentation

Weekly call0xbe42 invokes natural trigger0x364b0 before aging0xbe4d and wind0xbe74. With the old calendar month1256 equal6 (July), simulation RNG requests wind if `(r &127)==49`, otherwise tornado if a second `(r &255)==55`; an independent subsequent draw requests swarm if `(r &63)==33`. These draws occur even when new disasters are disabled. The already-playable farming fixture consequently sells for398 rather than400 after passing July; it is not evidence of a new harvest formula.

Weekly wind0x1e1ae requests mode6 at wind>=35, mode1 at wind>70, stops tornado below70 subject to its1920-tick minimum, and clears wind below35. Original fresh-process moving delay4 is retained. Browser speed scales existing logical ticks; no DOS wall-clock equivalence is claimed.

During manual flight, flag1 check0x316dd enables distance-based tornado turbulence/crash checks and dispatcher call0x31730 on accepted flight iterations. The existing flight primitive now receives the active tornado position. Calendar, animals, machinery and ordinary farm work remain suspended. The dispatcher can also process concurrent wind, following the original tornado-gated call.

**Disasters**, below **Machinery**, offers Allow new disasters, Start tornado, Start locust swarm and Locate. Disabling blocks new starts but lets active events continue. Source manual menu0x3e3b0 has inconsistent enable/menu updates (tornado action enables even after a failed start); native uses an explicit checkbox and disabled start buttons. Native bounded notices replace modal event dialogs. Starts request the original PCM once through the existing player, with no invented loop; complete DOS driver arbitration remains unfinished. MIDI background music is unchanged. Canvas composites original sprites at their world origin after the ordinary world/aircraft layers (source0x37386/0x37601).

Additional wind.voc: MEGADATA.EEA offset2104327,12165 bytes, SHA256 `a2077a3cb17160f7d228d01bd2e6295de92d98568063c683820c0cc0bd341918`. All three clips use original unsigned PCM at byte32 through the final terminator, with sample rate1000000/(256−rate byte); wind/tornado rate byte75, swarm166. Tests check every sample against fingerprinted bytes; browser checks measure audible output and every opaque sprite pixel.

Building destruction retains original contents/accounting/clearing but adds explicit native job interruption: affected field work stops, surviving linked machines release jobs, and harvest destination reservations are released. Existing crop, plans and ledgers survive; no free harvest, refund or replacement is granted. Destroyed machine records retain inactive bytes. See SF-128 for source evidence and confidence.

Remaining natural branches include moisture>13 with flood counter0 requesting flood, moisture<0 requesting drought, flood stopping at moisture<=9 and signed counter>3, and drought stopping at moisture>=3. The preceding weekly call0xbe38 increments the flood counter through0x37924. These branches and mode3's separate64-location scan/deletion dispatcher remain unimplemented; they cannot be replaced with moving cell damage. Frost, crop circles, toxicity, complete original dialogs/menu/audio behavior and cold/warm-load semantics also remain open.
