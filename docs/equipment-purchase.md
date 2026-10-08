# Manual machinery purchases

Source: supplied SIMFARM.EXE, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Offsets below are file offsets, including overlay bodies. Confidence is high for the traced calls and initialized definitions; the original item naming/purchase-dialog presentation remains unfinished.

## Verified purchase path

- One-cell map click0x24196..0x24b53 clears before payment at0x24224, rejects town overlay4000 at0x24266 and masked terrain0800 at0x24288, requires owned origin at0x24ac8 and calls generic purchase at0x24af6.
- Multi-cell placement0x22445..0x224a9 sign-extends the definition price and requires cash strictly greater than it. Origin ownership alone is tested. Its0x22626 helper checks the viewport, not ground eligibility. Native world bounds replace viewport bounds. Exact equality is retained (SF-084), as is origin-only ownership (SF-085).
- Generic purchase0x1cb42 sign-extends the price word, debits category=type, then auto-clears the rectangle with y outer/x inner before allocation/placement. Ground eligibility0x1ce04..0x1cf25 accepts unmasked grass15..30 or roads150..171. Native preflight avoids partial clearing/charges/refunds on failure (SF-083/095).
- Ground constructor0xf8be scans slots1..126, initializes only its written members, sets active/drawn flags, direction/wear/age/link fields zero, saves original dimensions/home coordinates and DS139e timer timestamp. Unknown bytes survive reuse. Existing createEquipment implements this constructor.
- Generic allocator0x3a2ca calls the constructor at0x3a2ea, adds quantity1 to the definition's owned word at0x3a303, and adds the unsigned low-word price to DS3e50 equipment book value at0x3a31b. Cash price uses sign extension; asset posting does not. Debit0x1c912..0x1c929 posts types0..63 to DS3e7c equipment expenses. Clearing posts separately to worker expenses. Native uint16/uint32 wrapping is explicit.
- Ground overlay paint0x1cfd4..0x1d004 preserves upper overlay bits and sets terrain0800. Definition graphics40/42/44/50/52/54/71/72 select original bases848/852/856/868/860/876/892/896. All supplied ground definitions are width1, height1 or2, so generic row-major tile order matches the existing equipment renderer.

All eight supplied farms have types0..7, priced400/200/200/200/400/200/250/500. Types0..4 serve tractor/plow/planter/sprayer/harvester roles in recovered field dispatch. Type7 is the harvest transport. Types5/6 retain neutral native labels until the original names/roles are established further; notice strings beginning0x4ec60 are not an equipment-type-indexed naming table. Type8 aircraft has a distinct purchase path and is excluded here.

## Direct storage

Generic placement looks for a building at the requested origin, bypasses storage for types70/71/72, and dispatches equipment0..63 to0x1a596 at0x1cde3. The equipment branch accepts buildings66..69 (0x1a706..0x1a72c), calls first-fit space search0x1abae, tries normal then transposed dimensions at each cell, and stores at the chosen location. The clicked tile does not select an interior cell. Crop storage64/65 is incompatible.

The existing storeEquipment implements this path: stored flag, actual position/direction, original content graphics/type/slot and paired interior toggles. Constructor home coordinates remain the clicked coordinates. The existing owned-equipment allocator withdraws purchased equipment from storage when needed; purchases do not set the rented flag or charge rental expenses. Full/incompatible storage is rejected before any mutation.

## Repair scope correction

The repair handler0x30d38..0x30d85 charges low-word(condition × signed DS65f8), category-1, and zeroes condition only when payment returns nonzero. DS65f8 is initialized10. However its dialog is opened at0x257b0..0x25807 only for aircraft footprint images71/72/111/112. The same dialog handles fuel word20, payload word32 and purchase0x30dc6. This is evidence for **aircraft service**, not general ground-machine repairs. Aircraft allocation, fueling/loading, repair and flight remain to be reconstructed as a separate usable system.

## Native implementation and verification

src/simulation/equipment-purchase.ts composes the verified constructor, storage and painting primitives with atomic preflight. Existing native v10 records/accounts already carry its state. Primitive tests pin executable bytes, cover all eight farms/types, retained bytes and map flags, wrapped accounts/counts, signed prices, full slots, exact terrain/boundary/ownership gates, clearing order, rotated storage and owned reservation. Live command/UI/browser integration follows the primitive commit. Original purchase sounds/dialog reproduction remain pending.
