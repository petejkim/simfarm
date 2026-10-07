# SimFarm native preservation

Reconstruct the supplied `../simfarm-dos/SIMFARM.EXE` incrementally as a native TypeScript/Vite browser game. Do not run or embed a DOS/x86 emulator. Background music must use MIDI, not AdLib/FM. Keep simulation, asset decoding, audio, and UI separable for later enhancements.

- Inspect current files and `docs/progress.md` before continuing. Treat `../simfarm2` as incomplete research, not an implementation to copy wholesale.
- Ground recovered formats and rules in source bytes and executable addresses. Document offsets, hashes, hypotheses, and confidence in `docs`. Distinguish verified behavior from provisional scaffolding; do not declare a farming lookalike a completed port.
- Prioritize a playable original game loop while continuing reconstruction of its actual rules. Preserve unknown fields rather than inventing semantics.
- Never modify the supplied DOS distribution. Generated original assets stay ignored; import them locally with reproducible scripts.
- Install dependencies and tools only inside this repository. Use `.cache`, `.tools`, `.venv`, and `node_modules`; keep them ignored. Set npm's cache and Playwright's browser path locally.
- Use conventional commits in small meaningful increments. Update plans/progress with evidence, checks, limitations, and next actions.
- Run type checking, decoder/simulation tests, production build, and appropriate browser checks for the changed behavior. Test binary boundaries and recovered rules, not merely implementation details.
