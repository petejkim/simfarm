# Binary evidence

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
- Plant handler around `0x23fc7` sets state 3, substep 0 and crop slot +14 after seed/equipment/contract checks. Its marker update calls `15b3:1988` (file `0x196b8`). Reconstruct prerequisites before exposing planting.
- Field update loop `0x17d3c`–`0x18ccb` dispatches work state and substep. Equipment work FSM `0x156be`–`0x16abc` selects machines through `0d5f:1de6` (file `0x115d6`) and maintains field offsets +42/+44/+46. Machinery records have 56-byte stride at scenario `0x29f3` / runtime `3d9f:a6ba`.
- Growth code around `0x1930f`–`0x195be` increments field age and computes graphic stages from crop definitions. Environmental mutation helper `0x19846`–`0x19c61` dispatches eighteen modes; exact units, ordering, random source and clock integration remain to be recovered.
- Field status/marker routines `0x19002` and `0x196b8`–`0x19845` update badge tiles. Initial saved badges are rendered, but their dynamic updates are not implemented.

These are static-code leads, not implemented simulation claims. Recover the scheduler, equipment prerequisites, growth arithmetic, cash/calendar state and random generator before claiming an original farming loop.
