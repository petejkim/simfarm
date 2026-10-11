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

The same handler selects chemicals(category220), seeds87, harvested crops109, troughs79 and feed81. No animal selection branch was found. These branches are separate from equipment movement and are now implemented in manual-supply-move.ts:

- Chemicals0x13d70 and seeds/harvest0x13fa0 attempt generic storage0x1a596 when a destination building exists, otherwise require ground15..31 inclusive with no terrain0800 occupancy. Source withdrawal and terrain/secondary restoration differ by item category; preserve this distinction.
- Trough pickup0x13a50 does not reject a missing inventory slot, and0x13a91 removes source storage **during pickup**. Drop0x14188 accepts ground15..31 without testing terrain0800, paints175/176 and updates coordinates. SF-116 records the unresolved hazards separately.
- Feed drop0x142a2 rejects buildings, requires ground15..31 and no occupancy, restores source secondary grass using15+(attribute&15), moves the record, then chooses image1024/1023/1022/1021/1020 at quantity thresholds102/206/308/410. Zero quantity deletes it. No new quantity, age or fee should be invented.

Current primitive tests pin executable instructions and exercise all eight supplied farms, source footprints, every destination terrain ID, gates/atomicity, all eight ground types, towing/rentals, destination storage, building types and bounded sparse lookup. Live commands and React controls now connect these primitives as described below.


## Live controls and checkpoint integration

Canonical move-equipment and toggle-building-interior commands run inside GameSimulation after the same flight/default/town gates as other farm actions. Orders use the source timer clock; no UI hook owns movement state. Transient result snapshots are detached and do not replay after loading. Existing v12 equipment bytes, links, clocks, storage contents and map words already capture the complete action and in-progress towing, so no save migration is required.

Original Move object provides direct pickup/destination clicks. Machinery → Move machinery now closes that interim overview and arms the same original tool; the duplicate EquipmentMovePanel and Map tool category are removed. Cancellation performs no canonical mutation. Right-click or Examine opens/closes buildings without the old movement form. The duplicate Inspect/supply-shop interior controls have also been removed; original right-click and Examine retain building entry. The source mouse cursor/held-button modal presentation and its selection/error sounds remain unimplemented; no substitute original sound is asserted. Paused games retain queued orders until Play or Next day advances the simulation. The interface explains that tractor rental may cost money and farm work can preempt manual travel.

Three live tests verify interior persistence, exact mid-trip and attached-trailer save/load,35-day continuation, detached feedback and all modal gates. Two Chromium flows exercise actual map clicks/buttons, storage pickup/delivery, cancellation, busy/unowned feedback, tractor delivery/return, exact browser/native saves, original217 interior and459 roof pixels, and390px layout. The screenshot artifacts/browser-manual-movement.png was visually inspected. The supply branches have their own primitive and live-control increment below.


### Next storage dependency evidence

Generic insertion0x1a596 reads actual type from definition+2, dimensions+8/+9 and graphic+0. The gate0x1a5ca..0x1a5f7 accepts harvested types168..191 through the64/65 building test, while seed types192..215 can succeed independently of building type. The earlier harvested-goods label for192..215 was incorrect; decoded source definitions settle the names. The general66..69 fallback also accepts harvests but omits their coordinate update (SF-118). Do not replace this with the automatic harvest reservation helper's64/65-only policy without an explicit fidelity decision (SF-117). Both use first-fit0x1abae, but manual insertion writes slot references as bytes at0x1a69d/0x1a6a0, so the existing SF-021 inventory-slot truncation boundary also needs a preflight here. The generic routine updates inventory coordinates before its final refresh0x1ab89/0x1aba2; manual transfer's later source removal must therefore use captured original coordinates. Chemical insertion0x1a81c..0x1a867 updates coordinates and sets bit4 in equipment storage66..69. Same-building transfers reserve a free cell before releasing the original cell; a full building therefore rejects even when moving within it.


## Supply transfer primitives

manual-supply-move.ts preserves pickup order (equipment first, chemical records next, then seed/harvest/trough/feed graphic ranges), destination ownership, first-fit storage, exact single-cell terrain/secondary restoration, quantity/age/loss/unknown bytes and unchanged finances. Crops paint832..847 or816..831; chemicals paint915..912 in the masked layer. Ground15..31 is inclusive. Feed images use102/206/308/410 thresholds; zero feed clears itself and decrements its definition once. No sale income, delivery charge or simulation travel is invented for these immediate transfers.

Native preflight rejects stale selections, missing/mismatched inventory/content, unsupported goods or source/destination building graphics definitions and a storage slot above255 before mutation. Outdoors, full inventory slots through511 remain usable. Trough pickup no longer withdraws early, occupied trough drops are rejected, and stored trough/feed departure leaves a valid floor/content reference (SF-116). Harvest coordinates are updated in equipment buildings66..69 despite the source omission (SF-118). Seed compatibility and retained loss-rate flags remain source behavior (SF-117/119). All supplied definitions are1x1; altered dimensions fail preflight rather than guessing an untraced layout.

Seven primitive tests cover every populated crop/chemical/supply on all eight farms, source tables/instructions, every building64..72, same-building capacity/order, byte slot boundaries, raw-byte and account preservation, all2048 ground graphics, feed thresholds including zero and65535, trough fixes and actual post-transfer crop sale/chemical consumption. Live supply controls and saved continuation are connected in the following increment.


## Live supply controls

GameSimulation owns move-supply transactions and transient detached lastSupplyMoveResult feedback. Modal flight/town/default gates precede transfer; no new persistent state or v12 migration is required. React stores only the selection, displays canonical pickup/drop quotes and sends commands. Original Move object exposes all five categories; Livestock → Move supplies now closes that interim overview and arms the same original tool. The duplicate SupplyMovePanel/category has been removed. Right-click or Examine opens storage. Transfers happen immediately, including while paused, without synthetic travel, sound or fee. Dropping empty feed discards it; cancellation changes no canonical state.

Three live tests verify every category, source/target contents, quantities/counts, unchanged RNG/finances, exact per-action v12 saves,35-day continuation, moving stored harvest to equipment storage then selling it, empty-feed removal and flight/town/default blocking. Two browser flows cover actual map input, cancellation, unowned/occupied rejection, storage departure, all five original graphics, reload, exact browser/native state and390px layout. Seed and harvest pixel expectations use the crop file uploads at0x1480/0x1400; the unpatched base atlas contains placeholders and is not the correct visual oracle. The focused browser test exposed and corrected that test expectation without changing rendering or game rules. Source gesture/error-audio presentation remains pending.


## Original Move object palette gesture

Source is the immutable SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`; addresses below are hexadecimal file offsets. Palette ID26 resolves through22352 to21726. Instruction2172f sets Edit mode11;2173e installs the pickup cursor DS1a2e. Mode11 resolves through20d9c to20d42, calling114c:0006/file136c6 at20d61. The shared handler compares pickup cursor identity at136d3, tries the equipment finder at136f4 and falls through to supplies only when no equipment exists at13706. Busy equipment and closed storage are rejected before that fallback. Successful pickup captures coordinates at137cf and selects drop cursor DS19ea at137e5. Successful drop resets pickup cursor DS1a2e at14510. Source-pinning tests retain these instructions and both dispatch-table links.

The native **Move object** icon now arms that shared two-click interaction: select machinery or a supply, then select its destination. Equipment orders use the existing canonical timer/travel/storage dispatcher; supply transfers use the existing immediate chemical/seed/harvest/trough/feed command. All24 native crop identities remain supported. Destination ownership, storage compatibility/capacity, busy/closed-building checks and the documented native guards above are unchanged. Animals do not gain an invented manual movement command, and aircraft retain their separate flight controls. View object → Open building exposes stored items before selection.

The hook owns only an unsaved presentation draft and delegates quotes/commands to plain TypeScript simulation modules. Selecting/cancelling an object does not withdraw it or alter the checkpoint. Failed drops retain the draft; successful drops return to pickup mode. Escape, Cancel move, changing tools or loading a farm clears the draft. Escape works after File Save has moved focus outside Edit while respecting keys handled by menus/dialogs. Browser grab/grabbing cursors, footprint previews and text feedback are explicit native adaptations; they do not reproduce source cursor bitmaps or error-audio timing. Both duplicate machinery/supply movement forms have been retired; remaining inventory shortcuts arm this same original tool.

The adjacent map event7 route at20dfc is now traced to right-button press through the original mouse callback/queue. Right-click opens or closes a building while retaining the current Move object tool and draft. Examine remains alternate access. See [map-interactions.md](map-interactions.md) for source evidence and gate/valve behavior. Construction gestures and remaining source window interiors are follow-ups.

Four browser cases cover stored machinery, unchanged pickup/cancel checkpoints, rejected destinations, saved travel and arrival, every supply category, empty-feed deletion, busy-machine checks, tool changes and all24 seed/harvest identities. Existing movement primitive/live tests cover boundaries and original rules. This UI increment establishes no additional original-game defect; SF-011/021/114–119 remain documented, including the native protection against destructive trough pickup.


Move status follow-up: successful direct pickups now post original quick-message7, “Choose a destination.” Busy pickup/drop posts61 with the documented SF-173 correction for source62's unrelated harvest-cost wording. A busy drop discards the stale selection as original13c90 does; ordinary rejected destinations retain it. Source successful drop posts no replacement message. Existing canonical rules, source sound/cursor gaps, safety fixes and transient-save policy are unchanged. See edit-status.md for exact producer evidence.

Supply-form retirement preserves source pickup priority, immediate drop commands and original secondary-button building entry. Migrated the older browser flows to actual palette/map clicks, retaining every category's exact source pixels, storage entry/exit, rejected/cancelled drops, empty feed and saved continuation. No simulation/save change or new original defect. The remaining livestock shortcut is native navigation glue; it does not establish an original Livestock window control.

Machinery-form retirement preserves the source timer/travel/storage commands and their rental/preemption behavior. The shared BuildingInteriorControls component was separated from the deleted movement form and then retired after confirming right-click/Examine cover its only action. Browser flows use original pickup/drop and secondary-button building entry for safe cancellation, queued storage delivery, source interior/roof pixels, busy/unowned rejection, towed implement arrival and tractor return, with exact in-transit/reloaded checkpoints. No new original defect or save change.
