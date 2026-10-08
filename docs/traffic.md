# Original road traffic

Movement, routing, removal and frame timing are recovered in `src/simulation/traffic.ts` and now run through `GameSimulation` for both generated and original farms. Native v17 owns traffic independently of setup provenance, preserving live records, count, clocks, map occupancy and RNG through save/load. Cars use the original masked sprites and livestock collision sample. Full original speed-menu, audio arbitration and warm-load fidelity remain unfinished.

## Evidence

Source: supplied `SIMFARM.EXE`, size `0x917b9`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets unless marked DS. Resident far addresses map as `segment*16 + offset + 0x2200`; initialized DS6190 data maps from file `0x846f0`. Confidence is high for the listed instructions/data and isolated behavior; full original runtime timing/presentation is not claimed.

| Evidence | Meaning |
| --- | --- |
| `0xd29c..0xd2bd` | Active-bit removal and count decrement |
| `0xd356..0xd619` | Drawn/hidden update, routing, collision, painting and coordinate writes |
| `0xd61a..0xd7f3` | Road routing, visual RNG, retry and destination gates |
| `0xd7f4..0xd857` | Sixteen-slot frame scan and unsigned elapsed time |
| `0x24b54` (`21c2:0d34`) | Cardinal neighbor mask from the supplied road table |
| `0xa254` (`0636:1cf4`) | Signed-word coordinate clamp to 0..95 |
| `0x865ca`, DS1eda | Sixteen mask population counts |
| `0x865da`, DS1eea | Cardinal bits `01 02 04 08` |
| `0x865e2`, DS1ef2 | Reverse bits `04 08 01 02` |
| `0x86964`, DS2274 | Eight signed-byte XY steps, N through NW |
| `0x89d86`, DS5696 | Paved, crossing and dirt neighbor groups, terminated by `ffff ffff` |

Record/default evidence and startup allocation/reset are in [new-farm.md](new-farm.md#startup-road-traffic-allocation). All sixteen eight-byte records retain byte1 and unknown flag bits. Count, delay and last-tick remain explicit rather than being derived from map sprites.

## Routing

The neighbor mask includes terrain images150..173, ignoring flags. When it contains more than one road, the reverse direction is excluded using the current reference heading. Every attempt consumes one visual RNG value, even with no neighbors. An odd value with a nonempty filtered mask consumes another value, chooses its low two bits and scans clockwise to an available cardinal direction. This resets both candidate and reference headings.

Otherwise the existing candidate is tried. Signed byte steps are added to coordinates, then clamped to0..95. The destination accepts paved150..160 and crossings172..173 unconditionally. Dirt161..171 additionally requires overlay ownership bit0800 clear. Terrain occupancy0800 is not a routing veto. Failed attempts rotate the candidate by two modulo eight; reaching the reference stops the search. Random reselection can change that reference, permitting five attempts and ten draws. Odd headings survive fallback unless a random branch replaces them. Clamping can leave a vehicle on its current tile. These behaviors are preserved without assigning an unverified design intent or calling them proven original defects.

## Occupancy, collision and painting

A drawn vehicle (flag2) first clears its origin's terrain0800 and low eleven overlay bits. The original does not check whether those bits still belong to that vehicle. Failure to route removes it: only active bit1 is cleared and count decremented; drawn/unknown flags, coordinates and payload remain. Hidden vehicles do not erase an origin.

On an occupied destination, a previously drawn vehicle calls the animal lookup `0x12860` and, for a nonzero eligible slot, collision helper `0x133c0..0x13599`. It then clears its drawn flag. A previously hidden vehicle does not hit livestock. Both advance coordinates and heading even while hidden. A free destination sets drawn/occupancy flags and paints `(oldOverlay & 0xf800) | (916 + variant*4 + (heading>>1))`. These are the original masked vehicle images68..83; the existing canvas renderer can consume the canonical map mutation. The original viewport-specific blits are not reproduced as DOS window operations.

The shared native machinery collision helper incorrectly cleared animal breeding eligibility bit2. Source `0x13572` is `26 80 8f 02 64 08`, an OR8 only. The helper now preserves bit2, sets collision bit8, records the animation tick at animal byte30 and retains original aftermath-image selection. This corrects a native implementation error, not an original-game defect. Animal lookup stays bounded. Both collision sound requests now reach the existing PCM path, as detailed below.

## Timing and integration boundaries

Unless delay equals1, elapsed unsigned word `(animationTick-lastTick)&65535` must reach delay. Delay0 also runs every call. Each eligible call scans active slots0..15 in order, then writes lastTick even if the table is empty. Late calls perform one pass, with no catch-up rounds. A removal does not truncate the slot scan.

Main calls this manager at `0xbd73`, after the animal frame call `0xbd68` and before disaster dispatch `0xbd85`. Weekly code `0xbdf0..0xbe0e` allocates one vehicle at current town-region coordinates multiplied by8, with heading0, before flood counter/natural events/aging/markets. Both calls now run in those positions. Startup instead allocates eight with heading4. Main `0x24c6..0x24e5` skips market history for the loaded branch, then joins weather and unconditional eight-car allocation `0x2560..0x258e`. Fresh original imports now perform those eight visual draws after weather; generated farms retain their existing startup allocation phase. Neither path paints traffic until its first update.

Native pause, pending town/default decisions and modal aircraft flight suspend ordinary traffic. The browser speed slider scales the common logical clock, so traffic follows it. Cold delay16 remains the source default; original speed-menu writes to shared DS2286 (also read by livestock) and complete warm-load behavior are not claimed by the browser multiplier. Late/restored clocks retain original unsigned elapsed behavior.

## Native v17 and collision sound

`runtime.traffic` contains all sixteen byte arrays, active count, delay and last-tick. The simulation owns typed views; checkpoints/snapshots detach them. Traffic no longer remains under generated-only `runtime.newFarm`. V15/v16 generated saves migrate every existing traffic byte/clock without allocation or RNG use. V1–v16 original saves had no traffic owner: they migrate an empty source-default table with delay16/lastTick0, retain their map/RNG exactly, and gain cars through subsequent weekly allocation. This is an explicit native migration policy, not a reconstruction of missing historical vehicles. V17 requires valid traffic state and rejects malformed live coordinates/headings/variants/counts/clocks while retaining arbitrary inactive payloads.

Collision calls `0x133d5` and `0x1357e` pass DS230e and DS2318 (file869fe/86a08). Both strings are `smack.voc`. The archive member starts at2150605, length1500, SHA-256 `a4f4d1de4fd51164e51387a4548bf55e74bd661718f2c6e0f7acec65a98df3a7`; its1467 unsigned PCM samples use time constant166, yielding1000000/90 Hz. The importer already extracts this original resource. Canonical machinery/traffic collisions drain transient notices into two sound requests, preserving caller order; the browser's existing interrupting sample player handles delivery and mute. Exact DOS driver arbitration between duplicate requests remains a presentation gap. No sample is stored in checkpoints or replayed by restoration; background music stays MIDI.

## Verification

Ten foundation tests pin source instructions and data, all2048 terrain images with ownership flags, all16 road masks/eight headings/four random starting sides, five-attempt limits, diagonal/edge behavior, all vehicle variant/headings, unknown-bit retention, visible/hidden livestock collisions, sparse removal, timing boundaries/word wrap/slot order, detached record/map/RNG continuation and invalid-input atomicity. Six live tests add all-eight-scenario startup, canonical ordering/map changes, pause, weekly allocation, full tables, collision events,35-day continuation and v1–v17 migration/validation. Flight regression requires traffic suspension. PCM tests check every sample and both filename pointers. Two browser flows verify exact original pixels, downloaded continuation, weekly movement, original sound playback/mute/no replay, failed-load atomicity and legacy migration. Full suite/build results are in [progress.md](progress.md).
