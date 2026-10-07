# SimFarm native preservation

Incremental reconstruction of the supplied 16-bit DOS SimFarm as a native TypeScript/React/Vite browser game, developed with Bun. No DOS runtime or x86 emulator is used. **This is not yet a playable port:** the current build explores the original farms, inspects fields and crops, and plays converted MIDI music.

## Run locally

Requires your original game files at `../simfarm-dos`. The bootstrap downloads Bun 1.4.2 into `.tools/bun` on macOS or Linux. No global installation or separate Node/npm runtime is needed.

```sh
sh tools/setup-bun.sh
./tools/bun install --frozen-lockfile
./tools/bun run import
./tools/bun run dev
```

Open the local URL printed by Vite. Choose one of eight scenarios, locate a field to see its crop and work status, scroll or use arrow keys to explore, zoom, click tiles, browse 24 crops, and start music. To import from another directory: `./tools/bun run import /path/to/simfarm-dos`.

Original files are never modified. Extracted resources are generated in ignored `public/assets`; they are not committed. Import precedes building so the browser bundle can run independently of the DOS distribution directory. Missing resources produce startup instructions.

## Validate

```sh
./tools/bun test
./tools/bun run build
PLAYWRIGHT_BROWSERS_PATH=.tools/playwright ./tools/bun run playwright install chromium
./tools/bun run test:browser
```

Browser checks exercise all maps, source-exact crop/overlay pixels, field inspection, crop selection, zoom, actual audio output, stopping playback, pending-load cancellation and missing-asset recovery. Tests read the original source distribution. `./tools/bun run preview` serves the production build.

## Static reconstruction tools

```sh
sh tools/setup-analysis.sh
./tools/bun run analyze --start 0x4543c --size 0x1000
```

Capstone and its dependencies are installed only in `.venv`. The analyzer writes an overlay map and requested disassembly ranges to ignored `artifacts`. Bun downloads use `.cache/bun`; browser binaries use `.tools/playwright`. `tools/bun` sets repository-local tool/cache paths, and `bunfig.toml` runs script dependencies with Bun even when they declare Node shebangs. See [Bun's runtime configuration](https://bun.sh/docs/runtime/bunfig) and [Vite's React plugin support](https://vite.dev/guide/features.html).

React components in `src/ui` own menus, selections and lifecycle. `src/render` draws the native canvas, `src/formats` decodes original data, `src/assets` loads resources, and `src/audio` plays MIDI. Recovered simulation belongs outside React so game rules can be tested independently and future graphics/UI changes can reuse them.

`src/simulation` contains recovered calendar arithmetic, deterministic random generators, field conditions and weekly crop growth. These are tested against original data and executable-derived cases; browser clock integration and the complete farming loop are still outstanding. Global game state will be owned by this simulation layer, with React subscribing to snapshots and sending commands.

See [the plan](docs/plan.md), [progress](docs/progress.md), and [binary evidence](docs/reverse-engineering.md). The world decoder, crop graphics substitution, masked tile layer and field inspection come from original executable evidence. Moving objects, remaining render passes and game rules require more reconstruction. Music uses original MIDI notes/program changes with a temporary Web Audio synthesizer; instrument fidelity and XMIDI looping are unfinished.
