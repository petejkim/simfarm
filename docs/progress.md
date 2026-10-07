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

## 2026-10-07 — planting commands and machinery scheduler

Connected seed acquisition, recovered existing-field planting orders, crop-loader prices and equipment substeps to the independent GameSimulation. Commands run planting through both passes and return, followed by crop growth. SF-018 records the original destructive failure path; native failed seed acquisition preserves the crop and contract. Added all-eight-farm integration, duplicate-order, failure atomicity, snapshot ownership and frame-partition determinism coverage. UI controls are the next commit boundary.

Validation at this commit boundary: all 71 Bun tests, TypeScript checking and production build pass. The final browser controls are validated in the following increment.

## 2026-10-07 — browser planting controls and restored verification

React now exposes crop selection and planting commands, seed costs, status and busy-field controls. All six Chromium checks pass, including seed buying, rentals, planting completion, exact original crop pixels and scenario reset. Visually inspected `artifacts/browser-planting.png`. TypeScript and production build also pass. The earlier unverified browser result was caused by local server connectivity; access is restored and the completed run now verifies this increment.

Split the previously combined local planting commit into seed inventory, simulation commands/scheduler and React controls, each with its corresponding evidence and checks. Earlier commits are preserved; nothing was pushed. The final implementation matches the previously validated combined increment.

The full game goal remains active. Next reconstruct harvest machinery (`0x156be`), yield/value (`0x1c092`, `0x1c24e`, `0x1c4aa`), storage and sale. Original future calendar scheduling, new-field placement, save/load and the other original systems remain unfinished.

## 2026-10-07 — harvest valuation arithmetic

The preceding goal turn made progress: the pending planting work was split into independently checked local commits and the requested Git read-only pause policy was committed. Worktree was clean on resumption. Continued directly into harvest code, recovering shared maturity, loss and crop/contract value functions from the executable and Microsoft arithmetic helpers. Added pure TypeScript implementations and source-data/boundary coverage. Recorded signed maturity wrap and intermediate value truncation as SF-019/SF-020, with reachability qualifications and preserved native behavior.

Harvest commands, workers, storage delivery and crop sales are still outstanding; this increment is their shared arithmetic, not a completed harvest loop. Next port inventory construction/storage and the machinery/worker harvest FSM, then expose the command through GameSimulation and React.

Validation: 75 Bun tests, TypeScript checking and production build pass. No browser behavior changed in this arithmetic increment.

## 2026-10-07 — harvest inventory and storage reservations

After committing shared valuation as `132323d`, recovered harvested-goods definitions, the inventory constructor, nearest crop-storage reservation and truck delivery's reserved-cell completion. Added bounded native operations that preserve unnamed bytes and the original first-reserved-cell ordering. Decoding/snapshots now retain the additional sixteen goods definitions. Full storage tests span all eight farms (including the two without crop storage), exact executable graphics, inventory slot boundaries and source/snapshot isolation.

Recorded SF-021 (512 inventory slots versus byte building references) with native prevalidation, and SF-022 (storage reservation leak on allocation failure) with a cleanup primitive; actual harvest failure-path integration is explicitly deferred. Machinery and worker harvest FSMs, commands and crop sales remain next.

Validation: all 80 Bun tests, TypeScript checking, production build and six Chromium checks pass. Existing planting, calendar/weather and MIDI behavior remain verified with the expanded snapshot data.

Additional static harvest tracing identified crop byte +57 as the machinery/worker selector and the original truck-return uninitialized-index defect (SF-023, native fix deferred until that FSM is implemented). Concrete order/credit/return entry points are recorded in `reverse-engineering.md` for the next increment. Full playable harvest/store/sell remains unfinished, and the goal remains active.

## 2026-10-07 — complete harvest sequences in simulation

The preceding goal turn made progress through committed valuation/storage primitives and defect evidence. Revalidated a clean worktree, then implemented the original machinery and worker harvest sequences, cash/contract posting, storage delivery, no-storage sale and equipment return. Both methods now complete on original farms in simulation tests. SF-022 reservation leaks and SF-023 stale header writes are fixed and retained in the defect log; SF-024/SF-025 document preserved worker duration/cleanup quirks.

Validation: 88 Bun tests and TypeScript/production build pass. New integration tests exercise all eight farms and both harvest methods, exact quantity/loss storage, contracts, costs, sales, cash caps, ledger overflow, inventory exhaustion, concurrent reservations and return isolation. Browser harvest commands are not connected yet; the next increment connects them and adds browser checks. Stored-inventory sales still require their own recovered removal/valuation path.

The user asked about planting a new field. Confirmed that current planting only supports existing scenario fields. New-field creation is the next gameplay priority after the complete harvest/storage/sale cycle; it remains required by the full objective.

## 2026-10-07 — harvest commands in the game clock

The preceding question-only turn was no implementation progress; revalidated clean commit `4828acc` and continued the available harvest integration. GameSimulation now owns harvest commands/results and value estimates, runs both harvest methods alongside machinery/weather, and publishes delivered inventory. Tests start from all eight unmodified original saves and verify completion, equipment return, replanting, invalid/duplicate commands, snapshot isolation and frame-partition determinism.

Validation: 91 Bun tests and TypeScript/production build pass. Browser controls and their checks follow in the next increment; stored-goods sale is still outstanding. New-field creation remains the next priority after that farming cycle, and the full game objective remains active.

## 2026-10-07 — browser harvesting and stored crop display

Committed the command/scheduler integration as `6ae956b`, then added React harvest controls, source-derived maturity/value estimates, worker fees, work progress and an inventory list. The controls reject busy or empty fields and keep simulation state in GameSimulation. Harvesting an immature crop remains allowed and displays its zero estimate; no invented maturity rule was added.

Validation: TypeScript/production build and all eight Chromium checks pass, including both original harvest methods, pause/manual advancement, delivered quantities/losses, annual/perennial completion and scenario reset. Visually inspected `artifacts/browser-harvest-4.png`. The preceding simulation gate passed all 91 Bun tests. Browser tests use unmodified scenarios with immature crops and do not claim a profitable farming cycle. Stored-crop sale recovery is next, followed by new-field creation. Other original systems/save-load remain required.

## 2026-10-07 — synchronize planting and harvest prices

Stored-sale tracing exposed a native integration error: planting updated the market-price array but left the decoded trade definition unchanged, so the new harvest engine could credit a stale price while the UI displayed the reduced one. Planting now updates both representations of the same original price. This is a native defect, not an original-game bug.

Validation: all 91 Bun tests, TypeScript/production build and eight Chromium checks pass. The all-farm planting integration now verifies synchronized prices and the original quarter-price reduction (rounding the remainder upward). Stored-sale executable tracing continues independently.

## 2026-10-07 — stored-crop sale reconstruction

Recovered the actual immediate inventory sale, including current trade-price valuation, cash and ledger posting, barn/outdoor image removal and goods-count/deactivation. Added SF-026 for original double crop-income bookkeeping (preserved) and SF-027 for payment before failed removal (fixed by native prevalidation). This increment is the standalone transaction; simulation commands and React sale buttons follow separately.

Validation: 96 Bun tests and TypeScript/production build pass. New coverage sells all sixteen crop types through all six original farms with crop storage, checks exact value and removal, cash/ledger boundaries, zero-value disposal and malformed-state atomicity. Browser behavior was unchanged by this standalone addition; its preceding eight Chromium checks remain valid. Next expose sales and verify the player loop, then proceed to new-field creation.

## 2026-10-07 — player farming cycle reaches stored-crop sales

Connected the sale transaction to GameSimulation and React, with live value quotes, immediate sale buttons, cash/result feedback and removal from storage. Added a complete player-command and Chromium cycle using unmodified SCEN4: plant corn, advance 85 days of actual growth/weather, harvest with machinery, store, sell for a positive value, and permit replanting. The observed browser cycle ended at $41,864 from $40,000 after its seed purchase; no mature/healthy fixture or invented crop value is used in this check.

Validation: all 97 Bun tests, TypeScript/production build and nine Chromium checks pass. Visually inspected `artifacts/browser-farming-cycle.png`. Increased only the existing eight-farm/year test's timeout to 15 seconds after concurrent browser execution exceeded its default five-second limit; its assertions are unchanged. Snapshot isolation and duplicate-sale rejection are covered.

This verifies a core farming cycle, not a completed original game. New-field creation, crop treatments, complete economy/markets, save/load and other original systems remain. The user requested a simulation-speed slider after this increment and before the next task; implement and commit that first, then resume new-field reconstruction.

## 2026-10-07 — requested simulation-speed slider

After committing the farming cycle as `6838173`, implemented the user's requested speed slider before starting new-field work. React sends `set-speed` to GameSimulation, which owns 0.25×–16× pacing (default 1×). Speed changes preserve fractional logical ticks; pause still stops the simulation and Next day advances exactly one day. Changing scenarios resets to paused/1×. Original equipment/calendar timing ratios and simulation rules are unchanged; this is explicitly documented as a native enhancement.

Validation: all 99 Bun tests and TypeScript/production build pass. Nine existing Chromium checks passed; the new speed check passed after fixing its accessible label and freezing the test clock between explicit advances (automatic real-time drift at 16× otherwise invalidated exact-day assertions). Keyboard Home/End, live speed changes, pause, single-day stepping, scenario reset and a 390px mobile viewport are covered. Visually inspected `artifacts/browser-speed.png`. The unit checks compare complete machinery/weather state at 16× against equivalent normal-speed time and verify fractional tick preservation and invalid-command rejection.

Updated README with current harvest/sale controls and speed behavior. New-field placement is next; the full original-game objective remains active with save/load and other major systems still outstanding.

## 2026-10-07 — new-field placement rules and initialization

The preceding turn made progress through committed harvest/sales integration and the requested speed slider (`1c24375`). Revalidated the clean worktree and recovered the original 8×8 field validator and constructor. Added owned-land/terrain/spacing checks, the saved automatic-clearing flag, region-derived initialization and exact map/record updates. SF-028 documents the original full-table return defect; native exhaustion is rejected before mutation. Source bytes remain untouched and unknown record fields remain preserved.

Validation: 105 Bun tests and TypeScript/production build pass. Six new tests cover original table bytes, all terrain boundaries, ownership and obstructions, map borders, constructor bytes, saturation and all-eight-scenario placement scans. The existing browser flow is unchanged; no new-field UI is claimed yet.

The scan changed the next action: none of the supplied farms contains another eligible owned 8×8 plot, even with automatic clearing. Recover land purchase/clearing and then connect map placement to the planting command so the feature is usable on original farms. The requested speed slider remains complete; save/load and the other full-game requirements remain active.

## 2026-10-07 — land purchase and original perimeter fences

Recovered purchase valuation, ownership/cash/expense posting and the original fence connector. Kept unknown ownership codes unavailable and preserved source terrain flags, gate orientation and neighboring fence updates. Updated SF-014 with the now-implemented land and worker ledger behavior; its duplicate load remains preserved pending save/load reconstruction.

Validation: all 111 Bun tests and TypeScript/production build pass. Six new tests cover exact EXE data, every fence connection mask, gates, corner regions, ownership adjacency, signed price inputs, cash/ledger boundaries and atomic rejection. All eight unmodified farms can afford a plot and create a field with automatic clearing; these are simulation checks, not yet browser commands. Next connect land purchase, clearing and new-field planting to GameSimulation and React.

New-field integration exposed an edge-field failure in weekly water refresh. Recorded the original unchecked border reads as SF-029 and bounded native probes to real map neighbors; all four corners and both water categories have a regression. This fixes the native exception before exposing edge placement in the browser. Command/UI integration is still in progress.

## 2026-10-07 — new-field planting commands

GameSimulation now handles land purchase, the saved automatic-clearing setting and creating/planting fields. The recovered map-click path retains initial regional pest levels, unlike existing-field replanting. Extended SF-018 with the original new-field failure evidence and made insufficient seed/funds atomic before construction. All eight unmodified original farms now buy land, plant a new edge field and finish machinery work in command tests.

Validation: all 114 Bun tests and TypeScript/production build pass, including field-water edge guards. Existing and new browser checks are running against the React integration for the following commit. The full game objective remains active; this command increment does not complete save/load or the other original systems.

## 2026-10-07 — browser land purchase and new-field planting

Added React map tools for inspecting, buying land and placing fields, with an 8×8 canvas preview, source-derived quotes/fertility, the saved automatic-clearing control and crop selection. Successful purchases select their plot corner; successful creation selects the new field for existing work/harvest controls. Simulation still owns all mutations. Purchases and planting remain separate explicit actions.

Validation: all 114 Bun tests, TypeScript checking and production build pass. Ten existing Chromium checks passed; the new land/field check passed after correcting its assumption that poor unowned soil would produce a valuable corn harvest. The new browser flow buys original SCEN4 region (0,2), charges $18,060 plus $52 seed, plants field 9, advances machinery/weather, harvests, delivers to storage and sells the zero-value immature crop. It also checks blocked placement, the clearing requirement, scenario reset and a 390px viewport. Visually inspected `artifacts/browser-land-purchase.png` and `artifacts/browser-new-field.png`.

The first attempted new-field browser cycle ran 85 days and reached natural crop expiry; static-data inspection confirms eligible unowned SCEN4 plots have fertility at most 32/255. No fixture or rule change was used to manufacture profits. The existing positive-value original-field farming cycle remains verified. Next recover fertilizer/crop-care orders, then continue save/load and the remaining original systems. The speed slider requested by the user remains complete, all work stays local, and the overall preservation goal is still active.

## 2026-10-07 — chemical stock and supply consumption

The preceding goal turn made progress through committed land purchase, new-field commands/UI and map-edge water fixes. Revalidated the clean worktree, then recovered the separate chemical stock records, definitions, expense ledger and consumption routine. Native snapshots preserve every unknown chemical byte. Supply use removes stored chemicals first, then uses the original shared auto-buy setting and fixed $275 direct-purchase cost. SF-030 records the original unchecked removal result and native prevalidation.

Validation: all 119 Bun tests, TypeScript checking and production build pass. New tests compare all eight original tables, consume all 63 SCEN0 supplies, check building/outdoor removal, malformed binary/state boundaries and ledger wrapping. Browser behavior is unchanged in this primitive increment. Next implement treatment orders and the tractor/sprayer FSM, expose React controls, then verify fertilization of newly purchased fields. Save/load and remaining original systems still require reconstruction.

## 2026-10-07 — treatment orders and tractor/sprayer work

Recovered guarded immediate treatment orders and all four original treatment FSMs. Commands consume one supply, preserve prior work state, make a tractor/sprayer pass without repainting crops, apply nutrient or spray effects, and return equipment. Preserved toxicity increases, regional arithmetic, pressure reduction, timer behavior and pre-effect status ordering. GameSimulation owns these jobs and detached chemical snapshots.

Validation: all 125 Bun tests, TypeScript/production build and 13 Chromium checks pass against the pending React controls. Tests exercise four treatments across all eight farms, supply/rental costs, state restoration, full returns, no crop repaint/age reset, saturation, unsigned tick rollover, blocked orders, no repeated payment and deterministic frame partitioning. An unmodified SCEN4 newly purchased plot now yields corn worth $1,451 after one fertilizer application; selling reaches $23,064 after land, seed and fertilizer expenses. The next commit exposes/document these controls; save/load and other major systems remain unfinished.

## 2026-10-07 — browser field care and valuable new-field harvest

Added Field care controls for fertilizer, pesticide, herbicide and fungicide, with stock/cost information, machinery progress, result feedback and pest/toxicity readings. React sends commands; no simulation ownership moved into UI. Busy fields disable conflicting work. README now explains early fertilization and spray toxicity, and the plan moves next to deterministic save/load while retaining the full original-game scope.

Validation: 125 Bun tests, TypeScript/production build and all 13 Chromium checks passed. New browser cases apply all four treatments using original SCEN0 stock, verify stock/cash changes and return to Growing, and complete the valuable SCEN4 new-land corn cycle using only actual player controls. Scenario reset and a 390px viewport are covered. Visually inspected `artifacts/browser-fertilizer.png`. Original EXE bytes remain unchanged, and all commits remain local. Save/load, full finances/construction/livestock/disasters/scheduled orders and other original systems are not yet complete.

## 2026-10-07 — deterministic native checkpoints

The preceding goal turn only confirmed the already-committed speed slider, so it made no implementation progress. Revalidated the clean tree and resumed the next planned task: native save/load. A versioned JSON checkpoint now preserves full source SSM bytes, all mutable record bytes, map/regions/climate, farm ledgers, three RNG streams, weather, prices, fractional ticks, partial days, speed/pause, disaster flags and equipment wear/animation clocks. Restoration bypasses DOS startup repricing/weather initialization. Unknown source bytes and contradictory original counts remain intact in the retained template.

Native checkpoints deliberately differ from DOS saves; no original saver/export compatibility is claimed. Existing loader validation is reused on a temporary image, with a separate bounded allowance for in-flight border machinery. Transient UI command results and historical sound/notice events are not persisted. Browser file controls follow after the standalone codec/continuation gate.

Validation: all 131 Bun tests, TypeScript checking and production build pass. Six checkpoint tests exercise all eight farms, both harvest paths, all treatments, byte isolation, fractional clocks, tick/year rollovers, corrupt boundaries/references and asset mismatch rejection. Repeated reloads throughout the original SCEN4 new-field cycle retain the $1,451 harvest and $23,064 final cash. Browser behavior is unchanged by this codec increment; file controls and browser checks are next.

## 2026-10-07 — browser save/load controls

Committed the checkpoint engine as `c7c5802`, then added React Save farm/Load farm controls. Files download locally and can restore a farm after a fresh page load. The file, crop definitions, original template and scenario atlas are validated before replacing the current simulation. Corrupt/oversized files, unavailable assets and cancelled loads leave the current farm intact. A new session resets subscriptions, frame timing and UI selection while restoring the saved run/pause/speed state; offline time does not advance the game.

Three new Chromium checks pass: save an original newly purchased field with fertilizer work pending, reload the page, resume and finish the $1,451 crop/$23,064 cash cycle; round-trip a running 4× farm with partial ticks exactly; and reject failed/cancelled loads without replacing current work. The same file can be selected repeatedly. Inspected `artifacts/browser-load.png`; controls fit the 390px viewport. The full browser regression gate follows. Native saves are not DOS-compatible exports; unknown source bytes are retained and source files remain untouched. Next trace original calendar-scheduled orders; the broader full-game requirements remain active.

Final gate: all 16 Chromium checks, TypeScript checking and production build pass. The checkpoint gate passed all 131 Bun tests; subsequent changes only add file UI, layout, browser coverage and documentation. All work is committed locally, with no push. This completes native checkpoint/file controls for the currently reconstructed simulation, not the full original game.

## 2026-10-07 — harvest delivery checkpoint correction

The preceding goal turn made progress through committed native checkpoints and browser file controls. Revalidated that tree, then source review for scheduled work exposed a checkpoint validator error: harvest truck word +44 contains a building index, not an equipment parent. Reproduced rejection on unmodified SCEN1 at logical tick 770 of a worker harvest (truck 1, building 12, inactive equipment 12). Native decoding now checks that index against buildings while retaining equipment link/cycle checks for actual attachments. This is a native validation defect, not an original-game defect.

Validation: all 132 Bun tests pass, including a checkpoint during delivery and another while returning home, plus malformed-building rejection. The new browser case loads the delivery checkpoint and completes storage; its first run correctly reached Waiting for the annual crop, requiring correction of an erroneous Growing test expectation. Type checking/production build and the corrected browser check pass. Existing 16 browser checks passed at the preceding commit; the next full gate will include this seventeenth case. Calendar reconstruction continues next.

## 2026-10-07 — original field schedule format and checkpoint preservation

Recovered the original 240-week × 98-column schedule at SSM `0x9b04`, including the runtime `schedual.his` file layout, field-slot-minus-one addressing, crop-stage graphics and order codes. Added bounded get/set/column access while preserving every unknown word and the otherwise unused final column. GameSimulation owns detached schedule copies; native save version 2 includes the mutable schedule, and version-1 files migrate from their retained original template. Added tighter position validation for a moving harvest truck whose +44 is a building reference.

Source tracing changes the integration plan: weekly `0x2f66a` first runs forced completion `0x2e93a`, including machinery/harvest/treatment cleanup, and year rollover shifts four future years then regenerates the fifth. Neither can be replaced by simply invoking immediate commands once a week. Recorded addresses, source examples, jump targets and remaining work in `docs/field-calendar.md`. SF-031 documents unchecked crop divisors in original schedule projection; its native guard is deferred until projection is ported. No schedule editor or automatic execution is claimed in this format increment.

Validation so far: all 136 Bun tests pass, including every original schedule word, executable stride/count/base constants, unknown-word and boundary preservation, checkpoint isolation and legacy migration. Type checking and production build pass. The full seventeen-case Chromium suite and targeted delivery/checkpoint regressions are completing before commit. Next implement forced completion and original dispatcher/year-rollover rules, then expose the editable planner. The full-game objective remains active.

Final gate: all 136 Bun tests, TypeScript/production build and 17 Chromium checks pass. After the full browser gate, a targeted checkpoint test rejected a valid edge-field return transition under an over-strict moving-head bound; narrowed that guard to preserve existing field-work border semantics while distinguishing truck building references from actual attachments. Re-ran all 136 unit tests, build, and the browser legacy-save/truck-delivery cases successfully. Commits remain local and original distribution bytes remain untouched.

## 2026-10-07 — weekly field work completion

The preceding goal turn made progress through committed harvest-checkpoint repair and original schedule storage. Revalidated the clean tree and traced the full weekly completion routine. Added source-derived immediate completion of planting, harvest and all treatments, including machine home/parking/rental cleanup, crop/terrain updates, contracts, storage and sale fallback. Corrected the earlier history hypothesis: the original routine does not write schedule history or read its previous-week argument.

SF-032 documents preserved completion despite unpaid supplies/workers. SF-033 and SF-034 retain original omitted-header/worker-sale defects and their native cleanup corrections. Tests sample actual machinery phases rather than advancing a surrogate loop to fake completion. The primitive remains separate from GameSimulation until the remaining scheduled work paths and year rollover are reconstructed; automatic schedules are not yet advertised.

Validation: the full 141-test Bun suite, TypeScript checking and production build pass; the added terrain/badge-boundary regression then passed with all six targeted weekly tests (142 tests total). Existing 17 browser checks cover the unchanged browser path; the new standalone routine is not yet wired to that path. The all-farm harvest test's initial expected phase count was corrected to account for the shorter worker/contract paths. Remaining work continues with original order dispatch and year projection, not a generic substitute scheduler.

## 2026-10-07 — original weekly schedule dispatcher

Committed weekly work completion as `e3c128f`, then reconstructed the order dispatcher using actual schedule words. It force-completes prior work except in January week zero; scans active field slots; issues planting, standard/alternate harvesting, contract and treatment orders; and distinguishes graphic/unknown markers from fallow operations. Seed acquisition failure retains the original scan exit while applying the existing SF-018 field-preservation correction. Supplies are charged by treatment step zero, not by the calendar order.

Static jump-table evidence removed an assumed missing implementation: scheduled Plowing state 2 is also inert in the original work loop. Native code preserves that behavior; SF-035 records the evidence and unresolved original editor reachability. Tests cover all eight original schedules and the dispatcher branches. Remaining work is year-plan projection and plan editing before automatic clock/UI integration; no annual-repeat scaffold or automatic-scheduling claim was added.

Validation: all 149 Bun tests, TypeScript checking and production build pass. Focused Chromium checks confirm manual planting and a saved new-field farming cycle still work through the shared planting code. The preceding full 17-case browser suite remains the baseline; there are no new planner controls to exercise yet. Source bytes remain untouched, and both increments are committed locally without a push. Next recover year-plan projection and original edits, then wire automatic schedules into the existing native game loop.

## 2026-10-07 — original year-plan projection

The preceding goal turn only confirmed the already-committed speed slider and made no implementation progress. Revalidated the worktree and completed the year-rollover trace at `0x48d08..0x491ce`. Native projection now shifts the four retained years and extends each active field from its last matching planting/harvest marker, including future crop changes, perennial restart stages and original word arithmetic. It preserves source/field bytes and commits schedule changes only after validation.

Updated SF-031 with its native divisor guard; SF-036–038 document unbounded marker searches, pattern/local stack overlap and unchecked signed restart indices. Supplied crops avoid malformed-definition failures. Unknown inactive tails are retained deterministically because their DOS shared-buffer contents are not initialized here. Missing-marker fields retain their shifted plan and new fallow tail, with an explicit diagnostic rather than an invented crop sequence.

Validation: all 156 Bun tests, TypeScript checking and production build pass. The focused Chromium speed-control check passes; the full prior 17-case suite remains the browser baseline because projection is not yet connected to the clock. Seven new tests cover all eight supplied plans, exact executable constants, corn/grape/rotated-apple sequences, repeated rollover, transactional boundaries and preservation. A zero-duration test expectation was corrected to retain history before the last matching marker. Original files remain untouched. Next recover plan editing and immediate-order callers before automatic calendar/UI integration; the full-game objective is still active.

## 2026-10-07 — manual orders update original field plans

Committed year projection as `c330c6a`, then traced the complete manual-order recorder and all seven map/toolbar callers. Added original planting-plan generation, occupied-word guards for treatments, fixed annual harvest weeks for perennials, signed-byte stage offsets and full-column writes. Manual planting/new-field/treatment commands now update the simulation-owned plan after success; native checkpoints retain these edits. Failed commands preserve the prior plan. This is the manual recorder, not a substitute for the still-unreconstructed full calendar editor.

Updated SF-031/037/038 with the analogous manual-generator hazards and guards. Toolbar tracing resolved SF-035's reachability question: original Plow writes the inert state/order on a Waiting field. No invented plowing machinery or native plow button was added. Source rules reset earlier weeks to fallow when planting and differ from year projection for fixed-harvest perennials; both differences are preserved and documented.

Validation: all 163 Bun tests, TypeScript checking, production build and all 17 Chromium checks pass. Seven new unit tests cover source bytes, original planting sequences, four perennial fixed-harvest weeks, protected-code boundaries, signed arithmetic, atomic validation, all-eight-farm commands/checkpoints and actual new-field creation. The browser new-field checkpoint now verifies its planting/fertilizer/harvest plan words before saving and exact plan preservation after reload, then completes the valuable harvest/sale cycle. Next connect original weekly/year scheduling to the clock, trace the complete editor and add planning controls. Major original systems remain incomplete; the full preservation objective remains active and commits remain local.

## 2026-10-07 — automatic original field schedules

The preceding goal turn made progress through committed year projection and manual plan recording (`c330c6a`, `0006adb`). Revalidated that tree and traced the complete calendar caller. This corrected an important ordering assumption: `0xcbbd` dispatches after incrementing the week but before month normalization, including old-plan row 48 at year-end. GameSimulation now completes weekly work, executes saved orders and projects years in that order. Year projection sees the new crop selected by the year-boundary order. Normalized public snapshots/checkpoints remain intact.

Added React status for automatic plans and weekly seed failures. Manual/new-field/treatment orders continue to update their plans; no automatic-mode bypass was introduced. Original farms now harvest/store/replant without manual commands. Existing tests were updated for other fields' automatic harvests and repricing, rather than suppressing those plans: the fertilized new-field day-84 estimate remains $1,451, while its identified lot sells for $395 on day 85 after original neighboring fields replant. The resulting $21,800 cash excludes the four other stored harvests. Full manual/new-field cycles and deterministic saves still pass.

Validation: the full 168-test Bun gate passed, followed by the added perennial-to-annual year-boundary regression (six integration tests pass; 169 tests total). Type checking and production build pass. Sixteen existing Chromium cases passed initially; the worker-harvest expectation was corrected to include six automatically harvested almond fields, then that case and two new automatic-plan/failure-status cases passed (19 browser checks total). Inspected `artifacts/browser-automatic-plans.png`; existing 390px checks passed. Machinery-phase unit fixtures now begin on day zero to sample each actual phase before automatic completion, with no production scheduling override. No original defect entry was removed; SF-032 and calendar docs now reflect the verified year-end ordering.

Next trace the full calendar editor around `0x2e56a` and expose its original operations in React. Full finances, construction, livestock, disasters, town and other unreconstructed systems still remain; the overall preservation objective is active. Original DOS assets remain unchanged and commits stay local.

## 2026-10-07 — original calendar edit operations

The preceding turn made progress by committing automatic schedules as `351de8c`. Revalidated that tree and traced the calendar editor, erase helper, action table and mouse caller. Added future planting with earlier-week preservation, whole-suffix clearing, guarded treatment edits, harvest movement/trimming and current-week price contracts. Shared the equivalent manual/editor crop-pattern generator while retaining their different write ranges and the separate year projector.

SF-039 records and corrects the original harvest editor's exclusion of crop slot 15 from its next-planting stop condition. SF-040 retains the unexplained 239 marker with no invented dispatcher behavior; unrelated unknown/no-op editor actions remain unexposed. Eight new tests cover original bytes and binary boundaries, all eight farms, all sixteen crop slots, contract accounting, protected words and atomic failures. An initial test assumption that crop slot 15 was peanuts on every farm was corrected to read each farm's actual definition.

The standalone editor is ready for GameSimulation/React integration. Full tests/build are being gated before this incremental commit; browser controls follow separately. The full original-game objective remains active.

Editor primitive gate: all 177 Bun tests, type checking and production build pass. The browser path still uses the same manual generator output, covered by the prior 19 browser checks; the new editor primitive has not yet been exposed. Next add its simulation command and React controls, then run the complete browser gate.

## 2026-10-07 — alternate-harvest decoder correction

Cross-checking the editor's 239 write against the dispatcher exposed a native transcription error: the dispatcher subtracts 198, 11 and 30 cumulatively, yielding 239, not the previously recorded 231. Corrected the decoder and tests; retained 231 as unknown without rewriting save bytes. SF-040's original-defect claim is withdrawn and retained as audit history, with the exact subtraction/store evidence. No original mismatch exists. The editor's alternate action label/output semantics still need interpretation before it is exposed as a named browser operation.

The 19 affected schedule/editor tests and TypeScript/build pass; the complete 177-test gate is rerunning before commit. Planner UI integration follows this correction.

Correction gate: all 177 Bun tests pass. The correction is committed separately from the pending planner controls so the evidence repair remains reviewable.

## 2026-10-07 — editable browser crop planner

Finished the pending GameSimulation/React integration before proceeding to another system. Selecting a field now exposes an expandable five-year crop planner below its immediate field controls. Players can schedule planting and four treatments, move eligible harvests, clear the remaining plan and lock a current growing crop’s price. Simulation commands enforce the recovered rules, preserve protected/unknown entries and report rejected edits. Native saves retain plans; UI selections and result messages remain transient. README now explains where to open the controls.

Validation: all 179 Bun tests, all 21 Chromium checks, TypeScript checking and production build pass. New integration/browser cases cover edited-order execution, save/reload, rejection without mutation, snapshot isolation, year-five boundary, contracts, fixed harvest restrictions and clearing. Inspected `artifacts/browser-field-planner.png` at a 390px viewport. The requested speed slider was already committed as `1c24375`; this full browser run reverified 0.25×–16× pacing, paused changes, one-day stepping and scenario reset. No duplicate slider implementation is needed.

This completes the verified core planner controls, not the full original game or every original editor action. Alternate action labeling, raw 856/868 and helper `0x2e80e` remain documented gaps. Next trace original monthly finances and recurring expenses. Original distribution files remain untouched, commits stay local, and the full preservation goal remains active.

## 2026-10-07 — original annual tax assessment

The preceding goal turn made progress by completing and committing the five-year planner as `bbadf87`. Revalidated the clean worktree and traced the monthly financial branches, annual collection/reset, signed long-division helper and owned-land summation. Reconstructed the actual assessment: cash-based sales divisors 10/5/3, owned-land valuation divided by 99, and unpaid tax balance. This is a standalone simulation primitive; collection remains separate because its original path allocates receipts to town growth and has forced-sale/default dependencies. The provisional upkeep formula in `../simfarm2` is not used.

Documented source addresses, loader offsets, dependency ordering and unresolved ledgers in `docs/finances.md`. Added retained defect entries SF-041 (report omits worker/chemical expenses), SF-042 (year reset skips worker expenses), and SF-043 (signed sales boundary in tax). Report/reset fixes are deferred; native assessment preserves the verified signed arithmetic. Initial tests exposed JavaScript negative zero, now normalized to integer zero, and an incorrect fixture assumption that soil moisture belongs to saved climate tables, corrected to the existing runtime startup value.

Validation: all 184 Bun tests, TypeScript checking and production build pass. Five new tests cover executable bytes, unsigned cash thresholds, signed division/overflow, all ownership codes/map edges, all eight original farms and mutation/input boundaries. Two focused Chromium regressions pass for automatic schedules and deterministic save/load; the prior full 21-case planner browser suite remains the UI baseline because this primitive adds no controls or clock effects. Next reconstruct town allocation/development and forced-sale/default paths before integrating annual payment and native finance state. Original DOS files remain untouched, no push is made, and the overall game goal remains active.

## 2026-10-07 — annual settlement and town expansion prerequisites

The preceding goal turn made progress through committed tax assessment `f38b1fe`. Revalidated the clean tree and traced the tax collector's town dependencies and the complete forced-sale control flow. Added annual settlement with source cash/ledger posting, sales reset, unpaid debt arithmetic, byte countdown/failure behavior, town maintenance and reserve allocation. Added town region/level counting, original expanding-square site selection and paid ownership reservation before the district choice. These remain standalone simulation primitives until the choice/construction and default paths can execute fully and survive native saves.

Source debug text corrected the previous loose “town population” description: `7512` sums residential levels, and the actual funding threshold is the low word of level × 200. Inspected original imported `twnchoic.bmp.png`: Residential, Commercial, Airport and Recreational map to the traced constructor variants. The original requests a player choice; no automatic generic district has been substituted. `docs/finances.md` now records those dependencies and the forced-sale order (crops, livestock, non-rented equipment, land, then terminal choice). Added SF-044–046 for zero-tax failure, maintenance word truncation and default-payment ledger mismatch, retaining confidence/reachability and deferred-fix status.

Validation: all 192 Bun tests, TypeScript checking and production build pass. Added eight tax/town tests, plus settlement source-byte checks, for all supplied farm metadata, funding branches, exact thresholds, signed/word/byte arithmetic, preserved debt/countdown, atomic invalid-input rejection, scan order, map edges, flags and reservation isolation. The targeted tax suite passes after adding the source assertions. Save/load and automatic-schedule Chromium regressions pass; the prior full 21-case UI suite remains the baseline because no live clock or UI change is made yet. Next reconstruct district construction/choice resolution and the default dependencies, then checkpoint the new state and connect finance ordering. Original files remain unchanged, commits are local, and the full-game goal remains active.

## 2026-10-07 — original district construction and choice resolution

The preceding turn made progress by committing annual settlement and expansion funding as `b8afef9`. Revalidated the clean tree, traced district constructor `0x3aba0`, road mask/category helpers and the layout loader, and decoded original `townly0.cmp` into fifteen bounded 8×8 patterns. Added detached saved recreation coordinates/count and airport count, original construction/metadata effects, mixed-road connections and choice-specific RNG resolution. Non-airport districts start with roads/grass and gain buildings through a separate growth routine; no fully developed template stamp was substituted.

Documented exact addresses, archive hash, saved offsets and restrictions in `docs/town.md`. SF-047–049 retain the signed recreation-index hazard, ignored timeout-construction failure and invalid-type/uninitialized-offset hazard with native bounds/failure handling and reachability limits. Native choice resolution retains failed reservations for future UI integration. Generated and inspected `artifacts/town-construction.png`, reproducing all fifteen initial layouts through the imported atlas; assets remain ignored.

Validation: all 198 Bun tests, TypeScript checking and production build pass. Six new tests cover source bytes, complete layout words/bounds, all-eight-farm saved values, all connection masks/bridges/map edges, all 120 farm/layout combinations, retained terrain/overlay/record bytes, recreation thresholds, airport wrapping and both original RNG streams. Chromium land purchase/new-field farming and deterministic save/load regressions pass. The user asked how to open land purchase; confirmed Map tool → Buy land, select an unowned plot, then Buy plot in the side panel (below the map on narrow screens).

District primitives are ready for integration, but live clock/React choice controls and checkpoint fields remain pending with town growth/decline and full default behavior. Next reconstruct those dependencies before enabling annual events. Original files remain unchanged, commits remain local, and the full-game goal remains active.

## 2026-10-07 — original town growth, decline and demolition

The preceding goal work made progress through committed district construction `a483589`; the intervening user question only clarified existing land controls. Revalidated the clean worktree and traced both repaint dispatch tables, all thirteen development levels, the financial tick, demolition and its retarget search. Added standalone town development with original visual-RNG building variants, dirt/paved stages, signed revenue thresholds, word spending wrap, level limits, retained metadata and tree/terrain/overlay restoration. The call at `0xcbb3` is verified to run on the weekly calendar branch before monthly/annual finance; no guessed daily growth hook was added.

Updated `docs/town.md` with source addresses, stage table, ordering, state requirements and limitations. Retained new SF-050–054 entries for the whole-byte airport guard, stale demolition counters/coordinates, next-site bounds and origin-axis exclusion, malformed template anchors and the commercial anchor-280 partial repaint. Native bounds are guarded; other verified quirks remain explicit. An initial test's assumption that every randomized four-cell building survives was contradicted by type 3's actual template and source skip ranges; corrected the expectation and documented the evidence. Generated and inspected `artifacts/town-development.png` for all fifteen types through levels 0–13 using original imported tiles.

Validation: all 204 Bun tests pass, TypeScript checking/production build pass, and Chromium land purchase/new-field farming plus deterministic running-speed/save-load regressions pass. Six added tests cover executable tables/constants/caller, all type/level branches, every ordinary early-stage RNG draw and cell orientation, all-eight-farm map corners, revenue and counter boundaries, source/unknown-byte preservation, demolition search/protection, and malformed-input atomicity. Generated assets remain ignored and original DOS files untouched.

Town development is now reconstructed as a tested primitive, but live GameSimulation/checkpoint/React choice integration and complete monthly/annual finances still remain. Next recover the remaining forced-sale/default dependencies, then integrate those systems in source order with pending decisions preserved in saves. The full native-game objective remains active; commits stay local with no push.

## 2026-10-07 — livestock and equipment sale prerequisites

The preceding goal turn made progress with town development commit `53d5802`. Revalidated the worktree and traced generic sale `0x4c41c`, animal/equipment quotes, credit categories, map/storage removal, definition counts, book-value subtraction and aircraft-home cleanup. Added detached animal definitions/sale ledgers and complete livestock/equipment sale primitives, retaining source word/dword arithmetic and unknown record bytes. All active animals and machines in the eight supplied farms are covered. These remain standalone until finance/checkpoint/default integration.

Documented loader offsets, arithmetic, eligibility and removal evidence in `docs/finances.md`. SF-055–059 retain signed sale proceeds, invalid animal-type indexing, attachment-deletion limitations, rental-sale behavior and the unsafe default scan counters; SF-027 now also records native prevalidation for animal/equipment sales. The fifth loaded animal definition repeats type 163 and remains unchanged. Animal word +10 contributes to value, but its lifecycle meaning remains unnamed.

All 211 Bun tests and TypeScript/production build pass. Seven new tests cover exact executable bytes, all-eight-farm source records and sales, every condition byte, valuation/ledger boundaries, stored/outdoor removal, unknown-byte retention, busy/rental eligibility, aircraft home flags and atomic invalid-state rejection. Browser save/load passed, but land/new-field checks encountered dev-server HMR while interacting with the auto-clear checkbox. A clean-source browser rerun remains pending: websocket and Vite debug logs show updates propagated from `src/formats/animal.ts` and `equipment.ts`, resetting the page to Scenario 1. No test assertion was weakened.

Next finish land sale and field teardown, bounded forced-sale traversal and terminal choice, then integrate finance/town state and original calendar ordering with native checkpoints. Original files remain untouched, all tool/artifact paths stay local and ignored, and the full goal remains active.

### Sale follow-up validation

Committed the implementation as `9bbeb77`, then reran both targeted Chromium checks from the clean source tree: land purchase/new-field planting–harvest–sale and running-speed/partial-tick save/load both pass (6.4 seconds). The HMR-induced reset disappears with the edited imported modules committed; no product or test behavior was changed to obtain the pass. The original app server was left running; the separate diagnostic server is being stopped. All 211 unit tests and the type/build checks remain green. Full finances/default and the overall preservation goal are still incomplete.

## 2026-10-07 — original field teardown and clearing effects

The preceding goal work made progress through livestock/equipment sales; the intervening user questions clarified existing land controls. Revalidated pending source edits and the prior test process, then completed field cleanup/deactivation, its 64-slot clearing animation and rented-aircraft release cleanup. These are the field-removal prerequisites for financial default; building/content demolition and neighboring fence repair still block complete land sale. No calendar/default behavior has been enabled prematurely.

Documented executable addresses, queue state, exact terrain masks, timing and preserved field/plan bytes in `docs/finances.md`. SF-060–063 retain the initialized-coordinate uncertainty, unbounded animation scan, corner-only field-selection defect and rental-chain link cleanup omission. Native code uses an empty-slot sentinel, bounded scan, strict rectangle overlap and repaired released links, with those deviations explicit. Original distribution and source bytes remain untouched.

Validation: all 219 Bun tests pass, including eight new source/boundary/all-eight-farm tests; TypeScript checking and production build pass. The pending prior test process also completed successfully (15 field/sale checks plus build). Chromium regression verification will run after this implementation commit from a clean source tree, following the previously observed Vite HMR resets during uncommitted-source checks. The full 21-case planner suite remains the UI baseline; no new controls are introduced here.

Next finish land-sale dependencies, bounded forced-sale traversal and terminal choice, then integrate finance/town state, pending decisions and clearing effects into live clock/checkpoints. The overall native-game goal remains active and incomplete. Commits remain local, with no push.

### Field-removal browser verification and neighboring fence recovery

Committed field teardown as `7a7df9d`, then verified both targeted Chromium flows from clean source: land purchase/new-field planting–harvest–sale and running-speed/partial-tick save/load pass (6.3 seconds). The full goal remains active.

Continued the land-sale trace through all four bordering fence scans and implemented the original ownership bounds, scan order, asymmetric corner extensions and grass-only eligibility, reusing the verified fence connector. Added three tests covering source instructions/constants, all ownership masks and boundary positions, every candidate tile graphic and metadata preservation. Corrected an initial test's category-length address using its actual initialized ES segment; the implementation's grass range was already correct.

Further building-demolition research established that content deletion differs from sale removal, and that the building ledger cannot be assigned a guessed sequential save offset. Exact addresses and unresolved initialization/special inventory definitions are recorded in `docs/finances.md`. TypeScript checking and production build pass. Full unit and clean-source browser gates for the fence increment follow before final validation. Building/content demolition, full default and finance/checkpoint integration remain the next work; no complete-port claim is made.

Fence increment gate: all 222 Bun tests pass (37 files, 41.6 seconds), including all three new cases. Type checking/build and diff checks pass. Clean-source Chromium checks remain the post-commit gate. SF-055 now retains the additional signed building-price subtraction evidence for the upcoming demolition implementation.

Committed neighboring fence repair as `480603d`. Both clean-source Chromium regressions pass (6.3 seconds): land/new-field farming and running-speed/partial-tick native save/load. Together with all 222 unit tests and type/build checks, this closes the increment's validation. No server was restarted and no push was made. Remaining work starts with building/content demolition and its ledger initialization, then complete land sale/default and live financial integration.

## 2026-10-07 — original building and stored-content demolition

The preceding goal turn made progress through committed field removal and neighboring fence repair (`7a7df9d`, `480603d`). Revalidated the clean tree and traced demolition's generic deletion dependencies, including additional goods types 299/300 and stored-animal cleanup. Implemented complete building cleanup/deactivation for the recovered content categories, detached decoding of the 17 additional definitions, source count/book-value changes, no sale proceeds, plane-home cleanup and clearing effects. All buildings from all eight unmodified original farms are covered.

Native demolition validates counts and references before mutation (SF-064); signed building-price subtraction remains source-faithful (SF-055). Preserved inactive records and unknown bytes rather than clearing whole objects. Building book-value initialization is still unresolved: explicit state avoids guessing a save offset, and SF-065 retains the suspected persistence gap with limited confidence. Source-backed details and remaining generic-category/delivery integration limits are in `docs/finances.md`.

Six new tests cover executable instructions and loader constants, original tables/buildings, mixed stored assets, duplicate footprints, signed/wrapped accounting, rentals, aircraft homes, count-only goods and atomic rejection. TypeScript checking and production build pass; full-suite and clean-source browser results are recorded below. These remain simulation primitives until land-sale/default and financial/checkpoint integration. Original DOS files remain untouched, no push is made and the full-game objective remains active.

Demolition pre-commit gate: all 228 Bun tests pass (38 files, 43.0 seconds), TypeScript/build pass, and diff checks are clean. Browser regressions will run from committed source to avoid the previously observed Vite HMR interference.

### Demolition validation and complete land-sale composition

Committed building/content demolition as `b064bd2`, then both clean-source Chromium regressions passed (6.3 seconds): land purchase/new-field farming and deterministic running-speed/save-load. Continued directly with the original land-sale transaction, including unsigned quote/cash posting, conditional sales accumulation, land income, ownership release, source-ordered full building demolition, tree/terrain/overlay handling and neighboring fences. Fields remain a separate caller operation, as the executable requires.

Added synchronous whole-transaction demolition preparation so aggregate count/reference failures reject before proceeds or map mutations. Added thirteen tests covering every owned plot in all eight original farms, exact source instructions and loader offsets, accounting boundaries, source/unknown-byte retention, tree range, caller-composed field removal, crossing buildings and atomic rejection. The initial combined all-farms case exceeded Bun's five-second limit; split it by farm with every assertion retained. All thirteen targeted cases now pass, as do type checking and production build. SF-066 records the original overwritten-animation queue entries and deferred normalization; the existing bounded native scan prevents unbounded access.

Full regression and clean-source browser gates follow. Next bounded default traversal/terminal decisions and live financial/checkpoint integration, including protected-home and building-ledger lifecycle evidence. No player land-sale controls or automatic financial events are claimed yet; the overall goal remains active and the original distribution remains unchanged.

Land-sale pre-commit gate: all 241 Bun tests pass (39 files, 56.2 seconds), TypeScript/build and diff checks pass. While that specific process ran, traced default's protected-home pair to SSM `0x216e0/0x216e2` via exact loader/segment references; the source test now pins all eight owned-home pairs and exclusion comparisons and passes after that addition. No full-suite rerun is needed for this evidence-only assertion addition. Clean-source browser verification follows the implementation commit.

Committed land sales as `13a0d7c`; both clean-source Chromium regressions pass (6.3 seconds): original land purchase/new-field planting–harvest–sale and running-speed/partial-tick native save/load. This closes the demolition/land-sale increments' gates alongside all 241 unit tests and type/build checks. The existing app server remains running, Git remains writable, and no push was made. Next implement bounded forced-sale/default using the verified home pair and asset primitives, then pending decisions and full finance/checkpoint integration. The original game reconstruction remains incomplete.

## 2026-10-07 — bounded original forced-sale sequence

The preceding goal turn made progress through building demolition and full land-sale commits (`b064bd2`, `13a0d7c`). Revalidated the clean tree and traced default, debit categories, its initial notice branch, terminal dialog and main-loop exit/restart flags. Implemented the full bounded asset sequence, repeated field teardown before land sale, protected-home decoding, source payment/ledger behavior, ordered results and a single-use pending terminal decision. This remains a standalone financial operation until calendar/checkpoint/UI integration.

SF-059's scan bounds are now corrected; SF-046's swapped crop categories and later equipment-expense posting are preserved. Added SF-067–069 for zero-amount liquidation, inaccurate homestead text and terminal-button/payment return conflation, retaining reachability limits and native/deferred handling. Building ledger startup is still unresolved (SF-065), so the loader requires that runtime value explicitly rather than assigning a guessed offset.

All sixteen new targeted tests pass and type checking/production build pass. Tests include unpayable liquidation of every supplied farm, every successful stage, home protection, original ledger/cash arithmetic, sparse final slots, busy/rented filtering, decisions, malformed inputs and source bytes. A sparse-slot fixture's out-of-map machine coordinate was corrected after the existing native guard rejected it. Full-suite and browser gates follow before final validation. The full native game remains the objective; commits stay local and original files are untouched.

Forced-sale pre-commit gate: all 257 Bun tests pass (40 files, 57.7 seconds), TypeScript/build and diff checks pass. Both targeted browser regressions will run from the committed source tree, retaining the established clean-source check procedure.

Committed bounded default as `45dd2ef`; both clean-source Chromium regressions pass (6.3 seconds): original land purchase/new-field farming and running-speed/partial-tick native save/load. Together with all 257 unit tests and type/build checks, this closes the increment's validation. Existing app server remains running; Git is writable and no push was made. Next monthly retry/countdown and annual report/reset, then live financial/town/default state, pending decisions and native checkpoint integration. The full preservation goal remains active and incomplete.

## 2026-10-07 — monthly debt retries and pending default

The preceding implementation turn made progress by adding monthly retry/countdown rules and eight tests; the intervening UI question required no code change. Revalidated the worktree and polled the existing test process (session 6990), which completed successfully: all 265 Bun tests pass (41 files, 57.3 seconds). Type checking/build passed with that implementation. Reviewed the source and documented balance-before-tax order, notices, seasonal-warning branch exclusion, explicit runtime balance inputs, and newly traced overdue-balance origination.

Monthly retries now compose forced sales and stop on a pending unpaid default without mistaking a UI choice for payment (SF-069). They remain standalone: automatic charges, live financial/checkpoint state and React decisions are not connected yet. No flat upkeep or guessed interest is added. Annual report/reset is next, followed by lifecycle and live integration. Clean-source browser regressions follow this implementation commit. Original distribution remains untouched; commits remain local and the full goal remains incomplete.

Monthly retry commit `036124d` passes both clean-source Chromium regressions (6.3 seconds): original land/new-field farming and running-speed/partial-tick save/load. Git is writable and no push was made.

## 2026-10-07 — annual financial report and reset

Implemented the executable's report sums and exact annual reset sequence, reusing existing farm/default accounts. Added decoding for the remaining saved annual accounts and totals; unexplained runtime accounts stay explicit and address-named. Preserved report omissions SF-041 and worker-reset omission SF-042, tax carry, dword arithmetic and report-total retention. Reset synchronizes both native precipitation counters. No live calendar charges or finance UI are claimed yet.

Five targeted tests pass, including all source add/store instructions, all eight source farms, decoded boundaries, wrapped reports, omitted charges, reset retention and atomic validation. A manually calculated test expectation was corrected without changing the implementation. Type checking and production build pass; full-suite process and clean-source browser gates follow before final validation. Next resolve startup/load lifecycle and scheduled balance origination, then integrate financial/town/default state, decisions and native persistence. The full game remains incomplete and active.

Annual-ledger pre-commit gate: all 270 Bun tests pass (42 files), TypeScript/build and diff checks pass. Both browser regressions will run from committed source.

Committed annual reports/reset as `d139b65`; both clean-source Chromium regressions pass (6.3 seconds), alongside all 270 unit tests and type/build checks.

## 2026-10-07 — scheduled loan payments and origination

Recovered the full scheduled-payment routine and its month-boundary caller, normalized months 0/2/6/9 after retries and year-end processing. Borrow-confirmation and selection-bound code establish principal, available credit and installment roles; exact loader offsets now decode those accounts plus the preserved dialog selection. All eight supplied farms start them at zero, so additional sentinel tests guard offset mistakes.

Implemented full debit, bounded principal reduction, unsigned town shares, credit posting, zero-amount success, overdue overwrite/countdown and notice 166. Added retained SF-070–072 evidence for the final-payment credit omission, late-payment accounting divergence and overdue replacement/timing. These behaviors are preserved pending full lifecycle/impact analysis. No guessed interest calculation, borrowing UI or live charges were added.

All six new targeted tests pass, as do type checking and production build. Full-unit process and clean-source browser gates follow. Next financial startup/load lifecycle, original borrowing/credit calculations, then GameSimulation/React/checkpoint integration of finances/town/default. Original source is untouched; commits stay local and the complete game objective remains active.

Scheduled-loan pre-commit gate: all 276 Bun tests pass (43 files, 58.2 seconds), TypeScript/build and diff checks pass. Source traces for installment calculation, annual rate changes and asset/credit valuation are recorded as next-step evidence, without guessing their unverified semantics.

Committed scheduled loans as `8fe98d3`; both clean-source Chromium regressions pass (6.3 seconds): land/new-field farming and running-speed/partial-tick native save/load. This closes the monthly retry, annual ledger and scheduled-loan increments with all 276 unit tests and type/build checks green. Git remains writable, the existing app server remains running and no push was made. Next trace loan installment/credit and runtime financial initialization, then connect finance/town/default decisions and persistence to the live calendar. The full preservation objective remains active and incomplete.
