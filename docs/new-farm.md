# Original new-farm setup

Setup resources, climate selection and the terrain-generation chain are recovered, but complete farm creation is not yet connected. `src/formats/new-farm.ts` decodes resources; `./tools/bun run import` produces ignored `public/assets/new-farm-setup.json` alongside the original raw members. `src/simulation/terrain-generation.ts` creates original terrain with a separate setup random history. Existing SSM loading and canonical simulation initialization are unchanged. Starting-location selection and initial player ownership/homestead are also recovered below. Cold record/definition decoding and default crop loading are also implemented. Runtime/account reset, price-history RNG, initial town construction, calendar/weather ordering and the setup UI remain before a complete new farm can be offered.

All executable addresses below are file offsets in SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Source files are read only. The independent annotated grids inside the original resource and saved climate triples provide cross-checks beyond the disassembly.

## Location data

`scenario.odt` is 4042 bytes at archive offset `0x1e3830`, SHA-256 `96f92b484fd6f531446aa8c203a75823c78055411fcfe627b3993b3b8b0da3b9`. Chooser `0x31ca0` opens it at `0x31e6d` and reads four consecutive 326-byte blocks (`0x31e7f..0x31ed8`). Each contains 324 ASCII letters followed by CRLF:

| Member offset | Plane | Encoded values |
| --- | --- | --- |
| `0x000` | Precipitation category | `a`–`d` |
| `0x146` | Temperature category | `a`–`d` |
| `0x28c` | Wind category | `a`–`d` |
| `0x3d2` | Selectable location mask | `a` invalid, `b` valid |

The chooser transforms each first-three-plane letter with byte arithmetic `(letter−1)<<5` at `0x31ee1..0x31f08`. This intentionally discards the ASCII high bits: `a/b/c/d` become `0/32/64/96`. It subtracts `0x61` from the fourth plane. Indexing is `y*18+x` (`0x31f22`); the 18×18 grid has 178 selectable cells. Selected first/second/third values enter DS66ab/66ac/66ad. Exit `0x32559..0x32585` arithmetic-shifts each by five into DS67b6/67b7/67b8, yielding categories 0–3.

Bytes from `0x518` onward contain notes and independently laid-out 18-row grids, including the labels “Temp data”, “Rain data”, “Wind Data” and “Hotpoint box”. They corroborate all 324 decoded locations. They are retained as uninterpreted trailing bytes; they do not override the four runtime planes. No geographic names or coordinates beyond the source grid are inferred.

## Climate presets

Finishing code `0x41030..0x4104a` pushes DS67b8, DS67b7, DS67b6 and calls resident overlay stub24e6:13a2. Its bytes at `0x28402` are `e8e8f1ead81cce271900`: overlay index25, entry offset1cd8, resolved file address **0x4a398**. The overlay index is the byte at stub+8, not a disassembled adjacent instruction.

Routine `0x4a398..0x4a55d` builds these filenames from its arguments:

| Source argument | Resource | Runtime table | Loop |
| --- | --- | --- | --- |
| bp+6 / DS67b6 | `rain%d.dat` | DS4186 | `0x4a3e1..0x4a43f` |
| bp+10 / DS67b8 | `wind%d.dat` | DS4094 | `0x4a46e..0x4a4cc` |
| bp+8 / DS67b7 | `temp%d.dat` | DS4278 | `0x4a4fb..0x4a559` |

Filename/format strings occupy initialized DSba7c..bac0 (file `0x9016c..0x901b0`). Each loop scans four decimal words with `%d,%d,%d,%d`, writes their low bytes, and increments by four until 240 entries. This is five years of 48 weeks, with four successive weeks per monthly row. It does not generate random climates. The native parser retains low-byte signed interpretation, validates all 60 groups, rejects out-of-word-range input and extra non-whitespace data, and applies the existing precipitation≤7 safety boundary after truncation. Negative precipitation remains supported by the existing forecast clamp. See SF-138 for unchecked original reads.

The files have 60 CRLF-terminated rows each. All values, including wind3's value41 at week index29, remain unchanged. No smoothing, interpolation, or extra randomness is added. Selecting any of the 64 category combinations returns independent copies so simulation changes cannot mutate the preset resources.

| Member | Archive offset | Bytes | SHA-256 |
| --- | --- | --- | --- |
| rain0.dat | `0xe4a09` | 540 | `956489b5ddb15f16085d7f3dc16bb1951ce1888e68aa91bfa0764b83d48c266b` |
| rain1.dat | `0xe4c25` | 540 | `d8bd1404d50f3f31b9457539db4250b5d9b2d776a8cbcc484cd3ad2b2ae4a7a3` |
| rain2.dat | `0xe4e41` | 540 | `980da545d6bfe8f80459ba22de622301f439c45de4117314bfd2656820fd4149` |
| rain3.dat | `0xe505d` | 540 | `a4b0cae3e6e0b3016e731ab3eeae4de3a2fd80d3db5617c7b204dd965a68e2fa` |
| temp0.dat | `0xe5279` | 780 | `32ba25918db67f0dbdc5c9e157b29b06274220dd9c67c9d79a7a227cfe74cbb4` |
| temp1.dat | `0xe5585` | 780 | `b88fdc0a66e8070c18906a186844433865143b3d3a7f4e9bbd04e1c686ed9e04` |
| temp2.dat | `0xe5891` | 780 | `4581f6cccc97128cfeda1e0f2cae5fc428f717630adbb0725b965b5ed2e731ed` |
| temp3.dat | `0xe5b9d` | 780 | `b69d60ee553d14cc657ab93fa27f079b5b39426264d8bfcdb90eec1bf6706525` |
| wind0.dat | `0xe5ea9` | 540 | `21c112c6152d7c8c2fc0acf360040c4f47871dcef76fc4deb0f6660cfe698345` |
| wind1.dat | `0xe60c5` | 580 | `6a5a7ceefbd499c8ee719e6d654c6333890bcba8d0c2577b58ceac29f1e14177` |
| wind2.dat | `0xe6309` | 775 | `a4259d1759a3357af8b374e7b308302716c7e84da478326de6d43d2390ce8528` |
| wind3.dat | `0xe6610` | 780 | `4820ec479e4c8c2398a466e487bd9314e0dda1c69c30067396839d07ac3b9634` |

Saved climate triples independently match `(rain,temp,wind)` categories `(2,2,3)` for SCEN0/1, `(3,2,3)` for SCEN2, `(0,1,0)` for SCEN3, `(2,1,1)` for SCEN4 and `(2,0,1)` for SCEN5. SCEN6/7 rainfall matches none of the four presets. Their original saved values must remain authoritative; this loader does not normalize saved farms to a location preset.

## Soil moisture and remaining work

Custom-world rebuild `0x337a6..0x337b4` writes byte `DS67b6<<2` to soil moisture at ES:0164 before calling stub24e6:1230 (overlay19, file `0x3fe1a`). With the verified categories 0–3, this gives 0/4/8/12. This path therefore supplies no missing extreme beyond ordinary forecast clamps0..12; natural drought/flood checks require<0/>13. This is a bounded finding about this writer, not proof that all original paths make those events unreachable. Do not invent event probabilities or change the gates.

Terrain generation `0x3fe1a` and DS67b4's river/lake bits are now implemented below. Starting-location selection and the player-property phase are now implemented; continue the reset/default-record and town initialization chain into `0x41084`. Trace initial land, records, money, crop loading and weather-call order before connecting React setup controls to canonical game creation. The native fresh-SSM weather initialization remains unchanged; custom-world regeneration must not be treated as a save loader.

Tests cover executable instructions/strings, independent map annotations, retained suffix/bounds, all twelve files and all 64 combinations, malformed climate input, signed truncation, six saved-farm climate/forecast/RNG cross-checks and the two unmatched rainfall tables. Browser regression checks cover existing asset/scenario loading; no new setup UI is claimed.

## Terrain generation

Generator `0x3fe1a..0x40200` calls overlay13 entry036e (`0x39e1e`) through stub24e6:129e, then overlay20 entry0032 (`0x40a82`) through stub24e6:1398 with arguments7/2. It floors remaining tile indices below15 to15, draws optional river/lake features, then calls shoreline redraw `0x16ff8`. Cursor changes around generation have no native terrain meaning. The implementation accepts explicit random state and preserves that state across rerolls; it does not run DOS timers or input.

### Additional original random stream

Helper `0x81ee..0x824c` is separate from the existing visual, simulation and bounded LFSRs. Five initialized words at DS1b7b..1b83 (file `0x8626b`) are `[1018,4521,202,419,3]`. Startup `0x2314..0x2339` adds the low three bits of the initial simulation seed to the first three. The fifth word is shifted but is not part of the sum. `TerrainRandom` retains all five words and consumes the shared visual stream:

1. Sum the first four words with16-bit wrap and shift old words into positions1–4.
2. Store `(sum + (nextVisual() & 31)) & 65535` at position0.
3. Return `min(maximum, floor((sum & 32767) / floor(32767/(maximum+1))))` using the **unperturbed** sum.

This is inclusive scaling, not the bounded rejection generator. Terrain uses maxima31/15/7/3/1. The native helper rejects invalid divisors/bounds before consuming state. DOS startup derives its simulation seed before the mix; the native caller must supply an explicit seed and must retain history for repeated setup previews. Existing farm checkpoints need no new fields yet because live farm creation/reroll state is not connected. Do not recreate this history on every future preview.

### Height passes and vegetation

`0x39e1e` clears all9216 terrain/overlay/attribute entries, then runs interpolation `0x39ca4` at steps16/8/4/2/1 with masks31/15/7/3/1. Both coordinates iterate from0 with the step, x-major. Points where both coordinates align with mask+1 are skipped. At the other points, consume one setup random value, subtract the step, and add an average of two axial neighbors or four diagonal neighbors. Clamp the result to1..15 and add grass base15. Exactly27/108/432/1728/6912 samples are written, leaving nine coarse anchors at raw zero. Reads use the evolving map. Boundary helper `0x39c48` reflects negatives and wraps only values>96; exact96 retains linear terrain/overlay aliases (SF-139). Those reads are represented explicitly without an out-of-bounds native access.

Population `0x40a82..0x40d6b` visits y-major. Attribute is `(tile−15)&15`; grass is `15 + soilMoisture + (attribute>>2)`. For attribute>=10, one visual draw masked15 below7 selects tree tile131+attribute. Attributes4/5 draw against threshold2, and success consumes another draw masked3 for rock535..538. Original table bases are overlay29 offsets085e=15,0860=39,08da=131,0980=535. Tree/rock writes replace the entire terrain word, as in the source.

Next, for y=1..95 then x=1..95, average eight neighboring attributes with clamped coordinates, excluding the center except where edge clamping aliases it. Writes are in-place; terrain images are not redrawn from the smoothed attributes. Region initialization is x-major over12×12: three masked visual draws initialize channels4/3/2 to0..60 in multiples of4. Channels6/5 receive attribute<<4/<<2 from **map(x,y)**, not map(8x,8y) or a region average (SF-141). Channels0/1 remain exactly as supplied; ownership initialization belongs to the separate reset/finalization path. The generator copies its input regional bytes and allocates a fresh map.

### Water options

DS67b4 bit01 gates a river (`0x3fea2`), bit02 a lake (`0x4006a`). These names describe the verified strokes, not a claim about exact original dialog text.

- River: one visual bit chooses orientation, then bounded94 gives the transverse start. The longitudinal coordinate visits0..95; valid origins paint three consecutive transverse cells as terrain3037 and attribute1. After **every** position, including invalid/last positions, consume one direction bit and one magnitude bit to add/subtract0/1. The source validates only the origin. Native clips each brush cell (SF-140), preventing writes into unrelated map columns/adjacent arrays, without adding RNG draws.
- Lake: consume bounded24 then bounded48 for each center coordinate. A visual masked7 plus4 gives radius4..11. Rows use sizes0..radius−1 followed by radius..1; each consumes jitter=`visual&3`, width=`jitter+2*size+1`, and starts at `centerX+(jitter>>1)−(width>>1)`. Both halves advance y. Source bounds tests use centerY rather than current rowY, but valid setup center/radius ranges keep all rows inside0..95. Native clips writes explicitly. Each accepted cell becomes terrain3037 and attribute1.
- Finally run the existing source shoreline scan with the same visual RNG. Generated water retains permanent/current water flags1000/2000; the evolving shoreline masks select original water tiles. No new shoreline algorithm was introduced.

Eight tests pin executable instructions/defaults and cover word wrap/inclusive RNG, exact96 aliases, all five sample counts/nine anchors, source vegetation thresholds/draw order, in-place smoothing, regional sampling, both river orientations/edge clipping/final draws, asymmetric lake rows, all16 soil/water combinations, untouched regional channels, unchanged simulation RNG and resumed rerolls. An ignored preview `artifacts/terrain-generation-preview.png` renders the four water combinations using original tile data and was visually inspected. It is a terrain preview, not an original-game screenshot or evidence that complete farm creation is finished.

### Next initialization dependency

Setup preview `0x33ca6` calls location chooser `0x33aa6`: this selects a town region near an edge and a player region after water eligibility checks. Later `0x40ef2..0x4102f` temporarily assigns400000 cash, marks a3×3 player region block and its24×24 map overlay ownership, calls another per-region initializer and then sets40000 cash before a homestead callback. The location and property callbacks are now implemented below. Resolve the remaining reset values, crop assignment, town creation and weather ordering before exposing creation in React.

## Starting locations and player property

`src/simulation/starting-property.ts` implements chooser0x33aa6 and the player-property phase of0x40ef2..0x4102f. It operates on the plain TypeScript map/region bytes; React and live game construction are not connected yet.

Location selection consumes a visual draw masked3 to choose an orientation. Subsequent draws are consumed in townX, townY, playerX, playerY order, omitting constant coordinates:

| Orientation | Town region | Player region | Total draws per attempt |
| --- | --- | --- | --- |
| 0 | `(visual&7)+2, 0` | `(visual&7)+2, (visual&3)+6` | 4 |
| 1 | `11−(visual&3), (visual&7)+2` | `(visual&3)+1, (visual&7)+2` | 5 |
| 2 | `(visual&7)+2, 11−(visual&3)` | `(visual&7)+2, visual&3` | 5 |
| 3 | `0, (visual&7)+2` | `(visual&3)+6, (visual&7)+2` | 4 |

The same candidate is accepted only if player origin, town origin, player east, player south and player southeast regions pass, in that source order. Helper0x33e36 scans every8×8 tile of a region and rejects low11-bit images39..68 (base39, count30). Flags1000/2000 alone do not reject a location. Native precomputes the region predicates without changing map or random state. Original retry has no bound; native stops only when the visual state repeats at an attempt boundary, returning an explicit no-reachable-location result (SF-142). It does not retry with a guessed seed or substitute another position.

The source writes the successful player region into protected-land coordinates and its tile origin(region×8) into homestead coordinates at0x33c7e..0x33ca0. Selection itself does not grant land or create a town. It tests2×2 player regions, although property finalization grants3×3 (SF-143). All resulting player origins fit the granted24×24 tile area.

Finalization marks all nine regions owned before invoking any fencing, then ORs0800 into all576 overlay words, preserving other overlay bits. It visits the nine regions x-major and invokes0x3cd0a through overlay stub24e6:12bc. That routine is the already recovered boundary fence helper; the native `fenceOwnedRegion` is shared with land purchases. Neighbor ownership suppresses interior fences. Water/other obstacles remain, while eligible grass/trees/rocks receive source fence connections. This phase is not nine land purchases and creates no land expense.

The original temporarily sets cash400000 before ownership/fencing, then sets40000 at0x41016 before calling1c78:0974 (file0x1f2f4) with rank0. The shared `updateHomestead` reproduces its nine terrain words. Reset0x407a5 supplies rank255, suppressing initial feedback. The native property phase returns40000 and the resulting rank0 homestead; the transient400000 value has no consumer in the recovered ownership/fence calls. It does not reset unrelated accounts or claim to supply the complete starting financial state.

Seven new tests cover source instructions, each tile of edge/interior eligibility regions, all four orientation formulas/draw counts, rejection in each checked region, unchecked third-strip water, terminating impossible maps, exact576-tile/nine-region ownership,92 perimeter fences on clear land, exact homestead tiles, preserved other bytes and invalid-input atomicity. Integration tests run all16 soil/water combinations at three visual seeds through terrain→location→property, compare restored RNG selection and preserve the other random streams. An ignored original-tile preview `artifacts/starting-property-preview.png` was inspected for the four water options; no live setup UI or original DOS run is implied.

Remaining initialization work: reset0x402a8/0x4060c and callback0x3f854, original crop/default record construction and price loading, starting town creation, financial accounts and weather ordering. The finalizer's climate call and selector tables are implemented separately; complete creation must combine these phases without retaining an existing farm's fields/equipment/loans. The current SSM loader remains authoritative for existing farms and must not become a substitute new-farm template with unexplained leftovers.

Additional reset call-chain evidence:0x3f854 clears regional type bytes to255 and ownership to0 after calling asset loader24e6:1384 (file0x49426), calls terrain wrapper0x4027e, then setup/finalizer24e6:137a (file0x40d6c). Its24e6:1212 call resolves to palette loader0x491ec with simfarm.pal. These callbacks separate graphics/palette reload from gameplay reset; do not treat every call as a new-state constructor.

## Cold record image, partial record reset and default crops

`src/formats/new-farm-records.ts` extracts original data tables from overlay29. Its initialized image starts at file4ec60, load segment2be7, so a segment:offset maps to `4ec60 + (segment−2be7)*16 + offset`. This is static data decoding, not a DOS memory/execution environment. Import writes ignored `public/assets/new-farm-records.json`; no SSM farm supplies this data. Native record views are detached copies. Existing SSM loading and GameSimulation initialization are unchanged.

| Records | Original address | File offset | Count × stride |
| --- | --- | --- | --- |
| Animals | 3d9f:6400 | 66be0 | 256 × 32 |
| Chemicals | 2d9f:edbe | 5f59e | 127 × 20 |
| Equipment | 3d9f:a6ba | 6ae9a | 127 × 56 |
| Fields | 6190:2432 | 86b22 | 98 × 68 |
| Buildings | 3d9f:8400 | 68be0 | 127 × 70 |
| Inventory | 2d9f:d5be | 5dd9e | 512 × 12 |

Every byte in these six shipped cold record tables is zero. The decoder nevertheless copies the complete source bytes rather than constructing zero-filled records or assigning meanings to unused fields. It also preserves every18-byte definition: DS6db8 equipment(12),6e90 buildings(9),6f32 crops(24),70e2 animals(5),713c harvest(16),725c seeds(16),737c chemicals(4),73c4 other goods(17). This retains dimensions, graphics, prices, extra definitions and unknown/pointer words. DS base remains file846f0. `createSetupRecords` validates table lengths and byte ranges before constructing native record classes.

`src/simulation/new-farm-records.ts` contains state-changing setup phases. `resetSetupRecords` follows0x403c6..0x40582: clear animal/chemical/equipment/building word+2, field word+6 and inventory **byte+10 only**. Clear definition word+4 in each table. All other record/definition bytes remain, including reserved slot0 and inactive records. This is a partial reset for a retained record image, not a claim that restarting the original clears all memory. Global activity counts are represented by active native records; associated account resets remain separate. No new original defect is inferred merely from retaining unused bytes.

### Planner image

Initialized2c8b:0000 maps to file4f6a0; the3072-byte scratch buffer is initially zero. Reset0x4092c..0x4094a writes1536 words209 to this buffer. File initializer0x48c9e..0x48d07 writes **1176 words**, twenty times, from its start. The resulting47040 bytes are the240×98 schedule: the first twelve-week block is repeated twenty times. `createSetupSchedule` performs that copy, including unknown codes; it does not replace a caller's buffer with guessed fallow entries. Tests deliberately use1176 distinct words and a different unused tail, then verify every schedule word. Full startup ordering still needs to establish any intervening buffer writes before choosing the cold-versus-reset input in canonical creation.

### Original default crop list and loading

Main0x23a2..0x249f calls crop loader0x46520 for these sixteen slots, from filename literals at DS0080..0128:

`corn, wheat, barley, potatoes, oats, rice, sorghum, soybeans, cotton, onions, tomatoes, lettuce, carrots, strawber, sugar, peanuts` (all `.crp`).

These are cold-start defaults, not an instruction to overwrite a restored farm's crop choices. Native `loadStartingCrops` resolves all sixteen catalog entries before mutation. Source0x466a4..0x4672f stores definition pointer2d9f:(c5ac+slot*128) at words+14/+16 in crop, harvest and seed definitions, assigns crop price from CRP word+34 and seed price=`max(5,CRP word+38>>2)`. Harvest price and other fields are retained. The pointer words are raw preservation data, never browser addresses. Returned128-byte crop definitions are independent copies, and unused crop entries16–23 remain unchanged. The live game already implements crop/seed pricing for SSM imports; this new phase supplies original references and prices for future native farm creation.

The subsequent0x24a2..0x24b9 calls0x4adfc for each crop to initialize thirty price-history words and consume the simulation RNG. That phase is now implemented below; canonical farm creation must call it in the source order. Do not assume that copying base prices consumes no subsequent startup randomness.

Six tests pin the full executable hash/instructions, all record and definition bytes, exact crop slot order, unsafe/truncated input rejection, detached ownership, partial-reset byte boundaries, twenty planner blocks, loaded crop pointers/prices, minimum seed price and atomic missing-crop rejection. Import/build and existing browser-loading checks protect the asset path; these are not browser new-farm flows. Remaining work includes reset financial/runtime values, town creation, weather/calendar order and the canonical constructor/UI. SourceByte template representation for new farms also needs explicit design; no existing farm's records or loans are being reused to make creation appear complete.

## Startup crop market history

`src/simulation/starting-market.ts` reconstructs0x4adfc..0x4aea3 and main's sixteen calls0x24a2..0x24b9. The default decoder now also reads market mode byte DSbc66 from file90356, initially0; record reset leaves it untouched. Values outside0..2 are retained and take the original no-adjustment path. The ES selector at file9166e is4d9f, and writes at0x4ae79 address `4d9f:fa00 + cropSlot*60 + historyIndex*2`: sixteen independent thirty-word histories. Confidence is high on these bytes and branches, without a DOS execution comparison.

For each crop in slot order, take price from definition word+6 and calculate `step = price >>> 2` once. Repeat thirty times:

1. Store the current price in the history before consuming randomness.
2. Draw `nextSimulation() & 7`. Mode0 decreases for0..3 and increases for4..7. Mode1 decreases for0..1 and increases for2..7. Mode2 skips0..5 and increases for6..7. Other mode bytes skip all further draws.
3. For an increasing/decreasing branch, draw a gate bit. Zero skips the adjustment; one consumes another bit.
4. Add `(bit+1)*step` for increasing, or `(bit−1)*step` for decreasing, retaining the low16 bits. There are no clamps. Do this even after storing entry29; the discarded local price does not matter, but the RNG state does.

The source does not write these generated prices back to crop, seed or harvest definitions in this routine. Native likewise returns detached histories while leaving those tables intact. This distinction matters for later integration: do not overwrite definition prices from the final history merely to force equal representations. Existing SSM imports and v14 checkpoints have no new market state yet, and their behavior remains unchanged.

SF-144 records the unchecked arithmetic and mode2 asymmetry. Five tests cover exact instruction/data evidence, all256 mode bytes with every low-three-bit choice/gate/magnitude, the final discarded adjustment, fixed unsigned steps, zero/small/high prices, actual corn underflow with seed19, sixteen original crops, record-price preservation, resumed RNG and invalid-input rejection before random consumption. With initial streams visual27/simulation9029/bounded51 and cold mode0, all sixteen histories consume1206 simulation draws, end at simulation10344 and leave the other streams unchanged. The960 little-endian history bytes hash to SHA256 `d05fde61efbf8980b9e7c988cfc7b8df79a7d6871230df9ca2ba116941dd9cdc`; this fixture was independently calculated from the documented arithmetic and source CRP blocks, not captured from original execution.

The ongoing updater0x4aea4 is separate: it shifts histories, uses a signed eighth-price step and different mode direction thresholds, applies bounds, and synchronizes crop/harvest/seed prices. Its dispatch timing, counter DSbc72 writers and live history ownership/save integration remain to be recovered. This startup increment does not claim that periodic market fluctuations or the setup UI are live. Next resolve runtime/account initialization, then town/calendar/weather and canonical creation.

## Cold accounts, clock fields and partial restart

`src/formats/new-farm-runtime.ts` reads the initialized overlay29 image into serializable farm/financial defaults. Reproducible import writes ignored `new-farm-runtime.json`. This is the state **before** location/property/town/date initialization, not a complete new farm or a cleared SSM. For example, cold cash is20000 and town-region X is the unset word65535. Property finalization later supplies40000 and location selection supplies real coordinates. Cold calendar is day1/season1/week1/year1992/month0; the separate first-launch date routine can overwrite it. The decoder does not silently replace those source values with a guessed playable state.

All following addresses use DS6190 unless a segment is shown. The static-image formula remains `4ec60 + (segment−2be7)*16 + offset`, and source SHA256 remains `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`.

| State | Source offsets | Cold values / interpretation |
| --- | --- | --- |
| Cash; sales accumulator | 3e48;3e44 | 20000;0 |
| Calendar day/season/week/year/month | 124e/1250/1252/1254/1256 | 1/1/1/1992/0 |
| Equipment/calendar ticks; animation ticks | 139e;13a0 | both0 |
| Day delay; speed; pacing flag | 1f8c;1f90;0187 | 256;1;0 |
| Automatic rent/seeds/clearing | a89d/a89c/a89f | 1/1/0 |
| Equipment/building book value | 3e50/3e54 | both0; **3e4c is a different unnamed account** |
| Crop/equipment/land/contract/livestock income | 3e60/3e64/3e68/3e6c/3e74 | all0 |
| Seed/equipment/land/contract-loss/worker/chemical expenses | 3e78/3e7c/3e80/3e84/3e88/3ea0 | all0 |
| Balance payments/rentals/taxes | 3ea4/3ea8/3eb4 | all0 |
| Prior taxes; unnamed annual accounts | 3e40;3e70/3e8c/3e90/3e94/3e9c | all0; existing address-based names retained |
| Livestock/other expenses; report income/expense/net | 3e98/3eac;3ebc/3ec0/2d9f:fa18 | all0 |
| Principal/payment/available credit/selection/rate | b3ae/b3b2/b394/b398/b3a4 | 0/0/0/0/15 |
| Balance due/countdown; unpaid taxes/countdown | 2d9f:d5ba/4d9f:fed6;7518/4d9f:fed7 | all0 |
| Tax failure byte | 3eed | 0; increment verified at0x1d64c |
| Protected player-region coordinates | 2d9f:0010/0012 | 0/0; later selected |
| Homestead coordinates/rank | 2d9f:000c/000e;462e | 0/0/255 |
| Town origin; active development site | 7592/2d9f:d530;4d9f:fedb/fedc | 65535/0;0/0 |
| Town revenue/expansion funds/development spending | 758a/758e/7514 | 4800/40000/0 |
| Airport/recreation counts | 64c6/9cbc | both0 |
| Recreation X/Y byte arrays | 2d9f:f7aa/f7b2 | eight zero bytes each; interleaved in native representation |
| Annual statistic dwords/regions/words | 3e58/3e5c;750d..7510;444c..4466 | all0 |
| Field presence/distinct count; deficient/stressed counts | 448e..4495/4560;2d9f:fa1c/fa1e | all0 |
| Retained unnamed reset fields | 3e4c;3eb8;4468..448c;64c5 | two dwords, nineteen words and one byte, initially0 |

`createSetupRuntime` creates detached native owners and validates input values, while linking animal/other definition tables to the same objects as `SetupRecords`. It uses the existing bounded financial decoder and the existing SF-060 native empty clearing queue (X sentinel255), not the defective cold zero-coordinate interpretation. No active default decision exists in cold native setup. The returned unset town coordinate deliberately cannot be treated as a live farm: the complete constructor still must finalize it, place property/town, initialize weather and represent retained raw fields in native saves. No existing scenario records or loans are borrowed as templates.

`resetSetupRuntime` ports only the account/clock/statistic phases of0x402a8 and0x4060c, separately from record reset, map/disaster reset and subsequent setup callbacks:

- At0x40318..0x40355, clear distinct field statuses, eight presence bytes and **nineteen words at4468**, then call annual reset0x1d396. The preceding fourteen statistic words at444c are not this array and remain unchanged.
- Reuse the recovered annual reset: clear its listed income/expense ledgers and both native precipitation views, copy old taxes3eb4 into prior taxes3e40, then clear taxes. Worker expenses and report totals survive this phase (SF-042).
- At0x4061b..0x40723, restore expansion funds40000/revenue4800, clear recreation count, equipment book value, unnamed3e4c/3eb8 and statistic dwords3e58/3e5c. Do **not** clear building book value3e54 (SF-065).
- At0x40727..0x407c9, restore auto-rent/auto-seeds, disable auto-clear, set day/season/week1, year1992, month0, rank255, and both tick words0. The source also changes unrelated UI/settings bytes; this helper makes no claim to cover those subsystems.
- At0x407dc..0x408de, clear the four loan dwords, balance due, tax debt, sales accumulator, airport count, unnamed64c5 and both debt countdowns.

Cash, player/town/home coordinates, loan rate, tax-failure count, town active site, recreation coordinate bytes, development-spending word, annual regions/fourteen-word history, deficient/stressed counters, pacing flag, speed and day delay are retained by this phase. Later routines may replace some of them; these limited writes do not prove a complete restart leaves all of them intact. Weather, disaster flags, map clearing and setup decisions retain their separate ownership and pending integration. Existing live SSM imports/checkpoints do not invoke this helper.

Five tests pin original instructions/hash and cold values, perturb neighboring source dwords to distinguish every financial account (including3e4c versus3e54), exercise high-bit values and interleaved recreation coordinates, check detached/shared ownership and malformed-input rejection, and run repeated reset with nonzero/maximal ledgers and retained values. Financial encode/decode round trips reuse the current native representation without claiming complete new-farm save integration. Remaining construction work is town creation, first-launch versus restart calendar/weather order, other runtime owners and the canonical setup constructor/UI.

Next-step call-chain evidence: startup0x3fab5..0x3facb invokes district constructor through stub24e6:112c (overlay15 offset0, file3aba0) with town X/Y, type0 and fourth argument2. It then writes town origin into active-site locations4d9f:fedb/fedc at0x3fadc/0x3faec; the writes are words at adjacent addresses, while existing native/SSM coordinates are bytes. Audit the extra neighboring byte before claiming complete raw-state coverage. Stub1370 immediately preceding construction resolves to the already decoded town-layout loader0x4a366. Main's eight later calls9ab:163a resolve to file0xd2ea, an allocator for sixteen eight-byte entries atDS1efc with active count1efa: it sets flags3, X/Y, argument byte4 and a visual random direction masked3. Reset9ab:160e at0x405fc resolves to0xd2be, clearing each entry's flag byte and the count. These entries are an additional runtime owner, not eight district constructions; their broader meaning/updates remain unclaimed.

First-launch calendar follow-up: helper0084:337a is file0x5dba and invokes INT21/AH2a, then stores CX at caller buffer+2, DH at+1, DL at+0 and AL at+4. Main0x235c..0x2367 copies buffer+4 to day and buffer+2 to year, while0x2381..0x238d forces week0/month3/season1. Resolve the date input policy and distinguish it from restart's fixed calendar before connecting native setup. No DOS calls or execution environment will be used in the browser.
