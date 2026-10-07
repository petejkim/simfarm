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

### Next concrete work

1. Trace crop-graphics loading at file `0x46524`–`0x46ca6` to replace static placeholder atlas tiles with the original scenario's selected crops. The scenario stores sixteen crop filename slots near `0x21185`; the loader immediately after `0x45a37` reads them. Verify exact start and mappings rather than relying on this approximate location.
2. Recover scenario record meanings and remaining header state from loader `0x4543c` and its corresponding saver. Identify fields, ownership, cash, calendar, and selected crop slots.
3. Map the field-action dispatcher using the existing executable prompts (e.g. “Click on field to Plow” at file `0x4ee04`, “Select field to plant seed in” at `0x4ee2e`). Implement actual field operations and time/growth rules. Avoid copying the neighboring prototype's invented economics.
4. Implement a complete original plant/grow/harvest/store/sell loop, then expand the remaining systems in `plan.md`. Replace temporary MIDI timbres and reproduce the original loop behavior.

No playable farming loop, save/load, finances, equipment, livestock, weather simulation, disasters, town simulation, or enhancement framework is claimed complete.
