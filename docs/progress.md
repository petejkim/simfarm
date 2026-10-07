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

## 2026-10-07 — field lifecycle integration

The previous goal turn made progress by committing the requested original-defect policy and log. Continued the gameplay reconstruction by porting status badges, their simulation side effects and the Growing branch's expiry cleanup. A saved corn field now advances through its full unharvested lifetime in a simulation test, returns nutrients and becomes fallow. Preserved and documented the original water-warning/stress threshold discrepancy as SF-006.

Validation: 21 Bun tests and TypeScript/production build pass. No browser behavior changed. These are simulation components; the browser clock, weather integration, machinery, harvesting and sale remain outstanding. Next: connect weather and field water refresh to the calendar and central simulation owner, then expose time controls as the work-order system is reconstructed.

## 2026-10-07 — running native crop and weather simulation

Mapped all five years of saved climate tables and ported original forecast patterns, daily precipitation/evaporation, soil moisture and grass updates, wind arithmetic and field-water border scanning. Added a plain TypeScript `GameSimulation` that owns copied game state, deterministic random streams and the partial scheduler. React subscribes to detached snapshots and sends commands; Play/Pause/Next day now advance date, weather, crop growth, status badges and expiry on the map. Farm selection resets to a paused simulation.

This is a deliberately incomplete game scheduler. It preserves recovered daily/weekly ordering, but machinery, planting, harvest, inventory, sales, finances, livestock, pumps, disaster damage and town simulation remain unimplemented. Browser pacing is one day per second, not the original interrupt rate; exact DOS startup/random consumption is not claimed. The end goal remains the complete playable game, with the farming cycle the next priority.

Validation: 29 Bun tests and the TypeScript/production build pass. Tests cover all eight farms advancing one 336-day year, manual versus timed determinism, state ownership, pause/subscription behavior, all forecast patterns, RNG consumption, wind drying, rain accumulation, signed moisture shifts, water border corners, crop expiry and the fifth year-end temperature alias. Browser checks exposed and fixed a new RAF integration bug: a first animation-frame timestamp can precede `performance.now()`, so elapsed time now starts with the first frame's timestamp. Five Chromium tests pass, including time controls, map changes, scenario reset, original pixel checks, asset failure recovery and audible MIDI. Inspected the updated browser screenshot. SF-007 and SF-008 document newly recovered original temperature and precipitation indexing hazards.

Next concrete step: recover equipment records and the work-order dispatcher (`0x17d3c`) starting with plowing (`0x26c64`) and planting (`0x23fc7`), then connect harvesting/yield storage and crop sales. Keep building on the central state owner; do not replace the original machinery/economy with invented instant operations.

## 2026-10-07 — equipment routing and attachments

The immediately preceding policy-check turn made no implementation progress: it verified that AGENTS.md already contained the requested rule. Revalidated the clean worktree and continued the active game reconstruction; there is no external blocker.

Decoded all 127 saved machinery slots and twelve type definitions, preserving unknown bytes and copying their state into simulation-owned data and detached UI snapshots. Ported owned-equipment selection, movement-order setup, original greedy route scoring/candidate selection, attachment creation and chain positioning. These establish machinery dependencies of the farming loop; they are not yet invoked by the browser scheduler. No instant planting/harvesting substitute was introduced.

The evidence corrected two earlier leads: the calendar-plan writer is not a worker dispatcher, and planting acquires equipment in its FSM after the click handler. State 2 itself is a no-op in the field dispatcher. Planting state 3 performs two equipment phases. The next integration must include building withdrawal, map occupancy/visibility, wear and arrival handlers before executing those phases. Concrete addresses and ported boundaries are in `reverse-engineering.md`.

Documented original terrain-check bypass, destination teleport fallback and unchecked route edges as SF-009, with the native map-edge guard recorded explicitly. Recorded the two-member detach limitation as SF-010; ordinary-game reachability of longer chains is still unproven and the detach fix is deferred. Neither is claimed to establish an exploitable vulnerability.

Validation: 35 Bun tests, TypeScript/production build and all five Chromium checks pass. New cases cover all eight equipment tables, source-byte isolation, malformed counts/links, allocator exclusions/ties, destination/history setup, exact terrain-category boundaries, routing penalties and fallback, a complete road-corridor route, cardinal attachment geometry and multi-member repositioning. Snapshot tests now also prove equipment/definition ownership. Browser tests verify existing crop/weather/time/MIDI behavior survives the expanded scenario state.

The complete game goal remains active. The browser still lacks executable planting/harvest orders, inventory/sales, save/load and other major original systems. Next: port machinery occupancy and storage removal, complete movement/field traversal, then drive planting and harvest with their original seed, machine and inventory prerequisites.

## 2026-10-07 — machinery world updates and shed withdrawal

The preceding goal turn made progress: `f45867e` committed and tested machinery data/routing/attachment primitives. Revalidated that commit and the clean worktree before continuing.

Ported actual equipment overlay drawing/erasure, footprint checks, movement with history and forced-arrival recovery, shared grass-travel wear, livestock collision aftermath and serpentine field traversal. Added saved animal records needed by collision handling, retaining the rest of each record for future livestock reconstruction. Map writes feed the existing native renderer; no DOS execution environment or UI-owned simulation state was introduced.

Decoded building records and definitions, ported building interior/roof switching and storage withdrawal, and completed the owned-machine reservation branch. Every stored machine in all eight original farms can be withdrawn with exactly its footprint removed from storage. An integration test uses original saved machines, withdraws a tractor and implement, moves them together and completes an entire field pass. That test explicitly supplies the field-entry step; it is not a completed planting FSM or browser farming cycle.

Recorded native guards for original attachment/field-edge address hazards in SF-009, the original two-member drawn-flag limitation alongside SF-010, and unchecked saved storage indices in new SF-011. The original 64-update movement recovery now has a test showing that even steady progress can trigger its teleport/wear branch. Original behavior remains documented despite native bounds validation.

Validation: all 50 Bun tests pass (48 in the full run plus two subsequent storage/integration cases), TypeScript/production build pass, and all five Chromium checks pass. Original truck overlays restore both world words exactly after erase/redraw; tests also verify byte ownership, graphics frames/orientation, movement and wear, collision effects, field borders/badges, all original building/animal counts, shed contents and malformed-reference rejection.

The browser scheduler still runs calendar/weather/growth only. Remaining machinery integration is arrival/parking/store-back, release/detachment, rental policy, field-entry and the planting/harvest FSMs. Sound-effect events are recorded but not yet played. Next complete those dependencies, seed consumption/purchase, inventory and crop sales to expose the original farming loop. Save/load and other major systems remain required by the active full-game goal; no completion or external blocker is claimed.

## 2026-10-07 — original planting passes and machinery return

The preceding user-policy turn made progress by committing explicit retention and deferral rules in AGENTS.md (`dbfa55a`). Revalidated the worktree's uncommitted machinery/planting implementation against its source addresses and added integration coverage rather than restarting the reconstruction.

Completed equipment arrival dispatch, return/detach/release, parking search, shed store-back, implement relocation and the twelve-step planting FSM. The sequence uses the same tractor for two different implements, changes the ground through both original passes, enters Growing and returns machines to their original storage or parking locations. Tests execute this sequence on all four supplied farms with the required owned equipment. The other farms require the outstanding rental path; the test boundary explicitly starts after seed validation, not at a completed player command.

Retained and updated SF-010 after correcting whole-chain detachment. Added SF-012 for unchecked/unbounded parking search and SF-013 for the planting completion timestamp write to reserved slot zero. Native parking exhaustion returns a notice; the original bookkeeping write is preserved. No exploit is claimed.

Validation: 59 Bun tests and TypeScript/production build pass. New checks include all original stored-machine round trips, rotated first-fit storage, fully blocked parking termination, tick wrap/pacing, both return modes, tractor-assisted implement relocation and complete planting/return on SCEN3–6. No browser/UI behavior changed in this increment.

The full game goal remains active. Next recover seed consumption/purchase and automatic rental, connect machinery/planting to GameSimulation and React commands, then implement harvest, inventory and sales. The browser remains limited to calendar/weather/growing fields until those command prerequisites are connected; save/load and other major systems also remain unfinished.

## 2026-10-07 — automatic equipment rentals

Continued after committing planting/return as `6df2b14`. Recovered and implemented original automatic ground-equipment rental: the saved setting, first-free-slot constructor, half-purchase-price debit, rental expense accounting, town-entry placement and removal after return. Missing funds and exhausted machine slots do not produce active rentals or unauthorized charges. Reused slots retain bytes the original constructor does not initialize. Plane rental/cleanup remains separate and unimplemented.

Planting/return integration now also passes on the four farms without all required owned machines, using actual rentals and original prices. Combined coverage spans all eight supplied farms. Corrected swapped native property names for the saved equipment/calendar timer and animation timer; their previous values were not consumed by the browser scheduler.

Documented the original accounting loader's duplicate destination as SF-014, deferred pending full ledger/saver reconstruction, and unsigned expense-total overflow as SF-015, preserved with a regression. Validation: 64 Bun tests, TypeScript/production build and all five Chromium checks pass. The complete playable game remains the objective; these tests still start after seed validation. Next implement seed inventory/automatic seed purchase and the planting command, then connect the simulation clock/UI and proceed to harvesting, storage and sale.

## 2026-10-07 — seed inventory and acquisition

Decoded saved inventory and goods definitions and implemented stored-seed removal, automatic seed buying and expense accounting, with independent copies in simulation snapshots. Documented inconsistent original inventory counts and seed removal as SF-016/SF-017. Tests cover all original inventories, all 36 stored SCEN6 seeds, storage cleanup, affordability and unchanged state on malformed storage.

This is the first part of the previously pending planting increment, split into smaller commits at the user's request. Browser planting controls and running machinery will follow in their own commits.

Validation at this commit boundary: 68 Bun tests, TypeScript checking and production build pass. The existing browser controls are unchanged.
