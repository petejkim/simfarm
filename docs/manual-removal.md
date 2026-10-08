# Manual field and building removal

Source: untouched SIMFARM.EXE, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets. Static tracing only; no DOS execution. Confidence is high on the directly traced whole-building/field branches. This is an incremental reconstruction of the original removal tool; loose goods and terrain branches remain unfinished.

## Original entry and transaction

Map-window callers0x20880 and0x20d11 invoke233c:035c, file0x2591c. This is a mouse-held loop: transform client coordinates to16-pixel map cells, reject outside the window, ignore repeated coordinates, and stop on button release. Native selection and explicit confirmation replace the held-button dialog sequence.

At0x259c0 the secondary map word's town bit0x4000 prevents removal. There is no player-ownership0x0800 requirement; this matters for water pumps built off-farm. At0x259cf..0x259dd unsigned cash must be at least25, including equality. Insufficient cash requests uhoh.voc and notice42. An accepted cell requests bulldoze.voc before object lookup. Sound strings are in initialized DS, file0x846f0 + offsets59e4/59ed, not the tile-table segment.

Building lookup0x25a30 calls0x1a17e with a1×1 rectangle and takes precedence over fields. Event46 and the confirmation dialog at0x25a66 precede mutation; zero means accept. Types71/70 remove the irrigation source via0x17944 at0x25a93/0x25ab9. Then0x25ac4 calls building/content cleanup0x19f6a;0x25adc calls generic deletion through overlay stub24e6:10aa. Stored animals, machinery, inventory and chemicals are destroyed without sale income. Existing native demolition composes these routines, updates definition counts/book values, validates aggregate references before writes (SF-064), and retains unknown inactive record bytes. Queued irrigation packets finish; removed sources do not start another wave (SF-093).

If no building matches, point query0x25af2 calls0x1b928. State byte+2 must be0 (Waiting) or4 (Growing), checked at0x25b0c/0x25b14. Other states display: “You cannot bulldoze a field while equipment is operating in it.” Event47/confirmation0x25b6c precede cleanup0x1b996 and deactivation0x1ba6a at0x25b7e/0x25b89. Field cleanup releases assigned equipment as applicable, queues clearing across the actual footprint and removes overlay0x1000; inactive field bytes and planner records survive. Existing native fixes SF-060..063 remain in force.

Both accepted branches request explode.voc and reach0x25f32: debit25 with category−1, through0x1c88e. Its category branch0x1c900 posts to DS3eac, the existing annual `otherExpenses`, modulo32bits. Neither uses the automatic tree-clearing worker account. There is one charge per object, regardless of its area. The later terrain chain0x25f40..0x26222 does not match newly queued clearing tile664; its second debit is therefore skipped. Tests pin every range used in that exclusion. Cancel instead falls through that terrain chain (SF-112).

## Native boundaries

`checkManualRemoval` is a read-only map quote: exact click gates, building-first lookup, field-state gate, object footprint and25 price. `removeManualTarget` rechecks the selected kind/slot against canonical state, then composes existing cleanup and the expense posting. A stale selection cannot delete a different object. Invalid native references/accounts fail before any payment. There is no invented salvage credit, ownership requirement, per-cell demolition fee or new checkpoint field.

Tests pin executable call/gate/debit bytes; quote and remove eligible objects across all eight supplied farms; retain source bytes, plans, regions and income; cover every field-state byte, town/cash/edge gates, equality, expense wrap, stale identity, overlapping lookup precedence, special irrigation sources and atomic malformed-state rejection.

Remaining: connect live commands and browser confirmation/feedback, clearing/audio/checkpoint verification; recover loose inventory/chemical removal and terrain/road/fence/ditch neighbor repair; trace manual relocation independently. Source bulldoze/uhoh request timing and exact original modal pause behavior are not yet reproduced by this object-only interface.
