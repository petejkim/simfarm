# Aircraft purchase and service

Source SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets. Purchase/service and the flight primitives have high-confidence source evidence; manual flight is not yet connected to the live game. This is an incremental subsystem reconstruction, not a completed aircraft/game port.

## Purchase

0x30dc6 requires nonzero airport byte DS64c6 and cash at least unsigned equipment-definition8 price (6000 in all supplied farms). The loop scans regionX outer, regionY inner across12×12 and accepts district low nibble5. It chooses local x3 if bit0x20 is clear, otherwise x5 if0x40 is clear, both at local y6. Allocation0x30e70 calls generic0x3a2ca, which calls shared constructor0xf8be. Constructor bytes are the same as ground equipment, including zero fuel/payload/type words20/32/34, preserved unknown bytes and timer DS139e. Definition count and unsigned equipment book value increase; debit category8 increases equipment expenses. No ground-ownership, tree-clearing, strict-cash-equality or generic ground-placement gate applies.

0x30ea1 writes full terrain words71/72 at top row and111/112 at bottom, preserving overlay/attribute separately. The selected regional parking bit is set. Native preflight bounds allocation to1..126 and rejects an inconsistent free-bit/live-aircraft-home collision before mutation. It does not silently search a different pad in that case.

**New airports start with byte0xa5** in constructor0x3aba0, so bit0x20 is already set even when no plane record exists; purchase selects x5. This source fact is preserved, not interpreted as permission to clear a parking bit. Existing aircraft sale/aging cleanup clears its corresponding bit and restores the pad. Tests cover construction→purchase→sale→repurchase at bottom-right map corner and both pads in an explicitly available regional state. DS64c5 is retained in source bytes; the purchase's use of it as a return value is not assumed to mean a plane count.

## Service

The original service dialog opens via parked terrain71/72/111/112 at0x257b0 and equipment lookup. Native accepts active type8 at its intact parked home and refuses busy/incoherent records. Fuel/payload outside0..255 reject service without altering their retained bytes (SF-104). No ground-machine repair is added.

- Fuel0x309ac: low16((255−word20)×DS65f6), initialized rate1. On nonzero successful debit, word20 becomes255.
- Repair0x30d38: low16(condition byte17×signed DS65f8), initialized rate10. Nonzero successful payment zeroes byte17; age word18 survives.
- Payload load0x30cda: full32((255−word32)×floor(selected chemical price/10)). Nonzero payment sets word32=255 and word34=shared selected type.
- Chemical selection0x30a08/0x30a7e/0x30ae4: choices221/223/222. A different selection refunds low16(current payload×prior shared selection unit price), zeroes payload, then changes the global selection. Loaded type word34 is unchanged until the next paid load. Selecting the same type does nothing. Original payload prices are200 in all eight source farms, so full load costs5100; this differs from field treatment delivery pricing.
- All payments use category−1, DS3eac other expenses. Refund0x1ca28 subtracts from this account modulo32bits and adds to cash modulo32bits before the9,999,999 cap. Zero payment never replenishes a free payload (source nonzero-result test).

Shared selection DS65fa/65fc starts at221, independently of each aircraft's payload type. It is simulation state, not React-owned state. This source quirk and possible unequal-price consequences are retained under SF-109. The current implementation stores only the semantic type; the executable far pointer is derived from that type and is never executed or stored as a native pointer.

## Verification and remaining work

Primitive tests pin original instructions and initialized rates/pointers, cover all eight scenario definitions, exact home images/record bytes/ledgers, both pad states, map corner/capacity, atomic failures, payload/refund widths, cash caps, repair-retained age and cross-plane selection. The live Aircraft panel buys planes, quotes/refuels/repairs/loads supplies, selects chemicals and locates parked planes. GameSimulation owns commands/state and publishes detached snapshots. v11 checkpoints the shared chemical selection; v1–10 migrate once to initialized221. Native files reject missing/invalid current selections; purchase/service feedback remains transient. Live tests cover exact35-day resumed wear, service, detached state, migration and default blocking. Browser tests cover purchases/service, source-exact four-tile home images, financial feedback, saved continuation, malformed saves and390px layout. Manual flight0x30f70 must reconstruct its animation timing, steering, world effects, chemical delivery, return/crash transitions and audio before aircraft are operational in the native game.

## Manual-flight primitives (live integration pending)

Manual flight0x30f70 gates iterations on unsigned animation-tick delta≥2 at0x31053. Independent wear/fuel deltas must exceed32 (0x31131/0x3115d): condition increments by one and ends flight above250; fuel decrements as a word, then signed≤0 clamps to0 and ends flight. Active spraying checks delta>8 and consumes one payload unit (0x31190..0x311c6). Its first timestamp is uninitialized (SF-110); the native primitive initializes it to the takeoff animation tick.

The11-word key dispatch table at0x31274 covers codes0x47..0x51:47 toggles spray,49 increments the bounded1..100 sprite-offset/height byte,4a stops spraying,4b/4d decrement/increment heading modulo8,4c/4f end flight,4e starts spray if payload exists,51 decrements the offset and ends at0;48/50 do nothing. Helpers0x631d/0x6338 use BIOS int16 AH1/AH0. Dispatch requires the low ASCII byte to be zero: extended Home toggles spray, PageUp climbs, Left/Right turn, End terminates, and PageDown descends. The scan-table plus/minus entries do not prove that ordinary ASCII-producing keypad keys dispatch. Movement is expressed through viewport origin plus signed local offsets and edge heading changes, not ordinary equipment movement. Native flight coordinates/rendering must disentangle those viewport dependencies.

Every fourth spraying frame (0x31645) finds the field under the computed plane ground position. Loaded type word34 selects221/222/223 effects at0x31682, sharing field-condition helper15b3:1b16 and shifting the corresponding retained byte+60/+61/+62. The primitive applies toxicity mode3 amount2, then mode8/10/6 using the current field byte20/21/22, then halves retained pressure byte60/61/62. Tests check all three loaded types without purchasing ground supplies. Flight end0x317b0 checks whether the current region low nibble is5: airport exit repaints the plane's original home and marks its pad; non-airport exit paints crash tiles73/74/113/114, clears home, invokes generic equipment removal and clears parking. Aircraft record position is not the flight's transient position. Original plane/spray resources and timer updates are now traced below. Live rendering, audio and simulation-clock integration remain pending.


### Source timing, viewport and ending details

Both original timer words DS139e/13a0 increment together at0x625d/0x6261. The modal flight loop does not call the ordinary farm calendar/equipment/field phase driver; native integration must advance both logical timer words while suspending ordinary phases. No equivalence between browser wall time and DOS hardware timing is claimed. A queued command is consumed after resource timers and before movement; even an ending input still moves and applies that iteration's spraying before final cleanup. An empty initial fuel tank does not end until its first >32-tick fuel gate. Decrement wraps then clamps signed≤0; wear increments as a byte, including255→0 (SF-104). Spraying can consume its last unit and remain enabled until the following >8-tick check; this is retained.

Centering0x22578 starts camera origin at equipment position minus half the viewport, bounded to the map. Source movement0x31292..0x314c2 changes camera coordinates until its edge, then local plane offsets. The native primitive captures whole-cell viewport dimensions8..80 and excludes DOS client-border offsets. These are explicit native input bounds, not recovered DOS window limits. Horizontal local limit is floor(columns/2)−3; vertical is floor(rows/2)−3. The southern camera edge is95−rows, while the eastern edge is96−columns; edge turns retain the source asymmetries. NW's wrong-axis horizontal clamp is corrected under SF-111. Source initial centering can put the plane away from its parked ground position at a clamped viewport edge; the primitive retains that calculation.

The equipment record remains at its home while transient flight coordinates move. Generic takeoff erase0x1d0e8 replaces each home terrain word with `(old & 0xf800) | (15 + soilMoisture + (attribute >>> 2))`, truncated to16bits. Regional parking stays reserved. Ending over **any** airport region returns the plane to its original home rather than relocating it to that airport. Elsewhere, original crash tiles overwrite the current2×2 footprint; generic removal0x3a040/0xf888 subtracts an owned plane's count and full unsigned price from book value, clears its home/parking and deactivates it, without a cash refund or sale income. Primitive tests cover ending by pilot, zero altitude, fuel and wear, and both home/different-airport return.

The tornado reaction at0x316e8 calls distance helper0x378f8→0xfb54 using camera centre, excluding plane edge offsets. Squared distance<50 starts turbulence; <5 also ends flight at zero altitude. The spin increments on subsequent frames and expires after128ticks. This reaction is tested independently, but there is **no live tornado producer/update integration yet**. The original also calls disaster update24e6:0fb0 and retains spin/turbulence globals DS6620/6624/6626 across flights. The primitive currently initializes those per flight: global carryover and disaster callbacks must be revisited when that subsystem is reconstructed. Do not count this isolated reaction as completed disasters.

### Original flight sprites

Resources in MEGADATA.EEA, all verified against archive offsets and SHA256:

| Resource | Offset | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| airplane.spr |1720736|5130|`96596a523c83b3988d751afd4bd84575ecd8c7e244e6ea32a3c09cedea1011d9`|
| apshadow.spr |1725866|5130|`b2d31dfc6a40db9e50a8e08df1e2b776ee1f1371dbb0c52996b54f526a64a93f`|
| cropdust.spr |1783826|1290|`da48747a817847977b8936bce384b0e545b672073f6b4087699099ff59476848`|
| plane.voc |2062992|12881|`96b0153d97a84086d82a7a960597ce8c641da73f556c0b8707bce3c12456c95b`|

Loader0x4936e..0x493da names the three SPR files. Header parsing0xb95c..0xb9be skips frame-count word0, reads height at2 and byte stride at4 (low bytes), plane-byte count at6, and retained edge-mask/flag bytes8/9. All three resources are32×32, stride4, plane length128, edge mask255 and flag1. Plane/shadow have8frames, dust has2. Frame addressing multiplies planeBytes×frame×5. Blitter0x7a23 receives the first plane as EGA write mask;0x7b0a..0x7b10 puts it in register8. Set mask bits write colour, clear bits preserve background. Four subsequent planes encode low-to-high colour bits, MSB-left, using simfarm.pal. Transparency is independent of colour index, including opaque black.

`readSprite` checks header/frame boundaries, consistent dimensions and the reconstructed255/1 header variant, rejecting unknown variants rather than guessing their semantics. Local import produces ignored horizontal PNG atlases. Tests compare every decoded/atlas pixel against fingerprinted source planes, include opaque zero/transparent nonzero pixels, nonzero buffer offsets and malformed inputs. The decoded airplane and dust atlases have been visually inspected. No DOS graphics environment is executed.

Rendering0x31593..0x31645 uses airplane frame(heading+spin)&7 at ground-cell pixel position, shadow same frame displaced(−2×altitude,+2×altitude), then dust frame(heading+spin)&1. Dust offsets indexed by heading are x[0,−24,−24,−24,0,24,24,24], y[24,24,0,−24,−24,−24,0,24]. These canvas calls are still pending. Engine PCM delivery must also account for repeated source requests and the existing native sound replacement policy; MIDI background music stays independent.

### Primitive verification

Ten flight tests pin source interval/key/movement instructions, verify rejection without mutation, all eight directions and bounded square/portrait/odd viewports, uint16 timestamp wrap, one-input cadence, all chemical effects, last-payload timing, altitude limits, wear wrap, home/different-airport landing, crash accounting and isolated tornado thresholds/expiry. Three decoder tests verify all18 original frames and binary boundaries. GameSimulation commands, checkpoint persistence, accessible flight controls, live rendering/audio and browser flight checks are the next increment; service remains the only live aircraft interaction until then.
