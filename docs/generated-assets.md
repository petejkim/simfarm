# Generated asset cleanup

`./tools/bun run import` generates runtime files in ignored `public/assets` and preservation copies in
ignored `artifacts/original-assets`. The runtime-only split below supersedes the 2026-10-14 inventory.
Retired generated exports are removed by exact known names during import; unrelated files are not swept
or deleted.

## Runtime-only public assets (2026-10-15)

`public/assets/raw` contains only the original files still fetched by `src/assets/game-assets.ts`:

- 21 VOC samples represented by the canonical `GameSound` type (the birds, computer beep and thunder
  samples have no current playback request).
- All eight `SCEN0.SSM`–`SCEN7.SSM` farms, including the source data needed to validate saved numbered farms.
- Seven data/artwork files: `creditz.txt`, `townly0.cmp`, `itemtext.dat`, `scenario.odt`, `scenario.int`,
  `scenario.pal` and `far_mapc.mbm`.

The importer retains every archive member, all 24 crop files and eight farms byte-for-byte under
`artifacts/original-assets`, along with `manifest.json` containing source/member hashes and offsets.
Original-format/pixel tests read these preservation copies when the files are no longer runtime inputs.
Import removes their exact obsolete `public/assets/raw` copies, including the old crop subdirectory
when empty, and the former public source manifest. Required runtime originals are unchanged.

This removes 148 public files (2,025,890 bytes): 147 unused raw originals and the source manifest.
The local public tree now contains 110 runtime files plus the tracked `.gitkeep`. The checked production
build drops from 315 files / 8,844,386 bytes to 165 files / 6,810,300 bytes, also excluding dotfiles.
Sizes include bundled fonts and the MIDI synthesizer; these figures describe this build, not a promise
that every future build has the same size. All retained public-asset hashes and all 61 supplied DOS file
hashes remain unchanged.

Vite's production public-asset plugin copies only the explicit runtime inventory in tools/runtime-assets.ts,
excluding dotfiles, local extras, the old public manifest and any non-runtime raw files left by an older
import. It emits the runtime files unchanged; the ordinary Vite
bundle still supplies the compiled app, fonts and MIDI worklet/WASM. Development retains access to the
local imported assets; deployment requires only `dist/`, with no manual cleanup step.

Re-run import before building after upgrading to this layout. `tests/imported-assets.test.ts` covers
the exact raw inventory, source equality, preservation completeness and a legacy-import cleanup in an
isolated temporary output tree. `tests/browser/deployment-assets.spec.ts` checks every retained endpoint
and confirms preservation files are not served as assets. After build, run the production inventory check:

```sh
./tools/bun run test:browser --config playwright.production.config.ts tests/browser/deployment-assets.spec.ts
```

The production configuration uses a dedicated preview server on port 5191. Other browser specs can be
selected explicitly, but fixtures that import `/src` modules or intercept the development entry script
require the ordinary development-server configuration. Runtime files must stay fixed during browser runs.

## Cow-head home-screen icons (2026-10-15)

The importer now derives the home-screen icons from the original title artwork, using the exact
192×192 rectangle at x240,y200 (exclusive right/bottom432,392) in the decoded 640×480 `sftitle.png`.
`apple-touch-icon.png` and `app-icon-192.png` are identical unscaled copies of that crop.
`app-icon-512.png` enlarges it with nearest-neighbor sampling, preserving the source palette and opaque
pixels without extra borders. The Apple link in index.html declares192×192; manifest sizes remain192/512.
The16/32-pixel browser favicons continue to use the Apples crop artwork.

Source evidence in MEGADATA.EEA: `sftitle.int` at0x17d84f,153600bytes, SHA-256
`afe829e3a4e823295a32af21e2d3ba0f8bd88bd8f1f655db5f6dc1cbcf953cc5`;
`sftitle.pal` at0x1a310f,48bytes, SHA-256
`521aa38f525cb5f5c9e44b2e0c9e6c7c127812e0e8cf46a21ba95fa7230ba93b`.
Crop placement and icon sizing are requested native presentation choices, not recovered DOS behavior.
Original title artwork and supplied files remain unchanged; all three generated icon paths stay in the
runtime deployment inventory. The production installability check compares every icon pixel to the
source crop and checks opacity, served dimensions, manifest entries and the Apple link.

## Earlier generated-output cleanup (2026-10-14)

The cleanup removed 58 existing files (3,697,128 bytes):

| Retired outputs | Files | Bytes | Replacement or evidence |
| --- | ---: | ---: | --- |
| `scenario0.tiles.png`–`scenario7.tiles.png` | 8 | 2,560,620 | Shared `terrain-tiles.png`, `.rain` and `.frost`; farm slots map through `fixedCropTiles` |
| Whole-source `*.bmp.png` previews, except `popup.bmp.png` | 21 | 204,313 | Prepared runtime artwork or CSS; original bitmaps remain in `raw` |
| Eight `*.music.json` files | 8 | 487,194 | Converted `.mid` tracks; XMIDI decoder/loop tests remain |
| Eight `*.audio.json` files | 8 | 6,846 | Abandoned MP3 experiment; current playback uses libadlmidi |
| Other retired PNGs listed below | 13 | 438,155 | Runtime replacements and source decoder tests |

The other PNGs are `bank-terminal`, `evaluation-window`, `market-window`, `examine-window`,
`message-button`, `town-choice-pressed`, `crop-tiles`, `mini-tiles`, `scenario`, `prsnt480`, `tiles`,
`edit-help` and `sell-conditions`. Their `.png` exports are gone. Source screen/miniature hashes, artwork
mask/boundary tests and crop-packing tests remain; tests no longer require unused files to be exported.
Known-track `.mp3` files are also removed if present; none existed in this audit.

`loadScenarioAssets` previously fetched a scenario PNG but discarded it, returning the shared terrain
sheet. It now reads only the original SSM before obtaining the shared sheets. Startup artwork failures
exercise `terrain-tiles.png`; numbered-checkpoint failures and cancellation exercise the original SSM.
An all-eight-region browser check rejects legacy PNG requests and requires exactly one request for each
shared terrain palette, while comparing complete saved state against the simulation.

The remaining 76 top-level files serve runtime use, the input/member hash manifest and `.gitkeep`.
All 151 archive members, 24 raw crop files and eight SSMs remain as reproducible preservation evidence;
they are intentionally retained even where the browser uses decoded JSON or prepared images. A test
compares every raw archive member against its source bytes. Scenario and crop tests separately pin their
raw copies and decoded graphics.

No recovered format, simulation rule or native save schema changed. No original-game defect is claimed.
The source executable remains SHA-256
`8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`.
Before/after SHA-256 checks found no changes to any retained asset, manifest or supplied DOS file.
The complete removed-file inventory and byte counts are in ignored `artifacts/asset-cleanup-audit.json`;
validation results and limits are recorded in `progress.md`.
