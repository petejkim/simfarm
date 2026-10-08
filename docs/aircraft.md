# Aircraft purchase and service

Source SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets. Purchase and service evidence is high confidence; manual flight is not yet implemented. This is an incremental subsystem reconstruction, not a completed aircraft/game port.

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
