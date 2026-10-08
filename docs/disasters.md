# Original disaster reconstruction

Source SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. File offsets below are static call/branch evidence; flag masks and DS addresses are hexadecimal. Destructive disaster integration remains unfinished; existing weather alert flags do not constitute a completed disaster system.

Main-loop overlay stub24e6:0fb0 resolves to dispatcher0x3709e. Initial inspection shows shared flags atDS6996 and distinct clock/state families. Bit10 invokes0x36d16(mode5) only when segment-relative byte4276 is zero; bit40 invokes mode7. Do not assign public disaster names to these modes until initialization/resources/callers establish them.

Later initialization/resource tracing establishes the names in the table below. The earlier paragraph records the initial uncertainty; these identifications now supersede it.

Bit8 enters0x370f4..0x37169 once unsigned animationTick−DS6aa8 exceeds speed word1f8c. Each visited active field calls1b98:06d0 →0x1e250, writes returned AL to field+55, and if signed AL<8 applies field-condition mode13 amount1 (existing subtract field byte29 plus regional channel6 behavior). The full helper and the timer writer still need tracing; do not invent a frequency or infer what the result measures from its location alone. This loop contains the sparse-field defect SF-120.

Bit20 begins0x3716b. It compares unsigned animationTick−DS69a8 to DS69b2, increments frame byte69a6 and wraps after3. On wrap it calls destructive terrain helper233c:0fd8 →0x26598 at four offsets from its current point: (x+1,y+2), (x+2,y+2), (x+1,y+1), (x,y+1). It then consumes two visual RNG calls5fd:007d and chooses independent±1 direction bytes69ae/69af, updates words69aa/69ac, and clamps them against a field identified by69a4 with upper offsets+5. Rendering uses a3×4 sprite request and source viewport offsets. Every accepted iteration updates69a8; elapsed time since69b0 above512 invokes0x36d16(mode4). Names, trigger/termination semantics and the full remaining dispatcher are pending. The absent-window local hazard is SF-121.

Next trace start/stop routine0x36d16, the rest of0x3709e and initialization/load/save ownership of every retained field. Persist necessary effect clocks/RNG/state separately from React and drawing. Never substitute random visual effects for recovered damage rules.

## Destructive cell helper

`src/simulation/disaster-damage.ts` reconstructs233c:0fd8/file0x26598..0x26c62. Confidence is high on the direct instructions and tile tables, independently pinned in `tests/disaster-damage.test.ts`; disaster triggers and dispatch integration remain pending. It is not a player command. The original has no ownership, field-work, confirmation or general25 demolition-fee gate.

The first matching building takes precedence (finder0x1a17e called at0x265c8). Windmill secondary1010..1013 or pump terrain120..121 invokes irrigation removal0x17944 at0x26657, using the building origin. Cleanup0x19f6a at0x26662 and generic deletion at0x2667a destroy contents, enqueue clearing and reduce definition counts/book value without sale proceeds. Native reuses validated building demolition, including its record-type irrigation correction SF-093 and preflight of malformed content/references. Actual disaster integration must address any reachable active equipment-link conflicts; it must not silently skip valid damage because a player-demolition guard rejects it.

Otherwise field lookup0x1b928 at0x2668c takes precedence over loose inventory. Only terrain680..839 enters0x266c2: `(terrain & 0xf824) | 0x24` leaves tile36. The call0x266d9 adds256 through0x1b7c6 to field word18, saturating at65535. Field state, plans, assignments and all other bytes survive. Repeating the same hit cannot add loss again because tile36 is outside the crop range. A field containing a noncrop tile still suppresses the inventory lookup before the common terrain chain.

Without a building/field, trough terrain175..176 or feed secondary1020..1024 finds the first active inventory at that point. Calls0x2672e/0x26791 use raw deletion0x152b0, leaving definition counts unchanged (SF-122), and enqueue0xa2f6. Feed additionally clears terrain0800 at0x267ab; the secondary word survives. No matching record falls through. Loose chemicals, animals and machinery are not independently deleted by this helper.

The common chain0x267b1 rereads terrain after object cleanup. Tile bases/counts are stored at file segment base0x4ec60, using DS085e/DS099e tables. Accepted ranges are150..171 (roads),87..108 (ditches),177..191 (fences/gates),131..146 (trees),175..176 (troughs),122..125 (valves),172..173 (crossings),535..538 (paid clearing). Unlike the manual bulldozer,193 and aircraft crash tiles73/74/113/114 are absent. Only535..538 charges25:0x26aaa..0x26ab1 calls debit0x1c88e with category500, posting to worker expenses0x1c9c4 and aborting if cash is insufficient (SF-123). The debit's original notice42/UI refresh is not represented by this standalone primitive.

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

`src/simulation/moving-disasters.ts` now implements the start/stop/advance **moving branches only**, calling the verified damage primitive. It is not yet owned by GameSimulation or native saves. General start statistics (call24e6:126c before the mode switch), event dialogs, sound requests, menu checks, frost/wind/flood/drought/circles/toxicity and natural triggers are still caller/integration work. Current `weather.ts` names its >70 result `hurricane`; mode1's actual resource establishes **tornado**, so correct that old provisional name when replacing direct flag assignments with lifecycle calls.

Fresh-process bytes at file0x8b084 (DS6994) initialize enabled6995=1, flags6996=0; tornado frame6998/clock699a/origin699c,699e/start69a2=0 and directions69a0/69a1=1. Swarm field69a4/frame69a6/clock69a8/origin69aa,69ac/start69b0=0, directions69ae/69af=1; shared delay69b2=4, last start69b4=0. These are executable initialization bytes, not SSM offsets. Successful starts update69b4. Source restart does not reset frame phases, and tornado start does not reset699a (SF-127); swarm start does reset69a8.

Tornado start refuses an existing tornado, stops an active swarm, chooses x/y=`(nextVisual() &63)+16`, then consumes four more visual calls for dx/dy: each magnitude is0/1 and each sign gets a separate call. Swarm start refuses either moving effect, invokes field selector0x1b802 and starts at its origin. That selector uses bounded RNG, with zero mapped to ordinal1, preserving a first-field bias and excluding the last field when multiple fields exist (SF-126). Native bounds the scan by actual active records. Enabled6995 gates new starts; it does not suppress updates to an existing effect.

Every accepted moving iteration requires unsigned16-bit elapsed **strictly greater** than69b2, advances the retained frame0..3 and updates its own clock once. Large elapsed gaps do not loop through missed frames. On swarm frame wrap the four damage calls occur before two visual calls choose independent±1 directions; position is clamped to retained field origin..origin+5 even if the field was removed. Native permits the retained coordinates beyond95 for a narrow edge record but rejects out-of-map damage. After every eligible swarm iteration, unsigned age>512 stops it; equal512 and ineligible iterations do not. Its actual sprite is64×40, although source invalidation regions include3×4 cells and a4×4 dirty scan: do not derive image dimensions from those redraw arguments.

On tornado frame wrap, movement first clamps origin to0..95 through0xa254, then damage hits `(x+1,y+2)` (SF-125). If y>86 set dy=-1; if y<10 set dy=1. One visual call selects whether to change direction (`&15 ==6`), and only then consume the four magnitude/sign calls. This random change can override the edge correction. Stop requests refuse unsigned age<1920; reaching1920 alone does not stop the effect. Actual stop requests must come from source callers, including the weekly wind path, not an invented lifespan timer.

Original sprite imports are reproducible through `tools/import.ts`, using the existing five-plane sprite decoder. Every pixel/mask/atlas position is independently tested for both effects alongside flight sprites. Generated PNGs stay ignored.

| Member | Archive offset | Bytes | Frames / dimensions | SHA256 |
| --- | --- | --- | --- | --- |
| tornado.spr | 1785116 | 5770 | 4 ×48×48 | `ac8960867e84acd422ea9e6ffd26a77e63f5af65f748b83c86011231f6fdb2f7` |
| swarm.spr | 1790886 | 6410 | 4 ×64×40 | `9217f7d2e3896e2072f36fd4c4e544d989009ad185ce40787478b914e8a67603` |
| tornado.voc | 2188601 | 11582 | audio integration pending | `9d07506ad9833c92711ad6cc623d430e859af19c0974bb597cdefd8a5058fee8` |
| swarm.voc | 2143313 | 7292 | audio integration pending | `694dc046f73a3a99034d59febbd1ade9509c13ec4b7c4a64e0ae6799565e43f0` |

Natural trigger0x364b0 is also partly traced: calendar month1256 equal6 (July, **not a weather code**) consumes simulation RNG to request wind/tornado/swarm modes6/1/4; moisture>13 with flood counter0 requests mode3, moisture<0 requests mode2; flood ends when moisture<=9 and signed counter>3, drought ends when moisture>=3. Frequency/caller order still need checking. Mode3's separate flood dispatcher scans64 locations per call and deletes eligible fields/buildings; it cannot be replaced with the moving cell helper. All these remaining dependencies, source statistics and native checkpoint/browser integration must be completed before claiming playable disasters.
