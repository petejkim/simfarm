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
