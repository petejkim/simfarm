# Original terrain preview and regeneration

Source: `SIMFARM.EXE`, size0x917b9, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets; initialized DS6190 begins at846f0. This records recovered setup phases and artwork, not a completed original setup UI or an executed DOS comparison.

## Source sequence

Setup3f854 first clears regional type/ownership, then calls4027e at3f8ab before calling the geographic chooser/finalizer at3f8ae. Wrapper40285..40298 writes201 to DS1521 and DS23db, then calls3fe1a to generate terrain. Those bytes retain address-based names; this work does not infer their broader semantics. Initialized DS67b4 is1 (file8aea4); restart408e6 clears it to0 before setup. Generator3fea2 tests bit1 for a river and4006a tests bit2 for a lake. Thus the source's initialized and restarted preliminary maps have different water settings. Soil comes from retained signed byte DS0164 (initialized file84854=8); this preliminary wrapper does not replace it with a climate selection.

“Design your own” returns0 from the geographic screen. Finalizer40eed calls stub123a, resolving to overlay7 entry0/file330d0. Custom entry loads `defworld.int`, then33146 calls preview33ca6 on the already generated map. It does not call the terrain generator again at entry. Preview draws the map, then33d37 calls33aa6 to select town/player sites and draws the corresponding markers. Reentering that source preview phase can select different sites; a native snapshot/read must not accidentally repeat it.

The original button label is **GENERATE WORLD**. Its hit branch337a6..337ba writes `(DS67b6 << 2)` to soil, calls generator stub1230/file3fe1a, then preview33ca6 and location selection. River337f8 and lake33864 merely XOR bits1/2 of67b4; they do not regenerate. Climate control adjustments likewise stay separate from generation. **PLAY!** sets the loop's exit flag at336f0 and returns through3389e..338ec; it does not run Generate World first. Therefore an accepted map and its selected sites must be carried into property/town/main finalization, not regenerated from current form settings when accepted.

Unmarked geography takes a different path:32327 calls3fe1a,3232c invokes the location helper through1226, and result3 bypasses the custom screen. Numbered presets load an SSM after the preliminary map; those discarded terrain draws still affect later streams. These observations supersede treating every setup selection as exactly one generation. Existing live constructors still use their documented one-selected-generation policy until the full staged chooser is connected.

`beginTerrainPreview` now ports regional reset and preliminary generation with explicit initial/retained RNG history, signed soil and cold/restart water defaults. `locateTerrainPreview` performs the custom preview's site-selection phase separately. `rebuildTerrainPreview` ports Generate World with explicit rain/water settings and advances the retained visual/bounded and terrain-history streams; the simulation stream remains unchanged by these phases. All candidates detach from inputs and fail atomically. They do not reset accounts/records, grant property, initialize dates/crops/markets/weather/traffic or run a game clock. Raw201 writes are retained in the setup-phase result.

## Original artwork and miniature tiles

Custom entry330f3 reads filename DS6742/file8ae32, `defworld.int`. The3200-byte/ten-row upload loop33106..3313e calls the same0416:002c uploader as the geographic screen. It therefore uses the existing640×480 scanline-interleaved INT decoder. It inherits `scenario.pal`; the caller restores `simfarm.pal` only after setup returns at3f8c4. The reproducible importer now emits ignored `defworld.png`.

The preview is not a scaled version of the16×16 map tiles. Loader49450..4945e (also497c2..497d0) reads0x780 bytes of `far_mapc.mbm` into2d9f:cdac. There are960 two-byte miniature tiles. Each byte is one row of two pixels. Bits7/6 encode the two pixels of plane1,5/4 plane2,3/2 plane4 and1/0 plane8. Resident renderer0416:0af1/file6e51..70b9 packs four adjacent tiles into one eight-pixel VGA byte per plane and writes two rows. The native decoder exposes a64×60 atlas of32 columns of2×2 tiles, retaining every original color.

Preview33cb7..33d34 paints the192×192 area at screen(264,72). Source loops pack four adjacent world-X tiles horizontally; the inner loop advances screenY by2. `renderTerrainPreview` preserves the world's column-major order, masks terrain with07ff and copies each exact2×2 tile. It rejects indices>=960 before exposing a raster; it does not read unrelated memory as the original unchecked lookup could. Overlay/attribute bytes do not choose these preview pixels. Town/home marker drawing is a separate source step and remains to be connected with React controls; the current renderer returns the terrain rectangle only.

| Archive member | Offset | Bytes | SHA256 |
| --- | --- | --- | --- |
| defworld.int | 948303 | 153600 | `68942e94ec397ccc644ffe1d1b3d123a54f5ffa73f401be06e75316d295ca57b` |
| far_mapc.mbm | 1718816 | 1920 | `2fad5b9a88d639e943af13b85124898451edb055ec7acf12b0a5c49046ca5043` |
| scenario.pal | 1716447 | 48 | `9524ff84a87e7da93571bf2daddef6c2c9e3569393f3022266a63618295f3b10` |

Independent Python decoding directly from these archive offsets yields full RGBA hashes `6ed5cbf89537cd4b49fc1c53067485901c807157bde2fae5a7ea9f2fac35636a` for the screen and `9e2f3b9e380d28cb557a30ac664f2de56a309c55cc253d5c55eb9efaae5febb8` for the miniature atlas. Both are pinned in unit/browser asset checks. The original artwork/atlas and an ignored composed rerolled-map artifact were visually inspected. These are native asset renders, not original execution screenshots.

## Signed soil and boundaries

Population40ab3/40ab7 reads and sign-extends DS0164. The addition/OR/store at40ae1..40afa is16-bit;3fe64..3fe86 subsequently floors only masked tile numbers below15. The former native0..12 restriction was sufficient for custom rain*4 but not a retained preliminary soil input. Population/generation now accept−128..127 and wrap the stored word exactly. Ordinary0/4/8/12 output is unchanged. Extreme negative values can produce high flags and tile numbers beyond the miniature asset; SF-151 records this arithmetic/lookup hazard without claiming ordinary reachability or an exploitable vulnerability. The renderer bounds the read instead of fabricating missing pixels.

## Staged custom acceptance

`CustomFarmSetup` now owns a detached custom setup draft in plain TypeScript. Fresh entry starts from the explicit seeds, original soil8 and river flag1; restart entry captures a validated native checkpoint and retains its soil/RNG/terrain history with reset water flag0. Both run preliminary generation and the custom entry's site selection once. Settings changes do not draw RNG or mutate the current preview. Generate World uses the same streams and sets rain*4. Play supplies the existing terrain, locations, soil and post-preview RNG/history to the cold/restart finalizers, which skip generation/location selection and perform property/town/date/crop/market/weather/traffic phases once.

The displayed terrain can differ from the eventual farm at the known property fences, homestead, town and retained-weather redraw steps. This is ordinary source finalization, not a second random map. Selected climate is applied even when rainfall/water controls were changed after generation; the displayed map's soil remains the input to startup weather. The setup provenance options are audit data, not instructions sufficient to recreate a rerolled map. Canonical world/RNG/history remain the continuation owners.

The draft copies assets and captures the prior session; it does not retain a mutable reference to the running game. Native cancellation discards it, and invalid finalization leaves it retryable without consuming additional draws. Once accepted/cancelled, the draft rejects further actions. Stable detached snapshots and subscriptions are available for React. These atomic replacement/lifetime policies are native extensions, not claims about original nested DOS dialogs or elapsed interrupts. Partial reset operations that do not affect terrain/RNG are composed at finalization on the captured prior checkpoint; they are not applied to the still-live farm while previewing.

Native v20 persists nullable `setup.previewRaw` with the two unsigned wrapper bytes. Values retain address-based names; no unknown semantics are invented. Versions1–19 migrate them to null rather than assuming a source preview ran. Original imports and future restarts preserve represented values; every explicit preliminary preview writes201 anew. Restoration never reruns setup.

Five new unit cases independently compose the downstream source phases to verify exact terrain/site/RNG acceptance after zero/three rerolls and a subsequent settings change, cold/reset soil/water differences, stream continuity, atomic cancellation/errors, map/site/byte bounds, v20 migration and fourteen-day saved continuation. A browser test loads an accepted restart checkpoint and checks actual downloads/Next day/restoration. These exercise the canonical draft and resulting game; they do not yet exercise live preview buttons.

## Integration still required

Connect the draft to the original defworld artwork, React controls and separately drawn town/home markers. Existing live constructors still use their documented one-selected-generation policy; numbered presets and unmarked geography still need the preliminary-generation/branch composition before claiming the complete original chooser. The owner intentionally represents the custom path only. Native checkpoints do not serialize an open draft. Full setup effects, exact mouse/window/interrupt timing and remaining original interface screens remain unfinished. No DOS emulator or supplied-file modifications are used.
