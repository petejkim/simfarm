# Manual asset movement and building interiors

Source: unmodified SIMFARM.EXE, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets. Confidence is high for the direct call/branch evidence; original desktop gesture and sound timing are not yet reproduced.

## Map dispatch and equipment

Map caller0x20d61 reaches114c:0006 →0x136c6. This handler distinguishes pickup cursor6190:1a2e and drop cursor6190:19ea. The equipment drop **does call destination helper0xf9e4**, through0d5f:01f4 at0x13d5a. This corrects the earlier incomplete call-index observation in progress.md; movement is not instantaneous placement.

- Point finder0xf7fe scans active equipment in slot order, using rotated definition dimensions from0x10d9c. Native bounds the scan by the decoded records rather than trusting the source active count.
- Pickup0x13712 rejects reserved1 or moving2. A building at the clicked point must be open (flags1,0x13766). Neither rental64, fieldWork8, wear nor cash is a pickup gate.
- Drop0x13c19 requires destination secondary-word player ownership0800. It does not separately reject town4000, occupied terrain, water, obstructed terrain or a full building. These are movement/parking concerns. Busy flags3 are checked again0x13c7e.
- If picked up inside a building,0x13cfd invokes withdrawal0x1aeb0 at the actual equipment origin, clears stored4, then refreshes that building twice0x13d1d/0x13d37. The withdrawal helper itself also refreshes twice. No withdrawal happens during equipment pickup.
- The destination setter resets the three-position history, byte55 and relocation state byte4=1. It timestamps from **DS139e, the timer clock**, at0xfa48. Drop then sets full flags0800 at0x13d66. No direct debit is made.
- Dispatcher0x14a12 handles self-propelled types0/4/6/7 and towed types1/2/3/5. Existing tractor allocation can rent a tractor and post its ordinary rental expense; absent an available tractor, the implement waits. Delivery, first-fit storage, obstruction recovery, towing and tractor return use those existing recovered routines.
- Original manual orders do not reserve machinery. The owned allocator tests flags09, rental64, wear and attachments, not moving2 or manual0800. Farm work can supersede a manual order; retained and documented in SF-115.

`src/simulation/manual-equipment-move.ts` implements read-only selection/preflight, atomic storage withdrawal/order submission and building toggling. Native preflight also rejects changed selections, malformed footprints/content and cyclic/inactive attachment chains before mutation. SF-011 retains the original unchecked storage evidence. Rechecking an open source building at submission is a native stale-selection guard; the original captures a building slot on pickup and does not retest openness on drop.

Aircraft type8 passes the original finder but is excluded by the dispatcher's type≤7 comparison0x14c38. Native rejects that ground action and directs the player to existing flight controls (SF-114); it does not manufacture aircraft ground movement.

## Building opening

Map caller0x20e22..0x20e65 finds the clicked building then calls17d4:03b8 →0x1a2f8. That routine toggles flags1 and reconstructs original interior/roof cells; pump70 and windmill71 are no-ops. Other types64..69/72 participate. No cash or ownership gate is present. Native uses the existing interior decoder/renderer and adds expected-slot protection. Open state and changed map words already persist in native v12.

## Remaining relocation branches

The same handler selects chemicals(category220), seeds87, harvested crops109, troughs79 and feed81. No animal selection branch was found. These branches are not implemented by the equipment primitive:

- Chemicals0x13d70 and seeds/harvest0x13fa0 attempt generic storage0x1a596 when a destination building exists, otherwise require ground15..31 inclusive with no terrain0800 occupancy. Source withdrawal and terrain/secondary restoration differ by item category; preserve this distinction.
- Trough pickup0x13a50 does not reject a missing inventory slot, and0x13a91 removes source storage **during pickup**. Drop0x14188 accepts ground15..31 without testing terrain0800, paints175/176 and updates coordinates. SF-116 records the unresolved hazards separately.
- Feed drop0x142a2 rejects buildings, requires ground15..31 and no occupancy, restores source secondary grass using15+(attribute&15), moves the record, then chooses image1024/1023/1022/1021/1020 at quantity thresholds102/206/308/410. Zero quantity deletes it. No new quantity, age or fee should be invented.

Current primitive tests pin executable instructions and exercise all eight supplied farms, source footprints, every destination terrain ID, gates/atomicity, all eight ground types, towing/rentals, destination storage, building types and bounded sparse lookup. Live commands, React controls and saved in-transit/browser verification follow as a separate increment.
