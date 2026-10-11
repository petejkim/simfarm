# Water storage and automatic trough refills

Evidence: static analysis of supplied SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets; the executable is not run. This subsystem uses native TypeScript and existing canonical building/inventory bytes.

## Construction

All eight scenarios define building72 as graphic103/base481,1×1,price200. The ordinary single-cell shop path reaches purchase0x1cb42 via0x24af6, following town/occupancy guards0x24266/0x24295 and ownership0x24ac8. Final generic placement0x1ce04..0x1cf25 accepts owned grass15..30 or roads150..171. Auto-clear occurs in the click caller before the purchase; free trees still require25 cash before clearing, while535..538 charge25. Native rejection is atomic (SF-095). Broader historical construction guards for other one-cell tools remain separately scoped.

Allocator0x1a0a8 initializes the same twelve cells as other buildings: graphic217,type−1,slot0, retaining byte7. Crucially, building word+10 therefore starts at217, and the water consumer interprets that word as stored water. Neither generic add0x3a32a..0x3a377 nor final successful painting resets it. This original initial supply is retained explicitly (SF-105), rather than inventing an empty building. Normal building count, expenseDS3e90 and bookDS3e54 postings apply; type72 creates no irrigation source-registry entry.

## Production and wear

Odd-day producer0xc364..0xc548 is called at0xd296, immediately after animal needs and before the day-seven weekly pass. Active type72 qualifies only with byte+6<255 and flag0040 clear. It checks four cardinal neighbors, using initialized graphic84/base98/count11: wet ditch images98..108. It does not accept valves, crossings, pumps, diagonals or nearby troughs directly. Native ignores out-of-map neighbors (SF-103).

A qualifying building adds50 to word+10 with16-bit wrapping, then caps at255. An open interior (flag1) writes raw terrain83+(stored>>6); closed buildings retain their roof. The original raw interior write clears prior terrain flags, matching existing building-interior behavior. Tests preserve the addition-before-cap quirk for out-of-range prior words (SF-104).

Weekly routine0xbf02 is called at0xbe4d, before wind0xbe74 and reported field status0xbe8b. Its building phase0xc03a..0xc104 skips inactive slots and flag2. Other active buildings increment word+8 with16-bit wrapping; byte+6 becomes age>>2 below1020, otherwise255. Type72 whose incremented age exceeds480 draws visual RNG once; `(value &63)==7` sets condition255, clears stored water, paints149 while retaining high flags, setsflag2 and requests source notice44. Native UI shows persistent worn-out locations and selected-building condition; original notice-window/audio dispatch is not reproduced by this increment. Other building types age but do not take that random failure branch.

## Weekly inventory and refill

Inventory tail0xc230..0xc362 visits active items in slot order. Types168..215 increase loss word+4 by1 with storage flag4, or4 otherwise, capped at65530; values already at/above65530 remain unchanged. Every active inventory record increments age word+6 with16-bit wrapping. These recovered effects are live, including stored crops/seeds; no upkeep charge is invented.

For an empty type299 trough,0xc2e0 requests64 from helper0x1a244 and puts twice the delivered amount into its quantity. Any positive delivery repaints full trough176 with prior high flags; zero delivery leaves the image alone. Nonempty troughs are not topped up. Refills do not require spatial proximity to a store and do not charge cash. Supply order is building slot order, not nearest distance; shortages produce a partial refill. The helper only checks active type72 and positive contents, independently of its production eligibility.

The original helper unconditionally zeroes each contributing store even after capping its contribution to the remaining request, discarding unused water. Native subtracts only what was delivered (SF-101 correction). Open interiors repaint from the remaining quantity. The first normal refill of a255-unit store delivers128 trough units and retains191 stored units; this deliberate correction has direct regressions.

GameSimulation calls production after odd-day needs, and building aging then inventory/refills before weekly wind/field work. Source equipment/chemical/animal aging phases within0xbf02 remain unfinished and must be inserted at their original positions as reconstructed; this is not a claim that the entire weekly dispatcher is complete.

## UI, persistence and checks

**Map tool → Build → Water storage** purchases the original building. Selected stores show quantity/capacity and condition; the Livestock panel shows total stored water and worn-out locations. The shop explains automatic weekly refills and the wet-ditch dependency. Existing v10 saves preserve all changed words, flags, tiles and RNG without migration or new runtime state. Pause and pending town/default decisions suspend the lifecycle.

Six primitive tests cover source operands/tables, all eight definitions/initial states, cardinal/boundary checks, flags, word arithmetic, inventory loss, sparse/ordered withdrawals, partial supplies, preserved surplus, unchanged finances and wear thresholds/RNG. Two live tests connect a real purchased pump and dug ditch to storage, refill a distant trough, preserve exact saved continuation, distinguish odd-day/weekly ordering, and freeze valid pending decisions. Browser tests cover construction, original481 pixels, weekly quantities, saved continuation, wear feedback and390px layout. Full check results are recorded in progress.

Remaining work includes livestock aging/reproduction, equipment/chemical aging, original repair/demolition controls, full original input/audio lifecycle and scenario/disaster systems. Water storage is one completed subsystem increment, not completion of the preservation goal.

## Original burst warning restored (2026-10-11)

Livestock-window retirement audit rechecked building-failure tail0xc0e3: `6a2c9ad80fe624` pushes44 to24e6:0fd8, the overlay4 Message dispatcher30220. Unlike livestock care notices, this is a popup, not quick-message code44 (“Need more roads.”). Table3035c[44] resolves30286, which assigns portrait74; common loader303da uses events.dat record44. Record0x2c00..0x2cff SHA256 is `13570114ac6d17082c1f6d793d1e9c848b20ec4787a12226714b3471df5f7a98`, text: “A water tower has burst! You may want to bulldoze it and buy another.” Confidence high: call, dispatch table, portrait and source record agree.

Native ageBuildings already returns the failed slots. GameSimulation now emits a transient building-notice per failure when Options → Messages is enabled, and React shows the existing original Message artwork with portrait74 and real text/OK. This restores the warning before deleting the interim worn-location paragraph. No guessed failure sound, sale, charge or automatic rebuilding is introduced. Existing failure/clearing/refill order, RNG and checkpoints are unchanged. Like financial optional notices, the source3c0 animation-tick throttle is not mapped to DOS timing; native Messages preference applies once per actual failure. This limitation remains explicit, consistent with the requested native pacing.

Source/decoder tests pin the call/table/portrait and all256 short-record boundaries; live tests cover failure/no failure with Messages on/off. Browser verifies exact source popup text, dismissal, zero-water/refill consequences, original pixels and canonical save equality. The new notice joins the existing transient message queue and is not serialized. This is a native presentation omission fixed, not an original defect.
