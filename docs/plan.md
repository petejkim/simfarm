# Native SimFarm reconstruction

The end state is the original SimFarm running as native browser code, with MIDI music and replaceable graphics/audio/UI. A data viewer or invented farming simulation is an intermediate artifact, not completion.

1. Establish a reproducible TypeScript/React/Vite project using repository-local Bun and a source fingerprint. Decode archives, graphics, crop definitions, scenarios, and music with byte-level evidence and tests.
2. Map the 16-bit executable, overlays, data references, and key routines. Reconstruct world layout, initialization, action dispatch, and the simulation clock. Maintain an address-to-TypeScript evidence trail.
3. Connect a native world renderer and input to recovered land/field operations. Reach a complete plant → grow → harvest → store → sell loop using original rules as soon as evidence allows. Save/load deterministically.
4. Reconstruct weather, crop health, equipment, workers, buildings, finances, livestock, disasters, town growth, scenarios, and original UI functionality. Track gaps explicitly.
5. Convert original XMIDI sequences to standard MIDI and play them through a browser synthesizer or MIDI output. Verify timing/programs/controllers; no FM emulation.
6. Verify the full game against recovered code/data and original documented behavior, then expose enhancement interfaces. Do not mark the goal complete while major systems remain provisional.

Only local tools and original files are needed at runtime/build time; the delivered browser bundle must contain no DOS execution environment.

Current next action: reconstruct livestock purchase, care/movement and trough behavior, then expose usable livestock controls. The player can now construct storage, pumps and wind-powered irrigation, dig connected ditches and road crossings, install valves, and open/close them. Water propagation and field refreshes are live. Original valve mouse dispatch and possible additional toggle effects remain a fidelity gap; explicit native controls use the verified open/closed flow states.

The original plant → grow → harvest → store → sell loop, land purchase/new-field creation, field treatments, five-year planner, machinery, speed slider and deterministic native save/load are usable and tested. Construction types64–71 are available. Native v9 persists complete irrigation source/wave state as well as canonical finances, annual statistics and homestead state. Land-sale demolition cleans irrigation sources (SF-093); manual/disaster deletion paths still need reconstruction.

Loans, scheduled payments, debt retries/default choices, annual taxes, town choices/growth, annual statistics, current farm reports, clearing animation, homestead upgrades, automatic MIDI requests and original cheers/boos are live. Remaining original report presentation/asset postings, original warm-load state, planner action16/raw856/868/helper0x2e80e, complete audio lifecycle, disasters, scenarios and other original systems remain documented gaps. No guessed monthly upkeep or DOS timing equivalence is claimed. See the subsystem documents and docs/progress.md for source evidence and checks; earlier milestones there remain historical records. Prioritize player blockers and usable gameplay breadth, tracing necessary dependencies without letting nonblocking report/presentation research delay livestock. Full preservation remains incomplete.
