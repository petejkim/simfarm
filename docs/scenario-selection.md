# Original region selection and INT screens

The traced chooser selects geography and optionally loads a supplied farm. It does not establish separate mission objectives. Eight marked cells match `SCEN0.SSM` through `SCEN7.SSM`; other selectable cells proceed to world creation. This narrows the next implementation work to the original geographic selection flow. It is not a proof that every scenario-dependent branch elsewhere in the executable has been audited.

Source executable: size `0x917b9`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. File offsets below refer to that image. Initialized DS6190 data maps from file `0x846f0`. Confidence is high for the decoded arrays, upload loop and traced chooser branches; full warm-load/restart and screen interaction fidelity remain unfinished.

## Chooser flow

`0x31ca0..0x32590` loads `scenario.pal`, `scenario.int` and the four planes in `scenario.odt`. The climate/selectability planes are already documented in [new-farm.md](new-farm.md). Screen coordinates within the map use `(mouseX-248)>>4`, `(mouseY-40)>>4`, with strict bounds `248<X<536`, `40<Y<320` and a positive selectability byte. Indexing is row-major `y*18+x`, unlike the farm world's column-major layout.

Marker painting `0x31dc5..0x31e01` reads X from DS66ae and Y from DS66b6. Each is eight bytes; grid cells are16×16. Initial selected X/Y words are DS66c0/66c2, values2/8. Their file offsets are `0x8ad9e`, `0x8ada6`, `0x8adb0` and `0x8adb2`. `readScenarioChooser` reads these directly, validates grid bounds and returns detached metadata. The importer adds `farms` and `initialLocation` to ignored `new-farm-setup.json` alongside the existing location/climate data.

| Supplied file | X | Y |
| --- | --- | --- |
| SCEN0.SSM | 0 | 8 |
| SCEN1.SSM | 1 | 11 |
| SCEN2.SSM | 1 | 3 |
| SCEN3.SSM | 3 | 6 |
| SCEN4.SSM | 9 | 7 |
| SCEN5.SSM | 11 | 6 |
| SCEN6.SSM | 13 | 11 |
| SCEN7.SSM | 15 | 8 |

The “Use this region” branch compares the current grid coordinates with these arrays in order at `0x32342..0x32360`. On a match, it formats `scen%d.ssm` using the loop index (`0x32362..0x32372`, string DS666d/file8ad5d), calls the loader stub24e6:121c at `0x3237b`, and sets the shared loaded result2 at `0x32302`. If no preset matches, it calls setup helpers and returns result3 at `0x32327..0x3233a`. “Design your own” returns0 at `0x32220`; “Load a saved game” uses result1 at `0x32464`; quit calls the source exit helper. Main consumes the loaded result at `0x2347`, `0x2397` and `0x24d0`, then clears DS66c4 at `0x24e9`. The traced branch retains no numbered mission identifier or objective rules.

All eight marker cells and the initial cell are selectable in the original ODT. Marker climate does not override the climate saved in a supplied SSM: existing research already identifies non-preset rainfall in SCEN6/7. No city names, objectives, deadlines, win/loss requirements or climate normalization are inferred from map position. The eight native dropdown options remain supplied farm files, with their original mutable state.

## Corrected full-screen image layout

The previous importer incorrectly passed whole `.int` screens to `decodePlanar`, which expects four contiguous whole-image bitplanes. That produced scrambled region/title/presentation PNGs. This was a native decoder mistake, not an original-game defect.

Chooser `0x31d7e..0x31dab` reads3200 bytes and calls resident0416:002c (file `0x638c`) for each ten-row strip. The uploader's `0x63cf..0x63f1` loops ten scanlines: it copies80 bytes into plane1, rewinds the destination80 bytes, shifts the VGA plane mask through2/4/8, then advances the destination one line after all four planes. Source memory advances continuously. Thus a pixel's plane byte is at `y*320 + plane*80 + floor(x/8)`, MSB first; color-plane significance is1/2/4/8.

`readInterleavedScreen` converts that layout into the existing tested planar decoder's input and returns opaque640×480 RGBA. The supplied INT files all contain153600 bytes, including the file named `prsnt350.int`; this name does not authorize assuming a350-row buffer or dropping its suffix. The function rejects other lengths. The importer uses it for the existing scenario, title and480-line presentation outputs; bitmap/tile/crop formats keep their distinct contiguous-plane layout. Palette values still use the original16 VGA DAC colors scaled from0..63 to0..255.

| Archive member | Archive offset | Bytes | SHA-256 |
| --- | --- | --- | --- |
| scenario.int | 1101903 | 153600 | `6d0e8c46a7daa234156297c30d5c7f3c31495cd75b8c7af49def4a4798e0da4c` |
| sftitle.int | 1562703 | 153600 | `afe829e3a4e823295a32af21e2d3ba0f8bd88bd8f1f655db5f6dc1cbcf953cc5` |
| prsnt480.int | 1255503 | 153600 | `88da110ca42f4111a0643618226c65ff70647630063617029e98686b328ff843` |

All three corrected PNGs were visually inspected: the region chooser shows its US map/sliders/buttons, the title shows the cow/farm art, and the presentation screen shows the Maxis logo. Complete RGBA hashes independently computed in Python are pinned in decoder and browser import tests.

## Verification and next work

Five tests cover source instructions/hashes, scanline/plane/bit order, first/last pixels and strip boundaries, typed-array offsets, exact byte lengths, independent image hashes, all marker coordinates/selectability, initial selection, caller/string evidence, malformed coordinates and detached metadata. A browser check fetches the actual imported PNGs/JSON through Vite and compares their full decoded pixels/metadata. Existing new-farm and asset-loading flows protect the unchanged game behavior.

This increment fixes assets and recovers source selection metadata. The React form still exposes climate sliders as dropdowns and the supplied-farm selector remains a dropdown; no interactive geographic chooser or title sequence is claimed yet. Next connect the original region map to climate selection and supplied-farm loading, keeping controls/text in React and preserving custom seed/year options. Exact original window/input/preview and in-process warm restart remain separate fidelity work.
