# Binary evidence

All executable addresses below are **file offsets**, not runtime addresses. Run `npm run analyze -- --start 0x4543c --size 0x1000` to reproduce the scenario-loader disassembly. The analyzer pins the exact executable SHA-256; the importer records every input and archive member in generated `public/assets/manifest.json`.

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

Each cell is two little-endian uint16 values plus one byte. The loader stores these at `2d9f:0424`, `2d9f:4c24` and `2d9f:9fe4`, using `row * 96 + column`. The terrain reader at `0x9536`–`0x9556` masks AH with 7, recovering an 11-bit tile index. Every such index across all eight scenarios is below 880. High bits, second-word semantics, and the byte's meaning are not fully identified; preserve them. The browser's initial map should render the terrain layer only until compositing rules are recovered.

## Development references

[Vite's official guide](https://vite.dev/guide/) supplies the project/build conventions. [ScummVM's XMIDI parser](https://github.com/scummvm/scummvm/blob/master/audio/midiparser_xmidi.cpp) is a format cross-check for additive delay bytes, note durations, and a fixed 120 Hz clock; no ScummVM code is copied into this project.
