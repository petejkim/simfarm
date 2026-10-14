# Generated asset cleanup

`./tools/bun run import` generates ignored files in `public/assets`. As of 2026-10-14, it writes runtime
images, MIDI tracks and data, plus raw preservation imports and `manifest.json`. Retired derived exports
are removed by exact known names during import; unrelated files are not swept or deleted.

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
