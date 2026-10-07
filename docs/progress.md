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
