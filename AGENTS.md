# SimFarm native preservation

Reconstruct the supplied `../simfarm-dos/SIMFARM.EXE` incrementally as a native TypeScript/React/Vite browser game, using Bun for packages, scripts and tests. Do not run or embed a DOS/x86 emulator. Background music must use MIDI, not AdLib/FM. Keep simulation, asset decoding, audio, and UI separable for later enhancements.

- Inspect current files and `docs/progress.md` before continuing. Treat `../simfarm2` as incomplete research, not an implementation to copy wholesale.
- Ground recovered formats and rules in source bytes and executable addresses. Document offsets, hashes, hypotheses, and confidence in `docs`. Distinguish verified behavior from provisional scaffolding; do not declare a farming lookalike a completed port.
- Record original-game defects, overflow hazards and suspected vulnerabilities in the separate `docs/original-bugs.md` document, even after fixing them. Include evidence, confidence, original/native behavior and whether the fix is deferred. It is acceptable to document an issue and defer its fix; record what needs to be revisited. Retain resolved entries and update their status rather than deleting them. Distinguish arithmetic quirks from proven reachable bugs or security vulnerabilities.
- Prioritize a playable original game loop while continuing reconstruction of its actual rules. Preserve unknown fields rather than inventing semantics.
- Never modify the supplied DOS distribution. Generated original assets stay ignored; import them locally with reproducible scripts.
- Use React state and components for UI controls and text. Keep imperative canvas drawing in `src/render`, with refs for canvas/viewport integration. Global game state belongs to the plain TypeScript simulation, independent of React; UI subscribes to snapshots and sends commands. Do not move simulation rules/state ownership into hooks or a UI store.
- Install dependencies and tools only inside this repository. Use `./tools/bun` (bootstrap: `sh tools/setup-bun.sh`); keep `.cache`, `.tools`, `.venv`, and `node_modules` ignored. Bun's cache and Playwright's browser path must remain local. Commit `bun.lock`, not npm lockfiles; do not require a separate Node installation.
- Use conventional commits in small meaningful increments. Update plans/progress with evidence, checks, limitations, and next actions.
- Run type checking, decoder/simulation tests, production build, and appropriate browser checks for the changed behavior. Test binary boundaries and recovered rules, not merely implementation details.
