# SimFarm TypeScript/React remake

Reconstruct `../simfarm-dos/SIMFARM.EXE` incrementally as a native TypeScript/React/Vite browser game, using Bun. Never run or embed a DOS/x86 emulator.

- Inspect current files and `docs/progress.md` before continuing.
- Ground recovered formats and rules in source bytes and executable addresses; document offsets, hashes, hypotheses and confidence in `docs`. Distinguish verified behavior from scaffolding; do not claim an incomplete port is complete.
- Log original defects, overflow hazards and suspected vulnerabilities in `docs/original-bugs.md`, including evidence, confidence, original/native behavior, status and deferred follow-up. Retain resolved entries; distinguish arithmetic quirks from proven reachable bugs or vulnerabilities.
- Preserve documented native adaptations (including `docs/all-crops.md`), exact checkpoint loading and original restart evidence/tests.
- Use native browser pacing; DOS timing fidelity is not required.
- Terrain stays permanently behind dialogs, without window chrome. Edit shortcuts focus it without closing dialogs. Floating windows have movable original-style titlebars; placement stays outside simulation saves.
- Preserve original UI layout, 1× artwork wherever it fits, phone playability and full-screen home-screen installation.
- Never modify the supplied DOS distribution. Reproducibly import original assets locally; keep generated assets ignored.
- Use React state and components for controls and HTML for all UI text, except bitmap logos documented in `docs/about-dialog.md` and `docs/farm-expert.md`.
- Separate simulation, decoding, audio and UI. Keep canvas drawing in `src/render`, using refs for canvas/viewport integration. Plain TypeScript simulation owns rules/global state; React subscribes to snapshots and sends commands. Hooks/UI stores must not own simulation state or rules.
- Play converted .mid music through libadlmidi-js’s light build, embedded bank 58 (WOPL, The Fat Man 2op set). Keep music and effects working on mobile browsers.
- Keep dependencies, tools, Bun cache and Playwright browsers repository-local. Use `./tools/bun` (bootstrap: `sh tools/setup-bun.sh`); ignore `.cache`, `.tools`, `.venv` and `node_modules`. Commit `bun.lock`, never npm lockfiles; require no separate Node installation.
- If `.git` becomes read-only, report the failed operation and pause for the user; never work around it. Make small, meaningful conventional commits; push only on request.
- Update plans/progress with evidence, validation scope, gaps, limitations and next actions.
- For implementation changes, run type checking/production build, relevant decoder/simulation tests and browser checks of changed behavior and directly affected flows. Test binary boundaries and recovered rules. Keep runtime files fixed during browser runs.
- Run full regression at meaningful milestones, after related batches, on request or for broad rule/format/save/timing/input/architecture changes; judge behavioral impact, not file location. Recheck failures narrowly and broaden only when justified. Avoid redundant full suites for documentation, test-expectation or timeout-only corrections.
