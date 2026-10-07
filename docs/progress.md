# Progress

## 2026-10-07 — baseline inspection

The authoritative worktree initially contained only `.gitignore`; there was no native implementation to continue. No previous implementation turn is available to classify. The next concrete action is foundational extraction and executable mapping.

Inspected `../simfarm2/tools/extract.py` and `src/simulation.js` as preliminary research. The latter explicitly invents simulation rules, so it is not a source of recovered gameplay behavior. Useful archive and planar-image hypotheses will be checked independently against the original bytes.

Source distribution contains a 595,897-byte MZ executable, a 2,213,377-byte archive, 3,040-byte index, eight 139,072-byte scenarios, and 24 crop files. Nothing in the source distribution has been modified.

Full game reconstruction is outstanding. See `plan.md` for the intact objective and sequence.

## 2026-10-07 — verified data foundation

Implemented new TypeScript archive, planar graphics, crop metadata, and scenario decoders, with a local importer and SHA-256 manifest. Successfully imported 151 archive members, 880 tiles, all 24 crop files, and eight scenarios. Original assets are generated/ignored.

Installed Vite/TypeScript/testing packages locally and Capstone in `.venv`; Chromium is in `.tools/playwright`. Recovered the Microsoft overlay directory (30 entries), correct overlay payload offsets, initialized DS mapping, and the actual scenario loader. The loader proves a 96×96 world starting at `0x152c4`, with five-byte cells. This replaces tentative pattern guesses with executable evidence. See `reverse-engineering.md`.

Validation: `npm run import`, `npm run analyze -- --start 0x4543c --size 0x1000`, and three binary tests passed. Tests exercise bitplane ordering, malformed boundaries, all original BMPs, crop metadata, and every scenario terrain index. Browser rendering and gameplay remain outstanding.

## 2026-10-07 — first native browser slice

Added the TypeScript/Vite browser UI with all eight original 96×96 scenario terrain maps, pan/zoom, tile inspection, and the 24 original crop cards/descriptions. Converted all eight XMIDI tracks to standard MIDI plus native event sequences and added audible browser playback without FM emulation. The current synthesizer uses temporary oscillator timbres; exact GM instruments and `genfarm` internal loop semantics remain outstanding.

Validation: five decoder/music tests pass, TypeScript and production build pass, two Chromium end-to-end tests pass. The browser test visits all scenarios, checks original crop selection, renders a multicolor map, exercises zoom, measures actual nonzero Web Audio samples, verifies silence after Stop, and checks missing-resource instructions. Visually inspected `artifacts/native-browser.png`. That inspection confirms the need for crop tile substitution and additional compositing; terrain-only rendering is not yet faithful farm rendering.

This turn made authoritative progress from the empty baseline: docs, independently implemented extraction, executable overlay analysis, code-backed world layout, native browser rendering, MIDI conversion/playback, and reproducible checks. The full goal remains active. There is no blocker requiring user input.

### Next concrete work at the first browser slice

1. Trace crop-graphics loading at file `0x46524`–`0x46ca6` to replace static placeholder atlas tiles with the original scenario's selected crops. The scenario stores sixteen crop filename slots near `0x21185`; the loader immediately after `0x45a37` reads them. Verify exact start and mappings rather than relying on this approximate location.
2. Recover scenario record meanings and remaining header state from loader `0x4543c` and its corresponding saver. Identify fields, ownership, cash, calendar, and selected crop slots.
3. Map the field-action dispatcher using the existing executable prompts (e.g. “Click on field to Plow” at file `0x4ee04`, “Select field to plant seed in” at `0x4ee2e`). Implement actual field operations and time/growth rules. Avoid copying the neighboring prototype's invented economics.
4. Implement a complete original plant/grow/harvest/store/sell loop, then expand the remaining systems in `plan.md`. Replace temporary MIDI timbres and reproduce the original loop behavior.

No playable farming loop, save/load, finances, equipment, livestock, weather simulation, disasters, town simulation, or enhancement framework is claimed complete.

## 2026-10-07 — original crop layers and field records

Recovered the sixteen crop filenames at exact scenario offset `0x21193`, fourteen graphic substitutions per crop slot, and masked-tile compositing with color 7 transparency. Corrected the initial world orientation: original renderer code proves column-major indexing (`x * 96 + y`). Every scenario now receives its own patched atlas. The first map was transposed and used static placeholders; those errors are fixed.

Identified the 68-byte field records, active flag, actual display numbers, bounds, crop slots and ten work states. Added field selection, map outlines, centering and crop/status inspection while preserving all unknown bytes. Located original work-order, equipment FSM, growth and marker routines for the next simulation work; detailed addresses are in `reverse-engineering.md`.

Validation: eleven binary/music tests, import, type check and production build passed; three Chromium tests passed, including full-tile comparisons against original crop and masked assets, field centering/clicking, all eight farms and audible MIDI. Inspected the rendered screenshot. The farm remains an inspection build, with no playable farming loop yet.

The user requested React and Bun to replace the growing imperative DOM UI and npm workflow. Migrate those next without moving rendering/format/audio code into UI components, then prioritize recovered action scheduling and the plant/grow/harvest/store/sell loop.

## 2026-10-07 — React UI and repository-local Bun

Replaced the imperative `main.ts` DOM construction and mutation with React components for the app, farm view, field panel, crop guide and music controls. Selections, loading/error states and status text now follow React state. The canvas render pass lives independently in `src/render/world-renderer.ts`; DOM refs are confined to canvas drawing and viewport navigation. Binary formats and MIDI playback remain separate. Resource effects abort obsolete requests, and music lifecycle cleanup stops playback and closes its AudioContext. React StrictMode is enabled.

Installed Bun 1.4.2 under `.tools/bun`, added a pinned local bootstrap and `tools/bun` wrapper, and migrated the package lockfile, importer, unit tests, Vite and Playwright commands. Removed npm's lockfile and the tsx dependency. `bunfig.toml` keeps the cache local and forces Bun for script dependencies with Node shebangs. README and AGENTS.md now prescribe React/Bun. No global tools or shell profiles were changed.

Validation: frozen-lockfile installation, asset import, eleven Bun tests, TypeScript check, production build and four Chromium tests passed. Browser checks preserve exact original tile pixels, field inspection, all scenarios, zoom and actual MIDI audio; new coverage checks pending-load cancellation and recovery from a missing farm atlas. Build and browser tests also passed with PATH restricted to repository Bun and system utilities, excluding the separate Node installation. Inspected the React-rendered screenshot.

The user reaffirmed that the goal is a fully playable game. This migration is complete, but the game goal remains active. The next milestone is an original farming cycle on a supplied farm: recover clock/calendar/cash state, port field work dispatch and its equipment prerequisites, then growth, harvest, inventory and sale. Keep those rules in simulation modules with evidence-backed tests; avoid spending further turns on unrelated viewer features. See the action addresses in `reverse-engineering.md` for the next concrete entry points.

## 2026-10-07 — original simulation arithmetic

The preceding goal turn was progress: React/Bun migration was committed and verified. This turn moved into executable-backed simulation code. Recovered exact saved cash, calendar, tick/speed and regional-condition offsets. Implemented original calendar rollover, three deterministic random streams, eighteen-mode field-condition dispatch, weekly Growing-state temperature/depletion/stress arithmetic and crop-stage map updates in plain TypeScript. Preserved original integer behavior and source quirks rather than using invented growth rates.

New simulation tests exposed Buffer aliasing in earlier decoder/importer copies. Fixed field records, regional records and crop atlas copying, and strengthened unchanged-input checks so they cannot pass by comparing two aliases.

Validation: eighteen Bun tests, full asset import, TypeScript/production build and four Chromium tests passed. Simulation tests cover all eight saved calendars, a full 336-day year, season boundaries, independent RNG streams and restoration, source subtraction quirks, weekly-update gating, original grape depletion/stress values, stage rounding, temperature deficits, accumulator saturation and expiry flags. These checks establish the implemented primitives, not end-to-end gameplay fidelity.

The user confirmed the architecture: the simulation owns global game state, independently of React; React subscribes to snapshots and sends commands. This is recorded in AGENTS.md. Current simulation primitives remain separate from UI. A central simulation state owner and clock integration are still to be connected as the scheduler is ported.

The full game remains incomplete. The newly ported growth subsystem does not yet run from a browser clock. Next concrete work: port daily weather/condition updates (`0xc88e`, `0xd1ae`, `0xc364`, `1b98:0a00`), status badges (`0x19002`), expiry cleanup (`0x1c2a8`), and equipment work dispatch. Then connect the central simulation state to React and finish planting/harvest/inventory/sale. Detailed arithmetic and remaining branches are in `reverse-engineering.md`.
