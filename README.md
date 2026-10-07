# SimFarm native preservation

Incremental reconstruction of the supplied 16-bit DOS SimFarm as a native TypeScript/Vite browser game. No DOS runtime or x86 emulator is used. **This is not yet a playable port:** the current build explores the original farms, inspects fields and crops, and plays converted MIDI music.

## Run locally

Requires a recent Node.js (22.12+; developed with 24.21) and your original game files at `../simfarm-dos`.

```sh
npm ci
npm run import
npm run dev
```

Open the local URL printed by Vite. Choose one of eight scenarios, locate a field to see its crop and work status, scroll or use arrow keys to explore, zoom, click tiles, browse 24 crops, and start music. To import from another directory: `npm run import -- /path/to/simfarm-dos`.

Original files are never modified. Extracted resources are generated in ignored `public/assets`; they are not committed. Import precedes building so the browser bundle can run independently of the DOS distribution directory. Missing resources produce startup instructions.

## Validate

```sh
npm test
npm run build
PLAYWRIGHT_BROWSERS_PATH=.tools/playwright npx playwright install chromium
npm run test:browser
```

Browser checks exercise all maps, source-exact crop/overlay pixels, field inspection, crop selection, zoom, actual audio output, stopping playback, and missing-asset handling. Tests read the original source distribution. `npm run preview` serves the production build.

## Static reconstruction tools

```sh
sh tools/setup-analysis.sh
npm run analyze -- --start 0x4543c --size 0x1000
```

Capstone and its dependencies are installed only in `.venv`. The analyzer writes an overlay map and requested disassembly ranges to ignored `artifacts`. npm downloads use `.cache/npm`; browser binaries use `.tools/playwright`.

See [the plan](docs/plan.md), [progress](docs/progress.md), and [binary evidence](docs/reverse-engineering.md). The world decoder, crop graphics substitution, masked tile layer and field inspection come from original executable evidence. Moving objects, remaining render passes and game rules require more reconstruction. Music uses original MIDI notes/program changes with a temporary Web Audio synthesizer; instrument fidelity and XMIDI looping are unfinished.
