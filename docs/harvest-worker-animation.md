# Harvest worker animation

Source: immutable SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets. Static disassembly and original graphics bytes only; no DOS execution.

The user reported stationary workers during harvesting. The native harvest FSM already created random initial worker overlays1036/1037 in step12 and removed them after step13. The missing part was the original map animation pass, not another harvest state transition.

Main `bce7` calls `e27a`. Its pause-depth check is `e285..e294` (DS0187); `e296..e2a5` compares unsigned animation13a0 minus presentation timestamp1f92 against32. The pass requires an Edit descriptor at DS13ae/13b0 and walks its visible tile rectangle (`e594..e624`). Selectors c670/c6e0 resolve to2d9f, whose terrain and overlay arrays start0424/4c24. At `e5d0..e5ed`, masked overlay1036 becomes1037 with `(word & fc0d) | 040d`. At `e2cc..e2e5`,1037 becomes1036 with `(word & fc0c) | 040c`. Both preserve all high ownership flags for those inputs. Finally `e629..e631` stores the current animation timestamp. High confidence in the two-frame transition; full map animation includes other terrain/object branches that this increment does not claim to port.

| Byte range (end exclusive) | SHA-256 |
| --- | --- |
| e27a..e2c8 | `86f07ff9fc724e6b550564091fa0d810aa5556ad6a8a1ef6abfb42e88fb48289` |
| e2cc..e2ea | `950bbb4b6431879669b35fe9ee26437cf6827ce8a4dc24e4665bdc2f6237de07` |
| e5b4..e5f5 | `65b6be2a600e1c36d57a0361695281adf109816b8e0d22e99d902768af3c1a15` |
| e5f6..e636 | `1622f4064718b2a8058341bd0586cef9a697ee9f765d0be4726fc63916e02461` |

Worker images are masked-atlas indices188/189 (original indices minus848),16×16 with palette index7 transparent. mskdtile.til is25600 bytes, SHA-256 `f68a38c5be55f98c11e656fc4675ba65d8676b742d89a3650194fcc05efe386c`; simfarm.pal is48 bytes, SHA-256 `9fed4acc48a4059b7910fda28463a2e8701ecb22b3639c4c81e2a62f1d7e8975`. The existing local importer already supplies both frames; no asset or supplied distribution change was needed.

Native rendering preserves each worker's randomly chosen initial frame and flips its displayed atlas index every250ms while ordinary simulation runs. This is an explicit native presentation cadence, independent of simulation speed and old PC timer rules, as requested. Pause, forced town/default decisions, modal aircraft flight and hidden pages suspend it; hidden time does not accumulate. React owns canvas integration refs only. The clock and tile projection live in src/render; canonical harvest rules and data remain in the plain TypeScript simulation.

Unlike the original viewport-dependent map writes, native animation is a read-only projection over saved cells. Scrolling does not change farm state or RNG, and reload starts at the saved initial image. Presentation phase is not checkpoint state. Removing the worker mask during harvest cleanup immediately removes the animated overlay. This fixes a native omission; no new original defect or vulnerability is established. The older note about f7cc/f7ce/f7d0 writes remains historical research; those three writes are not the frame-switch owner recovered here.

Validation pins the executable and exact transition bytes, checks both frames with all32 high-flag combinations, unrelated masked indices, pause/remainder/reset behavior and renderer nonmutation. Browser coverage starts a real source-farm worker harvest through GameSimulation, compares opaque worker pixels against both decoded source frames, exercises pause/resume and hidden-page suspension, compares exact paused saves and reload, then advances harvesting to verify cleanup. A separate stored-truck continuation regression also passes. Screenshot: artifacts/browser-harvest-workers.png.
