# Original road traffic

Movement, routing, removal and frame timing are recovered in `src/simulation/traffic.ts`. These are independent simulation primitives, not yet connected to `GameSimulation`. Generated farms currently retain startup records under `newFarm`; original imports do not yet have a canonical traffic owner. Live movement, weekly spawning and native checkpoint migration are the next increment.

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

The shared native machinery collision helper incorrectly cleared animal breeding eligibility bit2. Source `0x13572` is `26 80 8f 02 64 08`, an OR8 only. The helper now preserves bit2, sets collision bit8, records the animation tick at animal byte30 and retains original aftermath-image selection. This corrects a native implementation error, not an original-game defect. Animal lookup stays bounded. The two original collision sound calls are still represented by an `animal-hit` notice; their exact audio mapping/lifecycle remains unfinished.

## Timing and integration boundaries

Unless delay equals1, elapsed unsigned word `(animationTick-lastTick)&65535` must reach delay. Delay0 also runs every call. Each eligible call scans active slots0..15 in order, then writes lastTick even if the table is empty. Late calls perform one pass, with no catch-up rounds. A removal does not truncate the slot scan.

Main calls this manager at `0xbd73`, after the animal frame call `0xbd68` and before disaster dispatch `0xbd85`. Weekly code `0xbdf0..0xbe0e` allocates one vehicle at current town-region coordinates multiplied by8, with heading0. Startup instead allocates eight with heading4. These call sites are traced but not connected in this increment. Before integration, resolve original loaded-farm initialization, shared ownership and legacy native migration without replaying setup RNG. Delay-setting menu paths and complete warm-load behavior remain additional fidelity work.

## Verification

Ten new tests pin source instructions and data, all2048 terrain images with ownership flags, all16 road masks/eight headings/four random starting sides, five-attempt limits, diagonal/edge behavior, all vehicle variant/headings, unknown-bit retention, visible/hidden livestock collisions, sparse removal, timing boundaries/word wrap/slot order, detached record/map/RNG continuation and invalid-input atomicity. Existing equipment collision regression now requires breeding eligibility to survive. Full suite/build and existing animal/machinery browser results are recorded in [progress.md](progress.md). Browser regressions protect shared live behavior; they do not claim visible road traffic before integration.
