# Original new-farm setup

Setup resources, climate selection and the terrain-generation chain are recovered, but complete farm creation is not yet connected. `src/formats/new-farm.ts` decodes resources; `./tools/bun run import` produces ignored `public/assets/new-farm-setup.json` alongside the original raw members. `src/simulation/terrain-generation.ts` creates original terrain with a separate setup random history. Existing SSM loading and canonical simulation initialization are unchanged. Starting-location selection, ownership, starting records, crop selection and the setup UI still need reconstruction before a new farm can be offered as original behavior.

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

Terrain generation `0x3fe1a` and DS67b4's river/lake bits are now implemented below. Next reconstruct starting-location selection and the reset/finalization chain into `0x41084`. Trace initial land, records, money, crop loading and weather-call order before connecting React setup controls to canonical game creation. The native fresh-SSM weather initialization remains unchanged; custom-world regeneration must not be treated as a save loader.

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

Setup preview `0x33ca6` calls location chooser `0x33aa6`: this selects a town region near an edge and a player region after water eligibility checks. Later `0x40ef2..0x4102f` temporarily assigns400000 cash, marks a3×3 player region block and its24×24 map overlay ownership, calls another per-region initializer and then sets40000 cash before a homestead callback. Those are research leads, not implemented starting-farm behavior. Resolve the callbacks, reset values, crop assignment and weather ordering before exposing creation in React.
