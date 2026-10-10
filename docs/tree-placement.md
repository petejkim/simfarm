# Trees and direct Hay/Trough placement

Source: immutable `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets, recovered by static disassembly; no DOS or x86 code executes in the browser. Confidence is high for the listed branches/arithmetic. Native gesture policies are explicitly separate.

## Original routes

Palette callback214f0/table22352 maps ID13→21920 (Hay/type300),14→219dc (Trough/type299),17→21c16 (Trees/type291). All enter mode4, set a1×1 footprint and use the shared held-button construction loop23e22/24196. See [direct-construction.md](direct-construction.md) for input, repeat suppression and initial valve/gate behavior.

Trees selects definitionDS73fa at21c9e, with graphic62, type291, initial price10 and dimensions1×1. Its18 bytes at8baea have SHA-256 `b443c9e38ca7d027070d4671d853552edca75f3a39addc76f1f226d6c5cada4d`. Graphic62 resolves through the word table at4ec60+085e+62×2=4f53a to131. The palette branch21c16..21cd1 has SHA-256 `3ba7c6e6cbe62357b8856a7c64bf85389642123a3e5cea9ab172eefdbe9624b0`.

Shared loop rejects town overlay4000 and occupied terrain0800 before tool branches. Trees24a98..24ac5 accepts grass15..31 inclusive, then24af6 calls generic purchase1cb42. Final generic validation1ce04..1cf25 restricts grass to15..30 and requires origin ownership0800 (only definition70 bypasses ownership). Roads are rejected by the tree-specific caller despite their acceptance in the generic routine. Native preflight uses the successful intersection. The tree call does not allocate an inventory/building/animal record and has no independent animal-occupancy test.

Generic price1d280 is sign-extended at1cb5c before debit1c88e. Category291 matches no expense branch, so the tree price reduces cash only. Generic add3a504..3a527 increments definition count modulo65536 and returns1; no book value or record allocation. Range3a504..3a527 SHA-256: `e93b654c4230cbc9bbb8cf55551c9376b6a882c111cd1747f3fcee1ccf7e97bf`.

Tree paint1d06d..1d0a6 calls05fd:007d/file824d once (visual RNG), masks15, adds131, and writes `(terrain & f800) | selectedTile`. Overlay/attribute remain untouched. Simulation/bounded RNG do not advance. Range1d06d..1d0aa SHA-256: `e2590d02a81521f7252a2c313d6190d8cf3fe72e0523fb97fd169761b919f21d`. All65536 visual seeds and16 resulting variants are covered by independent arithmetic assertions.

Automatic clearing shares26faa..27043:535..538 cost25;131..146 are free to clear but still require25 cash. Restoration uses signed soil moisture and attribute>>2. Native preflight retains successful costs and preserves the entire farm/RNG on failure, correcting the destructive early clearing already recorded as SF-083/095. Prices remain signed-word-to-unsigned-dword requests, including boundary values; this is source arithmetic, not a claim that ordinary tree prices reach the sign boundary. SF-102 now also records tree cash-only accounting; accounting intent remains unresolved.

## Supplies and feedback

Hay242ba..243e2 and Trough243e6..244e4 call the same generic purchase, with their existing recovered inventory allocator and ground guards. Native uses the existing buy-livestock command: Hay/type300 starts with512 units; Trough/type299 with256. Prices come from live definitions (source defaults100/15). Slot capacity, occupied-tile guards, successful clearing, quantities/counts, raw-byte preservation and downstream feeding/watering remain in [livestock.md](livestock.md) and existing supply tests.

Generic success1cc92 requests DS3ece `plopitem.voc`; loop24b24 requests DS59b6 `ploptool.voc`. The new tree command and existing299/300 supply commands emit both success requests, or one `uhoh` request for native preflight failure. Exact original failure-path duplicate arbitration is not emulated; failures are atomic. No sound is replayed by checkpoint restore. Animal purchases are unchanged.

## Native integration and limits

The original Trees button is enabled. Trees, Hay and Trough now use the same captured pointer painting as roads/fences/ditches: read-only hover quote, one command per newly sampled cell, Escape/Stop construction, release/cancel/blur/tool-change cleanup, and exact map coordinates at either zoom. React owns only tool/gesture/feedback state. Canonical simulation owns rules, cash, definitions, inventory and visual RNG; existing save state already retains every changed member, so there is no schema change.

Trees can be repainted after leaving and re-entering a cell with automatic clearing enabled; remaining stationary does not repeatedly buy them. This is the previously documented native input policy. Source art remains16×16 at1×, titles/feedback remain HTML, and mobile layout is not rearranged. Full inventory does not block trees. Source tree count continues to increase on each successful purchase; broader count/removal accounting is not reinterpreted here.

Browser checks cover all three palette tools, exact tree/trough pixels, supply records, hover nonmutation, funds/ownership/town/road/capacity rejection, per-cell charges, touch at2×, cancellation, save/reload and eight-day continuation. Unit checks add exhaustive terrain IDs/visual seeds, flags, signed prices/count wrapping, clearing thresholds, modal guards and35-day restored continuation. Direct Bulldoze, town/aircraft context routing and remaining original windows still need work; the preservation goal is incomplete.
