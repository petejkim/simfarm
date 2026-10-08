# Original new-farm setup

This increment recovers setup resources and climate selection, not a complete new-farm generator. `src/formats/new-farm.ts` decodes them; `./tools/bun run import` produces ignored `public/assets/new-farm-setup.json` alongside the original raw members. Existing SSM loading and canonical simulation initialization are unchanged. World generation, ownership, starting records, crop selection and the setup UI still need reconstruction before a new farm can be offered as original behavior.

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

Next reconstruct world generation `0x3fe1a`, its DS67b4 option bits, and the reset/finalization chain into `0x41084`. Existing evidence suggests separate water features but their full rules, RNG sequence and setup labels remain unverified. Trace initial land, records, money, crop loading and weather-call order before connecting React setup controls to canonical game creation. The native fresh-SSM weather initialization remains unchanged; custom-world regeneration must not be treated as a save loader.

Tests cover executable instructions/strings, independent map annotations, retained suffix/bounds, all twelve files and all 64 combinations, malformed climate input, signed truncation, six saved-farm climate/forecast/RNG cross-checks and the two unmatched rainfall tables. Browser regression checks cover existing asset/scenario loading; no new setup UI is claimed.
