# Binary evidence

Original defects and suspicious arithmetic are tracked separately in [original-bugs.md](original-bugs.md), including preservation/fix decisions.

All executable addresses below are **file offsets**, not runtime addresses. Run `./tools/bun run analyze --start 0x4543c --size 0x1000` to reproduce the scenario-loader disassembly. The analyzer pins the exact executable SHA-256; the importer records every input and archive member in generated `public/assets/manifest.json`.

## Executable and overlays — recovered

MZ header: 8,704 bytes, 2,155 relocations, declared resident file size 171,742 bytes, entry `24e6:076c` / file `0x277cc`. The physical file is 595,897 bytes. The startup code jumps to C startup `0084:0010`, which selects DS `0x6190`.

The overlay manager uses a table at its DS offset `0xc1f` (file `0x27c7f`), with 30 records of 18 bytes. At `0x27670` it multiplies the overlay ID by `0x12` to find a record. Fields used by the loader:

| Record offset | Meaning |
|---|---|
| +0 | Load segment |
| +4 | File paragraph, low word |
| +6 | File paragraph high byte and flags |
| +8 | Allocated paragraph count |
| +10 | Relocation count |
| +16 | Initialized paragraph count |

At `0x27336`–`0x27392`, the loader seeks to `(fileParagraph + ceil(relocationCount / 4)) * 16`: the relocation table precedes each payload. Treating the appended bytes as one linear code segment decodes relocation records as instructions and loses the overlay identity.

Overlay 22 has payload file offset `0x42c00`; the stub at `0x2827c` invokes overlay ID 22 and jumps to `27ce:283c`, giving file `0x4543c`. Overlay 29 has payload `0x4ec60` loaded at segment `0x2be7`; this maps DS `0x6190` to file `0x846f0`. String references at `0x465b8` resolve to “readcrop in saveload”, independently confirming the DS mapping.

## Archive and graphics — decoded, tested

`MEGADATA.IDX`: 152 records, 20 bytes each (16-byte NUL-terminated ASCII name plus uint32 little-endian offset). The final record repeats `card48.hc` with offset equal to archive length: it is a sentinel, not another member. There are 151 nonempty resources, covering the complete archive with no gaps.

`simfarm.pal`: 16 RGB triples, each component 0–63. Images use four contiguous one-bit planes, least significant plane first and most significant bit leftmost. `.bmp` members have four uint16 header values: row bytes, height, plane count 4, version 1. `ega16til.til` contains 880 consecutive 16×16 tiles of 128 bytes each. Title `.int` images are 640×480 raw planar images with their own palette.

Crop `.CRP` files are 5,890 bytes. First eight 128-byte tiles at `0x0000`; a 112×64 card image at `0x0400`; other graphics through `0x1500`; a 128-byte definition at `0x1500`; presentation text at `0x1580`. The loader at `0x46654` reads `0x1500` bytes then `0x80` bytes into a 16-slot, 128-byte-stride crop table. Names occupy the first 16 definition bytes. Unknown definition fields are retained verbatim. Text uses `@` padding, physical CRLF wrapping and `~` paragraph separators. Crop economic and growth semantics are not yet recovered.

## Scenario world — structure recovered from code

The loader at `0x4543c` calls the file-read routine `0084:074a`. The serialized prefix is:

| File offset | Data | Read evidence |
|---|---|---|
| 0 | One-byte version (`0x18`) | `0x454a2` |
| 1 | Count + 256 × 32-byte records | `0x45536` |
| `0x2003` | Count + 127 × 20-byte records | `0x4557c` |
| `0x29f1` | Count + 127 × 56-byte records | `0x455bf` |
| `0x45bb` | Count + 98 × 68-byte records | `0x45602` |
| `0x5fc5` | Count + 127 × 70-byte records | `0x45645` |
| `0x8281` | Count + 512 × 12-byte records | `0x45688` |
| `0x9a83` | Byte count + 16 × 8-byte records | `0x456d4` |
| `0x9b04` | 23,520 uint16 values copied to a temporary file | `0x45734` |
| `0x152c4` | 96×96 cells, five bytes each | `0x45782`–`0x457fa` |
| `0x206c4` | Further serialized state, still being mapped | `0x457fc` onward |

Each cell is two little-endian uint16 values plus one byte. The loader stores these at `2d9f:0424`, `2d9f:4c24` and `2d9f:9fe4`. The index is **column-major: `x * 96 + y`**. This corrects the initial row-major assumption, which transposed the first browser maps. The renderer at `0x1fa22`–`0x1fc9a` proves the order: outer X advances at `0x1fc52`, inner Y at `0x1fb3e`, and `0x1fb73` multiplies the outer index by 96. The terrain reader at `0x9536`–`0x9556` masks AH with 7, recovering an 11-bit tile index. Every such index across all eight scenarios is below 880. Unidentified flags and attributes remain intact.

Sixteen 14-byte crop filenames begin at `0x21193`, verified by summing the intervening loader reads and the loop at `0x45a37`–`0x45a7f`. They select runtime crop slots; the slot is not a fixed crop identity. For example, scenario 0 loads almonds/grapes into slots 0/1, while scenario 7 loads tobacco into slot 0.

## Development references

[Vite's official guide](https://vite.dev/guide/) supplies the project/build conventions. [ScummVM's XMIDI parser](https://github.com/scummvm/scummvm/blob/master/audio/midiparser_xmidi.cpp) is a format cross-check for additive delay bytes, note durations, and a fixed 120 Hz clock; no ScummVM code is copied into this project.

## Music — native conversion and temporary playback

All eight `.xmi` members contain one IFF `EVNT` stream. Conversion uses additive delay bytes, VLQ note durations, explicit generated note-offs (minimum one tick), and a 120 Hz timeline. Standard MIDI type 0 output uses 60 PPQN and 500,000 microseconds per quarter note. Source tempo/time-signature metadata is retained in JSON; the source tempo is not used to change the XMIDI tick rate. Tests verify note balance and program changes for every track and malformed/truncated input rejection.

Observed ordinary channel messages require note on/off, program changes and volume controller 7. `genfarm.xmi` additionally contains AIL infinite-loop controls 116/117, including a start at tick 59. The current export is **one linear pass**, and playback repeats the exported track after its end; it does not yet preserve those internal loop boundaries. AIL finite loops, indirect controller prefixes, and callbacks are rejected instead of silently misinterpreted. SysEx and source metadata remain in JSON and are not sent to the temporary synth.

The browser schedules MIDI events into native Web Audio oscillators and noise percussion (no FM/AdLib). It responds to program families and channel volume, but is not a General MIDI instrument implementation. Replace it with a sampled GM engine and verify exact track loop behavior before claiming music fidelity. Browser tests measure nonzero waveform samples during playback and silence after Stop. An initial percussion stop-before-start error was caught by that test and fixed.

## Native rendering — crop substitution and masked tiles

The upload routine at `0x468c2`–`0x46a13` substitutes fourteen tiles per crop slot `s`. The importer now builds a separate atlas for each scenario using these exact mappings:

| Crop byte range | Destination tile(s) | Evidence |
|---|---|---|
| `0x0000`–`0x03ff` | `688 + s * 8` through `695 + s * 8` | Table at overlay-29 data offset `0x882` |
| `0x1200`–`0x13ff` | `539 + s * 4` through `542 + s * 4` | Immediate `0x21b` and slot multiplication |
| `0x1400`–`0x147f` | `816 + s` | Table at data offset `0x938` |
| `0x1480`–`0x14ff` | `832 + s` | Table at data offset `0x90c` |

The data tables are relative to file `0x4ec60`. Tests compare the mappings directly with the executable tables and original crop bytes for all eight farms (224 replacements each).

Renderer `0x1fbe2` masks the first word with `0x07ff`. At `0x1fbef`, first-word bit `0x0800` requests a second, masked layer. Its index is `(secondWord & 0x07ff) - 848`, indexing `mskdtile.til` (200 four-plane tiles, 25,600 bytes). Loader `0x4959f` copies 848 base tiles before the masked range. Graphics routine `0416:103f`, file `0x739f`, derives its mask from `(~plane3) & plane2 & plane1 & plane0`: **color 7 is transparent**, including no other color. Black remains opaque. The importer makes this transparency explicit in PNG alpha; browser canvas composites it over the base tile.

Browser tests compare full 16×16 RGBA regions with independently decoded source tiles: scenario 0 grapes at `(41,31)` and masked tile 0 over base tile 170 at `(59,85)`. The screenshot at `artifacts/native-browser.png` is also inspected. Native drawing includes recovered crop and masked layers, but moving machinery/livestock, seasonal palette changes, and remaining render passes are outstanding.

## Fields — records and inspection recovered

The `0x45bb` count precedes 98 records of 68 bytes at `0x45bd`. Runtime base is `6190:2432`; slot zero is reserved. Active counts across scenarios 0–7 are `13,9,9,3,8,5,7,7`. All supplied active fields start in state 4 (Growing) and span 8×8 tiles. Field number is distinct from record slot.

| Record offset | Recovered meaning |
|---|---|
| +0 uint16 | Displayed field number |
| +2 byte | Work state |
| +3 byte | Work-state substep |
| +7 bit 0 | Active record |
| +10, +11 bytes | X, Y origin |
| +12, +13 bytes | Width, height |
| +14 byte | Scenario crop slot |

Point query `0x1b928`–`0x1b994` tests inclusive origins and exclusive far edges. Field creation `0x1ba84`–`0x1bc32` initializes these members and sets the active bit. Ten 16-byte status strings at file `0x8a598` identify Waiting, Clearing, Plowing, Planting, Growing, Harvest, Fertilize, Pesticide, Herbicide and Fungicide. Original plow and plant handlers independently confirm state IDs 2 and 3. The native parser preserves all 68 bytes, validates active counts/bounds, and exposes only supported meanings. The browser locates and outlines fields and shows their source crop and status; it does not yet execute work orders.

### Action and simulation reconstruction targets

- Plow handler at `0x26c64` finds the field through `1957:01b8`, requires Waiting, then sets state 2 and substep 0 at `0x26ccf`. It schedules work; it does not instantly replace terrain.
- Plant handler around `0x23fc7` sets state 3, substep 0 and crop slot +14 after seed/contract handling. Equipment is acquired later by the field FSM, not checked by this click handler. Its marker update calls `15b3:1988` (file `0x196b8`). Reconstruct prerequisites before exposing planting.
- Field update loop `0x17d3c`–`0x18ccb` dispatches work state and substep. Equipment work FSM `0x156be`–`0x16abc` selects machines through `0d5f:1de6` (file `0x115d6`) and maintains field offsets +42/+44/+46. Machinery records have 56-byte stride at scenario `0x29f3` / runtime `3d9f:a6ba`.
- Growth code around `0x1930f`–`0x195be` increments field age and computes graphic stages from crop definitions. Environmental mutation helper `0x19846`–`0x19c61` dispatches eighteen modes; exact units, ordering, random source and clock integration remain to be recovered.
- Field status/marker routines `0x19002` and `0x196b8`–`0x19845` update badge tiles. Initial saved badges are rendered, but their dynamic updates are not implemented.

These are static-code leads, not implemented simulation claims. Recover the scheduler, equipment prerequisites, growth arithmetic, cash/calendar state and random generator before claiming an original farming loop.

## Calendar, saved global state and random streams — native primitives

The crop table ends at `0x21273`. The loop at `0x45a81`–`0x45b86` reads seven bytes per 12×12 region (column-major), ending at `0x21663`; the following eight pairs of bytes end at `0x21673`. Summing subsequent explicit read sizes proves these save offsets:

| Save offset | Runtime variable | Meaning / loader call |
|---|---|---|
| `0x216e4` uint32 | `6190:3e48` | Cash; read at `0x45f0e`; all farms start with 40,000 |
| `0x216ed` uint16 | `6190:124e` | Day within week (0–6) |
| `0x216ef` uint16 | `6190:1250` | Season (0–3) |
| `0x216f1` uint16 | `6190:1252` | Week within month (0–3) |
| `0x216f3` uint16 | `6190:1254` | Year; all farms start in 1993 |
| `0x216f5` uint16 | `6190:1256` | Month (0–11) |
| `0x216f7`, `0x216f9` uint16 | `6190:13a0`, `6190:139e` | Tick counters, not dates |
| `0x2171a`, `0x2171c` uint16 | `6190:1f8c`, `6190:1f90` | Day delay and speed setting; saved values 256 / 1 |

`6190:1ed4`/`:1ed6`, previously mentioned as calendar candidates, are animation state instead. The interrupt at `0x6254` increments both tick counters and forwards every fourth interrupt. Main update `0xbcb8` calls calendar/weather `0xc88e` before field work `0x17d3c`; pauses are checked before this sequence. Calendar advancement requires unsigned `(ticks - lastDayTick) > delay` at `0xc8a9`–`0xc8b5`.

Calendar arithmetic uses seven-day weeks, four-week months and twelve-month years (336 days), with weekly subsystem calls **before** incrementing the week. Season assignment at `0xc94d`–`0xc9a9` uses the incremented week index before month rollover: 45–47 and 0–9 → 0; 10–21 → 1; 23–33 → 2; 34–44 → 3. Week 22 has no assignment and retains its prior season. Month rollover is `0xcc05`–`0xcc1b`; year reset/increment is `0xcded`/`0xcfa1`. `advanceCalendarDay` implements only this arithmetic; weather, finances and scheduling callbacks are not claimed ported by it.

`FarmRandom` reproduces three independent generators:

- `05fd:007d`, file `0x824d`: eight shifts, feeding XOR of bits 1/2 into bit 15; state `6190:1b79`.
- `05fd:00d0`, file `0x82a0`: right shift, XOR `0x3500` if the old low bit was set; state `6190:1b96`.
- `05fd:00a3`, file `0x8273`: right shift with conditional XOR `0xb8`; subsequent rejection shifts until at most the bound, equality returns zero. Only the **first** shift is stored in `6190:1b98`.

Monthly seed perturbation `0xcc20` adds four times the incremented month and resets values above `0x1fff` to 1234 (signed comparison). Initialized executable seeds are 27, 9029 and 51, but startup mutates state; these are not claimed to reproduce a complete DOS session from its save. Call ordering and startup integration still need reconstruction. Tests use explicit seeds and fixed sequences.

## Growing fields — arithmetic and Growing dispatcher ported

`growField` ports Growing-state arithmetic from `0x1843c`–`0x1859a`, growth routine `0x192e2`–`0x195ce`, and water-stress helper `0x195d0`–`0x196b7`. It runs only when field byte +33 equals the calendar week, then increments that byte modulo four. Temperature contributes `max(0, temperature - crop[67]) * 7` toward the field's uint16 deficit at +38 against crop uint16 +30. Crop uint16 +28 enables a cold counter (+40) below 45. Field age (+34) advances once per eligible call.

The crop definition's bytes +50/+51/+52 control depletion of field bytes +29/+30/+31. Field +60/+61/+62 drive condition growth; nonzero crop resistance bytes +58/+59/+60 quarter the corresponding increment. `changeFieldCondition` implements the eighteen-mode jump table at `0x19c3c`, including coupled 12×12 regional updates. Some original regional reductions have a reversed comparison: they zero values above the amount and wrap values below it. This is present at `0x1c5a5`, `0x1c63b`, `0x1c723`, `0x1c767`, `0x1c7fd`; preserve it rather than silently correcting it. Fields +30/+31 also remain unchanged when depletion exceeds their value.

Water-stress bounds are crop uint16 +40/+42 with field tolerance bytes +51/+52. Out-of-range water (+24) consumes one simulation random value and produces a byte-wrapped penalty. Combined stress drives a saturating uint16 accumulator at field +18 through `0x1b7c6`; its later yield interpretation remains to be followed through harvest code.

Graphics stage uses rounded age divided by `ceil(crop[56] / crop[66])`, with a temperature-deficit delay. Only existing crop tiles 688–815 are replaced, retaining terrain flags and field badges. Crop byte +76 controls the expiry result after the age limit; cleanup is now ported below, while replanting/harvesting remain outstanding. The optional crop flag +63 bit `0x20` invokes a bust/fine event at `0xa7de`; none of the 24 distributed crops sets it. The native routine explicitly rejects that unported branch.

These TypeScript routines are tested independently and now run from the partial browser scheduler described below. The complete playable farming loop still requires equipment actions, harvesting, inventory and sales.

Mutable field and region records explicitly copy input bytes with `Uint8Array.from`. The same fix applies to crop atlas patches: `Buffer.slice()` aliases memory, unlike `Uint8Array.slice()`, and the importer receives Buffers. Tests now assert unchanged original inputs with independent copies, not aliased snapshots.

## Field status and expiry integration

`src/simulation/field-status.ts` ports `0x19002`–`0x192e1` and the badge writer `0x196b8`–`0x19845`. A badge occupies two columns and rows at `(field.x + position*2, field.y)`, with tile quadrants `539 + badge*4 + [0,1;2,3]`. Erasure copies low eleven terrain bits from the two rows below, retaining destination flags. The crop identity badge at position zero is not erased by a status refresh.

The status routine is stateful: `0x1c50a` copies field byte +29 to +28, which the growth formula subsequently consumes. It is not an average of three nutrients. Water warnings use signed byte thresholds, fertility warns below 128, and toxicity above the initialized constant 128 (`6190:016b`, file `0x8485b`). Pest warnings above 52 rotate using field byte +56 and can overwrite the toxicity badge while retaining its bit. See SF-006 for the water-warning discrepancy.

`src/simulation/field-lifecycle.ts` connects this status refresh to the Growing dispatcher branch before growth, then invokes expiry cleanup (`0x1c2a8`–`0x1c3f0`). Cleanup returns 70 nutrient units for Growing fields, resets state/step/accumulator, removes warning badges and turns only crop tiles 688–815 into tile 34. Already-waiting fields instead receive 10 nutrient units. Sound/camera side effects are not implemented by these simulation routines.

This establishes the complete Growing branch, not the other equipment-driven work states or a complete game scheduler. Tests advance an original saved corn field through expiry and check actual terrain/state transitions, plus badge layout, rotation, nutrient sampling and equipment-occupied early return.

## Climate, field water and native state owner

The loader at `0x45801`–`0x4585d` reads 240 interleaved signed byte triples starting at SSM `0x206c4`: wind, precipitation count, temperature. They populate `6190:4094`, `:4186`, `:4278`, respectively, five years of 48 weeks. The precipitation-day counter is a saved word at SSM `0x216e8` (loader `0x45f26`, runtime `6190:2412`).

`weather.ts` ports daily evaporation/precipitation (`0x1e580`–`0x1e63b`), weekly moisture and forecast generation (`0x1e63c`–`0x1e910`), sky selection (`0x1e912`–`0x1e98d`), and wind arithmetic (`0x1e1ae`). Seven-day precipitation patterns are recovered from constant stores at `0x1e648`–`0x1e7a0`. Temperature above 32 gives rain, otherwise snow. Dry days consume one visual RNG call. Forecast indexing uses precipitation's year selector for both precipitation and temperature, and wraps at 240.

Daily clear/partly-cloudy/cloudy weather subtracts 6/3/2 from the moisture accumulator at wind >=15, otherwise 2/1/1. Rain/snow adds eight and increments the precipitation-day word. Weekly accumulation beyond ±7 changes global soil moisture (`6190:0164`) with original signed-byte limits; negative division uses arithmetic shift. Both grass update helpers (`0x16bd4`, `0x16c78`) replace tiles 15–30 with `15 + moisture + (cell.attribute >> 2)`, retaining upper flags.

Field-water refresh (`0x18d16`–`0x19001`) sets water to twice global moisture, plus five for disaster flag bit four. It counts adjacent tiles 98–108 and 87–97 into tolerance bytes +51/+52. The horizontal scan includes x+width, while the vertical scan excludes y+height; the native routine preserves that asymmetric border. Weekly dispatcher `0xbdbe` calls wind before field water/status (`0xbe74`, `0xbea3`), **before** the calendar rolls and moisture/forecast update runs. Fields therefore see the previous moisture level at this refresh.

`GameSimulation` owns copied scenario records, crops, climate, RNG and runtime weather; React reads detached cached snapshots and submits commands through `useSyncExternalStore`. Daily ordering follows `0xc88e`: increment day; odd-day nutrient/toxicity/status work (`0xd1ae`, including temporary day seven); old-week wind/water/status work; calendar/temperature rollover; forecast/soil update; daily weather; Growing dispatcher. The fifth year-end temperature overread is explicitly preserved (SF-007). Unsafe imported precipitation counts are rejected (SF-008).

Initialization uses executable fresh-process defaults (soil moisture eight, wind five, weather-year selectors zero) and the forecast/temperature operations at `0x24ef`–`0x2532`. The startup temperature uses table entry zero, even when the loaded calendar is later in the year. **SSM does not serialize these runtime weather globals or RNG streams; an arbitrary DOS session's weather/random state cannot be inferred from this decoder alone.** Complete startup call ordering and all frame-dependent RNG consumers remain to be reconstructed. Explicit native seeds give reproducible native runs, not complete DOS replay parity.

The exposed clock runs one day per browser second, pauses in background tabs, and resets on scenario changes. It does not claim original DOS timer pacing. The scheduler currently omits machinery/work orders, economy, buildings/pumps, livestock, disaster damage and town behavior. Wind alert bits are tracked for the weather arithmetic, but destructive disaster handlers are not implemented. Cash remains unchanged. These are known gameplay gaps, not completed systems.

## Equipment data, routing and attachments

Implemented `src/formats/equipment.ts` and `src/simulation/equipment.ts`. These are simulation primitives, not a completed machine scheduler. The scenario decoder and detached simulation snapshots now include equipment and saved type definitions.

Loader `0x455bf`–`0x45600` reads count at SSM `0x29f1`, then 127 records of 56 bytes at `0x29f3` into `3d9f:a6ba`. Slot zero is reserved. The supplied farms have 49, 0, 42, 7, 28, 32, 54 and 0 active machines. Loader `0x45864`–`0x45888` reads twelve 18-byte type definitions at SSM `0x20994` into `6190:6db8`. Nine have populated graphics/type/dimensions; remaining bytes and unused definitions are retained.

| Record offset | Recovered meaning / evidence |
| --- | --- |
| +0 word | Equipment type |
| +2 word | Flags: 1 reserved, 2 moving, 4 stored, 8 field assignment, 0x20 active, 0x40 rental, 0x80 drawn on map |
| +4 byte | Movement substate |
| +5/+6 bytes | Current X/Y |
| +7/+8 bytes | Destination X/Y |
| +9..+14 | Three previous X/Y positions |
| +15 byte | Direction: north 0, east 2, south 4, west 6 |
| +17 byte | Condition/wear; allocator excludes high bits 0xc0 |
| +30 word | Last movement tick |
| +44/+46 words | Parent / attached equipment index |
| +48/+49 bytes | Field slot / field traversal direction |
| +50/+51 bytes | Stored home X/Y |
| +53/+54 bytes | Current footprint dimensions |
| +55 byte | Movement-update counter |

Type definitions expose graphic word +0, type +2, owned count +4, price +6, width/height bytes +8/+9. Type names have not been guessed from graphics. Planting uses a tractor (type 0) with type 1 and then type 2 in separate phases; harvest uses types 4, 5 and 7.

Ported operations:

- `findAvailableEquipment`: selection portion of `0x115d6`–`0x11693`. Excludes inactive, condition >=192, rented, wrong-type, reserved, field-assigned and towing machines. Uses squared distance from `0xfb54`, keeps the first slot on ties, and permits stored equipment. It deliberately only selects: reservation, storage withdrawal and optional rental remain distinct unported operations.
- `setEquipmentDestination`: `0xf9e4`–`0xfa65`, clamps destination to 0..95, resets three history entries and counter, writes the 16-bit tick, marks moving and substate one.
- `equipmentTargetDirection`, `scoreEquipmentStep`, `planEquipmentStep`: `0xfba2`–`0xffe6`. Greedy cardinal candidates, Y-axis tie preference, perpendicular cost +5, grass cost 85, history cost 200, blocked cost 20000. The original discards the computed distance except for its near-destination bypass; it does not use that distance to rank remaining candidates. The planner returns the position/direction effect rather than applying a partial full-movement update. Map-edge reads are guarded; original fallback behavior is retained (SF-009).
- `attachEquipment`, `positionEquipmentAttachments`: `0x10f74`–`0x1129e`. Link both members, expand head footprint using original dimensions/shifts, copy direction/field/traversal state, and reposition attachments with original cardinal geometry. Movement uses each parent's definition height, whereas initial attachment uses its pre-expansion current height. Uint8 writes preserve coordinate arithmetic. Callers must erase/redraw world occupancy separately.

Tile constants used by routing were read through initialized ES segment references: `c750:085e` -> file `0x4f4be` = 15; `c752:099e` -> `0x4f5fe` = 16; `c750:0866/0868` = 150/161; `c752:09a3` = 11; `c750:08fe` = 188; `c752:09ee` = 4. Original direction vectors are at `6190:2274` (file `0x86964`).

Further dispatch evidence narrows the next work. State 2 (Plowing) is a no-op in `0x17d3c`; it is not a separate worker dispatcher. The plow UI call `24e6:114a` resolves to overlay 3 `0x2fb14`, which writes the calendar plan. Main-loop `24e6:0fb0` resolves to `0x3709e`, a disaster dispatcher. Planting state 3 actually performs both equipment phases. Its movement driver is `0x14a12`; full movement `0xffe8` still needs erase/draw (`0x104c2`, `0x102aa`), collision/visibility (`0x106d8`), wear (`0x11972`) and arrival handlers. Storage withdrawal uses `0x1aeb0` to clear building contents, not just the equipment stored flag. Next port these dependencies, field traversal `0x108ce`, seed consumption/purchase `0x152d6`, then connect work orders and harvesting `0x156be` to inventory/sales.

## Equipment world updates and building withdrawal

The movement, map-occupancy, wear, field-pass and owned-equipment withdrawal dependencies listed above are now implemented. `src/simulation/equipment-world.ts` composes the earlier route/attachment primitives; `building-storage.ts` implements the owned allocator's storage side effects. The browser scheduler still does not execute work orders. Full arrival/parking/store-back logic, automatic rentals and the field FSM remain outstanding.

### Movement and map occupancy

`equipmentFootprint` ports `0x10d9c`: use the equipment definition's width/height, swapping them only for east/west (directions 2/6). Do not use the enlarged current footprint here; the chain is drawn member by member. Draw `0x102aa`/`0x10300` uses `tileBase[definition.graphic] + width*height*(frames*(direction>>1) + signedFrameByte42)`, then column-major parts. Resolved bases for types 0..8 are 848, 852, 856, 868, 860, 876, 892, 896 and 1028. Definition byte +10 is the frame count. Terrain bit 0x0800 enables the image in the overlay word. Erasure `0x104c2`/`0x1050c` clears that bit and the overlay's low eleven bits, retaining the rest. DOS immediate viewport blits are replaced by the existing native world renderer.

`equipmentObstructed` ports `0x106d8`/`0x1070a`. It checks every member's footprint. Any existing overlay blocks drawing; otherwise grass 15..30, roads 150..171, tiles 172..173, or overlay flag 0x1000 (field) allow drawing. The check does not veto a coordinate move: an obstructed machine is hidden until it reaches a drawable location. This category check differs from route scoring's inclusive endpoints. Off-map footprints are blocked in the native implementation (SF-009).

An occupied tile also queries live animal records (`0x12860`) and, unless flag 8 is already set, invokes collision aftermath `0x133c0`–`0x13599`. Original overlay ranges 962..977, 978..993 and 994..1009 become aftermath graphics 1039, 1040 and 1041; other ranges use 1038. The animal gets flag 8, loses flag 2 and receives animation tick `6190:13a0` at +30. The port records an animal-hit event in place of original sound calls; effects playback and the rest of livestock behavior remain unimplemented. Saved animal records are 256×32 at SSM +3, preceded by a word count at +1; runtime `3d9f:6400`. Counts are 4, 0, 0, 10, 0, 57, 18 and 9. All unnamed bytes are preserved.

`moveEquipment` ports `0xffe8`–`0x102a9`: erase, choose route, shift history, move, apply grass-travel wear, position attachments, update occupancy, test arrival, then apply the 64-update forced-arrival fallback. All-blocked route selection changes the position before history shifting in the original; the port retains that ordering. Caller `0x14a12` still owns timer gating, clearing the moving flag and arrival dispatch.

Wear `0x11972` is `min(255, condition + (savedWord18>>2) + amountByte)`. Every eleventh grass step across all machines triggers amount 2, exempting head type 6 but still wearing its immediate attachment. Forced arrival applies amount 10 to the head, except type 6. `EquipmentRuntime` stores the shared grass counter and pending original-message/sound events; this runtime is not yet connected to `GameSimulation`'s clock.

`traverseEquipmentField` ports `0x108ce`–`0x10b22`. Paint only field-flagged cells outside badge tiles 539..665, preserving terrain flags; a negative requested tile disables painting. The serpentine pass includes X=right and X=left-1 border positions, reverses direction using attachment geometry, and stops at `fieldBottom - (signedCurrentWidth>>1)`. A width-one machine takes 72 updates for an 8×8 field. On completion it redraws at its current position instead of committing the next coordinate. Border arithmetic still wraps bytes, but native out-of-map reads/writes are guarded.

### Buildings and storage

Building count is at SSM `0x5fc5`, with 127×70 records from `0x5fc7`; runtime `3d9f:8400` (`0x45645`–`0x45686`). Nine saved definitions at SSM `0x20a6c` / runtime `6190:6e90` describe types 64..72 (`0x4588a`–`0x458b3`). The unified lookup base `6190:6a10` is indexed by the absolute building type, not a zero-based building-definition index.

Records expose type word +0, flags +2 (0x20 active, 1 open interior), X/Y bytes +4/+5, twelve graphic words at +10, twelve signed content-type words at +34, and twelve slot bytes at +58. The storage index is `(x-buildingX)*3 + y-buildingY`, even for smaller buildings. Definition dimensions span 1×1 through 4×3. Unknown members remain byte-preserved.

`findBuilding` ports rectangle-overlap lookup `0x1a17e`. `toggleBuildingInterior` ports `0x1a2f8`–`0x1a591`: skip types 70/71; toggle flag 1; open to tile 217 plus saved contents; close to row-major roof tiles. Empty markers -1/-2 are skipped. Type 72 uses the original quantity/damage graphics branches. Roof writes replace the complete terrain word, while masked interior contents preserve overlay flags. Initialized roof bases are 440, 441, 445, 451, 460, 469, 120, 1010 and 481.

`withdrawStoredEquipment` ports the equipment branch of `0x1aeb0`. Determine the stored machine footprint, clear graphic/type/index cells to 217/-1/0, then toggle the building twice to refresh it without changing its open/closed state. `reserveOwnedEquipment` composes that with nearest-eligible selection and flags from `0x115d6`–`0x116fa`. The port validates the building cross-reference and footprint before changing state (SF-011). Inventory-item removal uses a different dimensions dispatcher and is still outstanding.

Tests verify exact world-word restoration for original saved trucks, every stored machine in all eight farms, malformed storage references, route arrival, shared wear, animal collision aftermath, field-pass completion and actual saved machinery leaving sheds and rendezvousing before a field pass. These do not establish a complete work-order or farming cycle.

Next dependency chain: arrival handlers `0x14c72`, `0x14d04`, `0x14dc0`, `0x14e1e`, `0x14e60`; parking/storage `0x14e96` and placement `17d4:0656` (`0x1a596`); equipment release `0xfa66` and detachment `0x112a0`; field-entry helper `0x19c62`; planting FSM `0x17d3c` and seed prerequisite `0x152d6`; then harvest FSM `0x156be`, inventory and sales. Preserve the complete-game objective while connecting these already ported operations.

## Machinery arrival and planting dispatch

`equipment-dispatch.ts` now ports `0x14a12`. Types 0/4/6/7 use unsigned tick differences and the saved speed threshold, move, and dispatch arrival in priority order 0x0400, 0x0100, 0x0200, 0x1000, ordinary move. Types 1/2/3/5 request a tractor in substate one, wait for its arrival in substate two, attach and deliver the implement, then return the tractor. Type 8 belongs to a separate plane path. The allocator remains injectable; the default implements owned equipment only. Failure to allocate a tractor exits the whole equipment dispatcher, matching the original.

Arrival flag 0x0400 returns/releases only the implement and retains the tractor for the next field pass. Flag 0x0100 additionally orders the tractor home with 0x0200; its final arrival releases it. Flag 0x1000 clears a waypoint without releasing a field-assigned machine. An ordinary move updates the machine's saved home. Release `0xfa66` clears reservation/field-work flags and field assignment, restores definition dimensions and removes rented machines from the active set; rented-plane cleanup remains unimplemented and is rejected before mutation. Native detachment fixes SF-010 by clearing every member's links.

Parking `0x14e96` tries storage at the current location, then current visibility, then the original asymmetric expanding rings, trying directions 0 and 2 in original order. Native candidate bounds and termination are explicit guards (SF-012). Building placement `0x1a596` accepts equipment into types 66..69; first-fit `0x1abae` tries normal then rotated dimensions at each column-major storage cell. Only type -1 is free. It assigns the new position/orientation, sets stored, fills original sprite parts and refreshes the building twice. The parking caller repeats that refresh in the DOS code and the port.

`field-planting.ts` implements Planting state 3 from `0x17d74`–`0x1843b`, with shared steps 0/1 at `0x18ae8`/`0x185c8`. It requires a previously validated planting order; it does not bypass the still-unported seed/contract handler. Steps 0–6 allocate a tractor and type-1 implement, rendezvous, travel to the field, paint tile 12 through the original traversal and return the implement. Steps 7–11 retain the same tractor, acquire type 2, revisit the field, paint tile `688 + cropSlot*8`, return both machines and enter Growing. Completion resets age/accumulators, initializes field word +36 from **crop definition word +30** (runtime base `2d9f:c5ac`, read `:c5ca`), sets the next weekly marker, and refreshes badges. The original slot-zero timestamp write is preserved and logged as SF-013.

Field entry `0x19c62` scans the fixed eight-cell perimeter for roads 150..171, top/bottom at each X before left/right at each Y, with clamped probes; fallback is the field origin. Building entry `0x1b476` uses definition dimensions plus one on the far sides and falls back one cell west. Work timer failure returns from the field dispatcher rather than merely skipping that field.

Integration tests execute all twelve planting steps and equipment return on the four supplied farms with types 0/1/2 (SCEN3–6), preserving the same tractor across passes and restoring shed contents. SCEN0/2 lack these implements and SCEN1/7 lack equipment altogether: their missing rental path must not be hidden by fake owned machines. All saved stored machines across all eight farms also pass store/withdraw round trips. These tests start at the validated-order boundary; the browser still cannot issue planting orders. Next recover seed consumption/purchase, rental/economy policy, then connect the central simulation clock and React commands before harvest/inventory/sale.

## Automatic ground-equipment rentals

`equipment-rental.ts` now completes the ground-machine allocator branch `0x116fc`–`0x117b6`. Prefer owned equipment. Otherwise, if auto-rent is enabled, construct a machine in the first inactive slot, debit `definition.price >> 1` under accounting category 1500, and set home/current position to `(townRegionX*8+1, townRegionY*8+5)`. Set rented/reserved flags. Insufficient cash removes the newly created machine from the active set; a full equipment table charges nothing. The original debit returns the amount, so even a successful zero-value debit is interpreted as failure. Ground constructor `0xf8be` initializes only its explicit members; unassigned bytes in reused slots remain intact. The separate plane path is not implemented.

Saved auto-rent is byte `0x21731` -> `6190:a89d` (`0x462fe`). Town region words are `0x2170b` -> `6190:7592` and `0x2170d` -> `2d9f:d530` (`0x4608e`, `0x460a6`). Rental expenses are a dword at `0x216c4` -> `6190:3ea8` (`0x45e36`). Rental payment uses the unsigned affordability/debit in `0x1c88e` and ledger branch `0x1c9e6`; no invented recurring rental cost is added. Year-end ledger processing remains outstanding. SF-015 records 32-bit expense wrap; SF-014 records a separate duplicate destination encountered while tracing the accounting loader.

Corrected the native labels for the two saved timer words: SSM `0x216f7` is `6190:13a0` (animation), while `0x216f9` is `6190:139e` (equipment/calendar timer). Earlier decoding had those property names swapped; the browser's current day scheduler did not consume either property. Tests now verify their individual mappings.

Additional integration tests execute planting on SCEN0/1/2/7 using real automatic rentals. SCEN0/2 spend 200 for two implements; SCEN1/7 spend 400 including the tractor. All rentals leave the active set after the final return, and owned machine counts recover. Together with SCEN3–6 coverage, all eight supplied farms complete the machinery/planting sequence from the validated-seed-order boundary. Seed consumption/purchase and player commands remain next, followed by clock integration and harvest/inventory/sale.

## Seed inventory, immediate planting orders and browser clock

Inventory is 512×12 bytes at SSM `0x8283`, preceded by a word count at `0x8281`; loader `0x45688`–`0x456d2` targets `2d9f:d5be`. Type is word +0, position bytes +8/+9 and active flag is byte +10 bit 0x20. All unnamed bytes remain intact. SCEN6's count discrepancy is SF-017; native searches iterate bounded records. Seed definitions are sixteen 18-byte goods records at `0x20e38` -> `6190:725c`; crop trade definitions are twenty-four at `0x20b0e` -> `6190:6f32`. Count/price are words +4/+6 and dimensions bytes +8/+9. Only the first sixteen crop entries are used by the crop slots; most crop trade dimensions are zero in the saved data, whereas seed dimensions are 1×1.

`consumeSeed` ports `0x152d6`: consume the first active item with type `192+cropSlot`. If inside a building, clear its footprint and refresh the building twice using `0x1aeb0`. Otherwise restore the complete terrain word using `15 + soilMoisture + (attribute>>2)` (`0x95ca`). Then decrement the seed definition count and clear the item's active flag (`0x3a1b2` -> `0x152b0`). SF-016 documents the native prevalidation of inconsistent counts/cross-references. Automatic buying uses flag `6190:a89c`, loaded twice; the final saved byte at `0x2173b` (`0x463ee`) wins over the earlier `0x21715` value. Charge `(seedPrice+20)&65535` through category 192; seed expense total is SSM `0x216a4` -> `6190:3e78`.

The crop loader overwrites saved prices after reading CRP files (`0x466d0`–`0x46728`): crop trade price and current market price initialize from CRP definition word +34; seed price is `max(5, definitionWord38>>2)`. GameSimulation now applies this initialization, instead of treating saved seed prices as permanently authoritative. The sixteen current market prices are separate simulation state; their historical records and periodic market fluctuations remain unimplemented.

`plantField` ports the existing-field planting branch of calendar dispatch (`0x2f7de`–`0x2fa54`) as an immediate native command. Reset field age/accumulators, release any crop contract, enter Planting, reduce the selected current market price by one quarter (`0x4b066`), lower existing pests (one quarter for the same crop; all for rotation), change the crop badge and initialize three pest pressure bytes from the simulation RNG and crop resistance. Seed acquisition is checked before field mutation in the port (SF-018). The native UI currently rejects work already in progress because original cancellation/return and the calendar-plan editor are not yet ported. It supports existing fields, not new-field placement.

GameSimulation owns the new inventory, goods definitions, market values and planting result. React only submits `plant-field` and renders detached snapshots. Time advancement now runs equipment/planting substeps; a saved day delay of 256 gives 256 logical ticks per browser-paced day. Equipment respects saved speed and pacing flag `6190:a8a0` (SSM `0x21718`). Manual Next day advances to the next day boundary; Play runs one day per second. Both timer words wrap to sixteen bits. This is a deterministic native scheduler adapter, not a claim to reproduce DOS interrupt frequency, multiple passes per original frame or complete frame RNG consumption. Weather/growth still run at the previously recovered day/week boundaries. Harvest, additional work states, livestock, disasters and sound-effect playback remain separate gaps.

Tests now start at real planting commands, buy seed, allocate owned/rented machinery, complete both passes and reach crop growth on all eight farms. Seed tests consume all 36 saved SCEN6 items before purchasing, check exact storage cleanup and affordability, and reject inconsistent native inventory. Frame-partition tests compare one elapsed interval with 300 animation-frame-sized intervals. A new Chromium check exercises UI planting, cash/seed/rental charges and exact crop pixels; it now passes after local server connectivity was restored (six Chromium checks total; see progress).

## Harvest maturity, loss and valuation

Executable fingerprint remains `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Static disassembly of `0x1c092`–`0x1c2a6` and `0x1c4aa`–`0x1c509` establishes the shared valuation used by both machinery and worker harvesting. These are pure simulation functions in `harvest-value.ts`; harvest commands, storage delivery and income posting are not yet connected.

- `0x1c1aa` computes maturity. Field +34 is a signed age byte. If crop word +30 is nonzero, divide field word +38 by `(cropWord30+2)&65535`, keep the low byte and sign-extend it as the heat delay. Compute `((age-delay)&65535)*65536 / cropByte56` using unsigned long division, truncate, cap to 65535 and suppress values below 8192. State zero returns zero. Runtime helper `0084:354e` is unsigned division (`0x5f8e`); native code validates nonzero divisors rather than faulting. SF-019 records the signed/unsigned boundary.
- `0x1c24e` computes loss as `min(65535, 65535-maturity+fieldWord18)`. The previously named stress accumulator therefore reduces crop value, along with immaturity.
- `0x1c092` chooses nonzero field word +48 (contract price), otherwise the crop trade definition price; divides that unsigned price by 10; passes crop word +32 as quantity and the above loss to `0x1c4aa`. State zero returns zero.
- `0x1c4aa` first truncates `quantity*unitPrice` to its low word (`MUL`, then `XOR DX,DX` at `0x1c4c3`). It multiplies that by `65535-loss` via the runtime long-multiply helper (`0x5ed2`), then returns the high word, equivalent to division by 65536. Loss greater than 51000 forces zero. The unsigned `CMP DX,0xffff` / `JBE` at `0x1c4d9` always takes the branch, so the apparent subsequent clamp does not restore the lost product bits. SF-020 records the overflow quirk. Crop slot and the fourth word passed to this function are unused.

Evidence checks cover fixed-point thresholds, stress saturation, signed-byte wraps, invalid divisors, contract overrides, exact original mature-corn value (4334 at price 150), all 24 crop definitions and unchanged records on all eight farms. No original runtime execution or emulator was used. Harvest FSM `0x156be` has machinery steps 0–7 and a worker branch 10–16; it uses this valuation at the end of field work, then either settles a contract, sends a truck to storage or sells when storage is unavailable. Those paths remain the next reconstruction work.

## Harvest inventory and reserved storage

The loader loop `0x4590b`–`0x45934` reads sixteen 18-byte harvested-goods definitions at SSM `0x20d18` into `6190:713c`, between five supplies definitions and sixteen seed definitions. Types are 168–183, graphics 109–124, dimensions 1×1. The tile-base table at file `0x4f4be`, indexed by graphics 109–124, contains 816–831; tests compare these constants directly to the EXE. Saved prices are preserved; periodic changes and sale valuation remain separate reconstruction work.

Inventory constructor `0x15234` scans slots 1–511 for the first inactive item. It writes type +0, quantity +2, loss +4, zero word +6, coordinates +8/+9 and active byte +10=32. Byte +11 is untouched. The constructor does not update the goods definition count; harvest delivery does that at `0x16010`. Native total active count remains derived from bounded records (SF-017).

Storage reservation `0x1aff0` considers active building types 64/65, chooses the nearest using squared distance `0xfb54` with the first slot winning ties, and marks the first free cell's type as -2. The scan is column-major with fixed three-row stride. Reserved graphic/slot bytes are left intact. Completion `0x1b278` fills the first -2 cell, writes the inventory slot/type/tile, positions the item at that storage cell and toggles the building twice to refresh its current roof/interior state. It does not use the reservation coordinates to select the cell; native delivery retains that order. `deliverStoredHarvest` composes creation, definition count and completion as used by the truck arrival branch `0x15f9a`–`0x1602f`, with checks before mutation.

SF-021 records the original 512-slot/byte-reference mismatch. Native stored delivery returns failure when its first free inventory index exceeds 255. SF-022 records the original reservation leak on constructor failure; a native cleanup primitive releases a still-reserved cell, to be called by the forthcoming harvest failure path. Tests cover all original storage capacity, nearest/tie ordering, reservations, original graphics, unknown-byte preservation, full inventory and high-slot rejection, plus detached GameSimulation snapshots. Trucks and sale fallback are not yet wired to these primitives.

### Next harvest integration entry points

Calendar harvest-order branch `0x2f776` only accepts Growing state 4, sets state 5/step 0 and field +7 bit 1, then selects step 10 when **crop byte +57 equals 1**. Do not infer worker selection from crop flags +62. The machinery path allocates types 4, 5, 7; field words +42/+46/+44 respectively hold harvester, pending header and truck. Step 5 traverses with tile 36, or no terrain replacement if crop +62 bit 0 is set. Completion gives perennial crops age from crop byte +18; annual crops enter state/age zero. Equipment rotation helper `0x10b24` sets direction then repositions attachments; its far address is `0d5f:1334`.

Credit routine `0x1ca28` adds income to cash as uint32, then caps at 9,999,999. Categories 168–183 add the full amount to `6190:3e60` at `0x1cb38`; this saved ledger maps to SSM `0x21690` via loader `0x45cee`. Harvest also increments runtime `6190:3e44`; its initialization/reset and saved representation still need tracing. Contract comparison adjusts `3e6c` (SSM `0x2169c`) or `3e84` (SSM `0x216b0`) before crediting the contracted value. These addresses are research leads, not yet implemented finances. SF-023 tracks the stale local equipment write in machinery step 7.

## Running machinery and worker harvest sequences

`field-harvest.ts` now ports `0x156be`–`0x16abc`, including machinery steps 0–7 and worker steps 10–16. It is tested independently; GameSimulation/browser integration is the next increment. Machinery allocates types 4/5/7, attaches the header, waits for both machines at the field entry, traverses the field, reserves storage or settles income, and returns the machinery. Worker harvesting debits field word +58 under category 500 (`0x16209`), obtains a truck, draws temporary worker overlays 1036/1037 using **visual RNG `05fd:007d` / `0x824d`**, waits on the original day comparison, clears overlays and dispatches delivery. Sound/worker animation globals `2d9f:f7cc/f7ce/f7d0` are not yet animated; the original initial worker images are drawn.

Common storage completion creates the full crop quantity with its loss factor. No-storage machinery harvest credits at completion of field work, then sends the truck to town; worker harvest credits when the truck arrives. Contracts compare contracted and current values and bypass storage. Annuals return to Waiting with age zero; perennials return to Growing at crop byte +18. Reset field words +18/+38/+40 and weekly marker +33 as the original does. Harvest waits return only from that field routine; unlike planting's explicit dispatcher timer exit, they must not prevent other fields running.

Recovered cash credit caps at 9,999,999 after uint32 addition, while ledgers keep full uint32 additions. Added saved crop income (`0x21690` -> `6190:3e60`), contract gains (`0x2169c` -> `3e6c`), contract losses (`0x216b0` -> `3e84`) and the previously unlocated sales accumulator (`0x21722` -> `3e44`, loader `0x46216`–`0x4622b`). Worker expenses use `3e88`: the loader's SF-014 duplicate destination fails to restore it, so a fresh native scenario starts from the EXE's initialized zero at file `0x88578`. This preserves the loader defect; full ledger save/load correction remains deferred.

Fixed SF-022 by releasing the first remaining reserved cell on a failed delivery, matching the original success path's ordering even when trucks arrive out of order. Fixed SF-023 by omitting the stale redundant header write on truck return. SF-024/SF-025 retain the original week-wrap worker duration and broad overlay cleanup, with regressions. The truck's equipment word +44 is overloaded as the storage-building index during delivery, not an equipment parent; future native save/load validation must account for this type/state-dependent meaning.

Validation exercises both harvest methods across all eight original farms, annual/perennial completion, exact quantity/loss inventory, automatic rental charges, worker fees, contract gains/losses, cash caps, ledger wraps, full inventory, concurrent reservations, visual RNG use and unrelated-equipment isolation. The mature healthy field setup is a fixture, not a claim that crop health management is complete.

## Native harvest command and scheduling

GameSimulation now accepts `harvest-field`, passes it through the recovered `0x2f776` command, and runs `updateHarvestField` in field-slot order alongside planting. A harvest wait does not exit the whole dispatcher. The existing deterministic native clock adapter runs equipment first, then field work, then the day boundary. Detached snapshots include the recovered maturity/value and worker fee for React to display; they do not transfer ownership of simulation rules to the UI.

Integration checks now start with unmodified original scenario fields on all eight farms, complete harvest with concurrent weather/growth, return equipment and accept another planting command. These scenarios can produce worthless immature harvests; this does not establish a profitable full farming cycle. Frame-partition coverage includes workers, storage and no-storage sales. Stored goods cannot yet be sold by a player command, and the browser harvest control follows in a separate increment.
