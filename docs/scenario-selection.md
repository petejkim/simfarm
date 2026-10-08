# Original region selection and INT screens

The traced chooser selects geography and optionally loads a supplied farm. It does not establish separate mission objectives. Eight marked cells match `SCEN0.SSM` through `SCEN7.SSM`; other selectable cells proceed to world creation. The native geographic selection flow now follows those branches. It is not a proof that every scenario-dependent branch elsewhere in the executable has been audited.

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

All eight marker cells and the initial cell are selectable in the original ODT. Caller tracing now establishes that marker climate overrides the climate saved in a supplied SSM after the chooser returns. The earlier claim that SSM climate remained authoritative omitted this caller; SCEN6/7 provide concrete unequal rainfall tables. See [original-load-startup.md](original-load-startup.md). No city names, objectives, deadlines, win/loss requirements or additional climate rules are inferred from map position. The eight native dropdown options remain supplied farm files, with their original mutable state.

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

## Live native region selection

**New farm → Use region map** now displays the full original chooser panel. React buttons cover its18×18 map and four original actions; imperative pixel composition stays in `src/render/region-chooser.ts`. Original INT/palette files load directly from reproducibly imported raw assets. `readRegionArtwork` reuses the verified INT decoder and keeps palette indices for selection inversion. The native crop is `(80,16,472,328)`, including the complete frame; this crop/scaling is a browser presentation choice, not a new source screen resolution.

The eight yellow outlined cells open supplied farms; other selectable cells create a new landscape. Accessible labels and the status text retain scenario numbers, but invented on-map number labels/fills are removed. Source ODT still supplies178 selectable cells, and the initialized cell is2/8. Arrow keys skip unavailable cells along their axis; Home/End select the first/last selectable location. Roving focus, hover highlights and scalable hit areas are browser accessibility additions. Native selection uses the full ODT mask rather than reproducing the strict original mouse-edge inequalities.

Both geographic outcomes use the preliminary-generation/finalization compositions documented in [terrain-preview.md](terrain-preview.md). Numbered selection preserves loaded date/default-crop/history branch distinctions; unmarked selection performs its second generation with retained soil/water. Restart is the default; fresh setup is explicit. Selection alone changes React state without advancing RNG. Asset failures and cancellation leave the old farm intact. Checkpoints never replay chooser startup.

### Recovered graphics helpers

| Source | Recovered rendering |
| --- | --- |
|31dc5..31e01 →0863:0532/filead62 | Eight rectangles in palette color1, at `(248+16*x,40+16*y)` through `(264+16*x,56+16*y)` |
|31e03..31e29;32077..320f2 →0863:04a0/fileacd0 | Selection rectangle XORs all four palette-index bits; repainting the previous rectangle removes it |
|ad1b/ad30 →0416:059f/file68ff | Horizontal XOR uses left/right edge masks; right endpoint excluded |
|ad45/ad5a →0416:0411/file6771 | Vertical XOR includes both endpoints (`67ef..67f3`) |
|3fb85..3fbc5;3fcb1..3fcf8 | Both video-mode initializers build left masksff,7f,… and right masks00,80,c0,…; this establishes the horizontal right-edge exclusion |
|31f53..31f98 →0636:1bb4/filea114 | Bars atx120,y101/149/197, width96, height10; value32*level, background palette12 and fill palette6 |
|a180/a1a1 →0416:137f/file76df | Solid fill truncates both horizontal edges to8-pixel byte boundaries; all geographic widths are already aligned |

Draw markers first, then XOR selection, then climate bars over the original indexed image. Reconstruct from the immutable base on each selection; do not invert already scaled RGB or accumulate browser drawing artifacts. XORing horizontal and vertical lines twice at the left corners leaves those corner pixels unchanged. The right corners invert once because horizontal lines exclude their right endpoint. This visible source endpoint convention is preserved, not classified as a proven game defect.

The same solid-fill trace corrected the custom screen's native visual bar widths: `27*level` clamped to80 becomes0/24/48/80 visible pixels after byte alignment. Previously the browser used0/27/54/80. This is a native drawing correction, with no simulation/settings/save change; see [terrain-preview.md](terrain-preview.md).

### Original actions and browser boundaries

| Action | Source hit rectangle/branch | Live browser behavior |
| --- | --- | --- |
|Use this region | strict96<X<237,232<Y<256;3222c..32392 | Submit validated options through numbered/unmarked canonical setup |
|Design your own | strict96<X<237,256<Y<280;3216e..32228 | Open the canonical custom preview directly, keeping selected climate; final acceptance remains Play |
|Load a saved game | strict96<X<237,280<Y<305;32396..32472 | Close setup and open the existing browser Load farm picker; native checkpoints restore exactly and SSM files use the established in-game import |
|Quit | strict96<X<237,304<Y<328;32474..3252a | Close setup and pause the current farm; do not discard it or attempt to terminate the browser |

DOM action areas follow the artwork including edge pixels. Source pressed-state/bevel animations and held-mouse timing are not yet reconstructed. The Load action is explicitly a browser bridge, **not** the source result1 startup path. Source3245a/3245f generates another map and selects sites before returning1 at32464, then proceeds through additional setup and later file selection. That caller sequence still needs complete audit/composition; it must not be applied to native checkpoints or conflated with in-game SSM transfer. Quit's pause/retain behavior is an explicit browser adaptation. The initial native session/seed/year form, original startup/title lifecycle and remaining menus/dialogs/reports are still unfinished.

### Verification

Three new unit cases pin source opcodes/hash, marker and XOR primitives, fill arguments and action branches; independently decode original pixel bits and compare every output pixel for all178 selectable regions; and exercise malformed/truncated artwork, palette, coordinates and levels plus offset buffers and source immutability. Three new Chromium flows compare live canvas pixels, test keyboard/direct custom entry, phone sizing, native checkpoint picker restoration, malformed files, Quit/pending cancellation and raw asset failures. Existing all-eight region tests now activate the original Use This Region button and compare canonical saved continuation. Desktop/mobile screenshots are inspected under ignored artifacts. Full gate results are recorded in progress.md.


## HTML text presentation (2026-10-08)

The live geographic chooser follows the user's text policy: SELECT A REGION, climate labels, Low/High and all four action captions are HTML/React text. Opaque source-gray surfaces cover the bitmap lettering and CSS supplies button bevels at the recovered rectangles. The original source canvas remains an exact reference beneath those surfaces; whole-canvas pixel tests verify that reference, not the final composited text. Desktop/mobile screenshots verify the composite. Browser checks also verify copyable title text, visible captions, fitting text bounds and existing keyboard, load/cancel and setup behavior. Map pixels, XOR/scenario markers and climate bars are unchanged; browser typography is a deliberate presentation adaptation. Future restored interfaces must also use actual text elements.
