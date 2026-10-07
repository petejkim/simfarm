# Native SimFarm reconstruction

The end state is the original SimFarm running as native browser code, with MIDI music and replaceable graphics/audio/UI. A data viewer or invented farming simulation is an intermediate artifact, not completion.

1. Establish a reproducible TypeScript/React/Vite project using repository-local Bun and a source fingerprint. Decode archives, graphics, crop definitions, scenarios, and music with byte-level evidence and tests.
2. Map the 16-bit executable, overlays, data references, and key routines. Reconstruct world layout, initialization, action dispatch, and the simulation clock. Maintain an address-to-TypeScript evidence trail.
3. Connect a native world renderer and input to recovered land/field operations. Reach a complete plant → grow → harvest → store → sell loop using original rules as soon as evidence allows. Save/load deterministically.
4. Reconstruct weather, crop health, equipment, workers, buildings, finances, livestock, disasters, town growth, scenarios, and original UI functionality. Track gaps explicitly.
5. Convert original XMIDI sequences to standard MIDI and play them through a browser synthesizer or MIDI output. Verify timing/programs/controllers; no FM emulation.
6. Verify the full game against recovered code/data and original documented behavior, then expose enhancement interfaces. Do not mark the goal complete while major systems remain provisional.

Only local tools and original files are needed at runtime/build time; the delivered browser bundle must contain no DOS execution environment.

Current next action: reconstruct new-field placement. The requested native simulation-speed slider is implemented and verified. The existing-field plant/grow/harvest/store/sell cycle is now verified through browser controls on original corn; this does not complete the broader game or save/load requirements.
