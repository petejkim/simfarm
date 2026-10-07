# Irrigation reconstruction

Static evidence uses the supplied SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`; addresses are file offsets. No DOS/x86 execution. The source-registry/save-stride discovery is recorded in [construction.md](construction.md), SF-086–089 in [original-bugs.md](original-bugs.md).

## Source state and import

`readIrrigation` applies all64 overlapping loader writes at `0x459de..0x45a35` to the192-byte registry (`2d9f:f954`). The original SSM payload is retained with the scenario. Native cold import zeroes the untransferred **inactive** tail; an original count above43 is rejected rather than inventing missing live records. Native state supports all64 sources and preserves all registry bytes. This is an explicit cold-import policy; original warm-load carry and initialization of the untransferred tail remain unresolved.

Source delay `6190:2402` loads via `0x4620e` from SSM `0x21720`, immediately before the dword sales accumulator. All eight supplied farms have delay3. Phase `2425`, active `2400` and flow indices `240c/240e` are initialized to zero (`0x4063b..0x40665`); the source registry count is reset there before later loading. Native cold state starts with an empty flow and lastTick0. Native saved continuation must preserve its exact phase, queue and last tick; importing DOS warm runtime is not claimed.

## Driver and flow

The frame dispatcher calls wrapper `148c:0842` / `0x17302` at `0xbd42`, after clearing `0xbcc8` and an equipment call `0xbd38`; wrapper calls driver `0x17310`. Driver compares unsigned word-wrapped animation tick difference with delay. An already-active pass sets delay3. An idle phase0 first changes every wet ditch98–108 to87–97, preserving upper flags, then toggles phase. Phase0 entry calls `1957:10ac` / **0x1c81c**, which refreshes field water then status before seeding. A completed phase1 calls `15b3:0f9e` /0x18cce, refreshing only field water. Both original field scans are count-driven; native callers use bounded active records.

Sources seed in registry order. `0x174c4` requires a type70 building and first-word water bit0x2000 somewhere in its clamped3×3 neighborhood. Such a source seeds its own coordinate/strength. Otherwise strength48 seeds `(x,y+1)` when signed wind>=9 or phase0. Other strengths without an active pump do not seed. Source visitation `0x17560` sets/clears bit0x8000 according to phase, converts dry87–97 to wet98–108 during phase1, and reverses it during phase0. Second words/attributes are unchanged.

Neighbor query0x17636 visits N,E,S,W. Both phases accept tiles87–120 inclusive and120/121/122/124/172/173; phase0 also accepts123/125 (closed-valve images). It excludes cells whose visitation bit already matches the phase. Single-path flow decrements strength, except tiles120/121 reset it to64 (table08d8=120 and **count09db=2**). Branches divide unsigned strength by outgoing-neighbor count, dropping the remainder, and enqueue each direction. A dead end can take the next packet, relocate to its coordinate, and calculate `(min(a+b,255)+b)&255`; SF-086 is preserved, not replaced with an assumed saturated sum.

Consumer0x17b3e processes four packet attempts per driver call. Its byte post-decrement means empty on the fourth attempt does not report completion until a subsequent call. Native scheduling retains that boundary. Native zero-strength packets are consumed rather than re-enqueued indefinitely (SF-090). The native FIFO has explicit occupancy and can exceed128 entries without the source ring's full/empty alias (SF-088); valid propagation is bounded by9216 newly visited cells plus64 source seeds. Invalid oversized checkpoints must reject. Neighbor reads ignore off-map cells and queued outlets clamp consistently (SF-091).

## Validation and remaining integration

Eight primitive tests cover executable instructions/tables, all eight overlapping imports and inactive bytes, native64-source capacity/removal, timing/phase/field callbacks, wet/dry valve eligibility, signed wind, pump water proximity, branch division/zero draining,129 pending entries, preserved merge overflow, map edges and clock wrap. TypeScript and production build pass. The driver and registry are not yet attached to the live clock/checkpoint in this increment; this is the next task, followed by usable types70/71, ditch/valve controls and livestock/trough behavior. Native pause will freeze irrigation logical ticks consistently with equipment/clearing.
