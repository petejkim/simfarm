# Original load and restart lifecycle

Source `SIMFARM.EXE`: size0x917b9, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets in that image. No DOS code was executed. Confidence is high for the direct branches/stores described below; complete original in-game loading and warm restart remain incomplete.

## Chooser return is not the final state

The preceding region implementation correctly traced SCEN filenames and result2, but stopped before the caller's remaining setup. Its claim that geographic loading retains SSM climate was therefore incorrect. This document supersedes that claim while retaining the earlier evidence/history.

Overlay manager filebase0x27060 resolves stub1208 to overlay6:0000/file31ca0, stub137a to overlay20:031c/file40d6c, stub13a2 to overlay25:1cd8/file4a398 and stub0f60 to overlay19:0bc8/file402a8. These overlay IDs matter because different overlays share segment27ce.

1. Successful marker loading0x3237b/0x32383 writes DS66c4=2 at0x32302. Exit0x32559..0x32585 arithmetic-shifts the three climate slider bytes by5 into DS67b6/67b7/67b8, then returns signed DS66c4 at0x32589.
2. Finalizer40d6c calls chooser at40ec6. Its branch40ece..40ede accepts0/1/3 for property setup and sends2 directly to41032. Thus2 skips the3×3 property/homestead phase; it does not skip everything after the chooser.
3. Every returning branch at41032 pushes wind, temperature and precipitation indices, then calls climate loader4a398 via stub13a2 at41050. That loader fills the three240-byte tables from rain/temp/wind resources; no loaded-result guard precedes the writes. This replaces the climate previously read from SSM.
4. Caller3f854 receives the result at3f8b3, but unconditionally assigns40000 cash at3f91b..3f922 (ordinary non-cheat path). After UI setup it loads townly0 and calls owner2/type0 construction at3fab0..3facb at the loaded town coordinates. The existing district constructor repaints the8×8 origin and connected neighboring roads, sets town ownership and region type/levela0, without charging cash. Active town coordinates are assigned at3fadc/3faec. The overlapping word stores also write zero to4d9f:fedd; that byte remains retained under its source address for generated setup and in immutable original source data where available, with no newly invented semantic field.
5. Returning to main,2347 skips date rewriting when DS66c4==2;2397 skips default crop loading and random market-history generation. Main24bb synchronizes DS1f92 to animation tick13a0; this is the gate for map animation0xe27a, a separate presentation clock not yet implemented. Existing weather initialization and eight traffic allocations follow at24ef and2560..258e. Date/history skips therefore do not undo the preceding climate/cash/town writes.

SCEN0..7 already have40000 cash. SCEN6/7 have rainfall tables that differ from the chooser presets; the distinction is observable with supplied bytes. See SF-148 for the retained overwrite quirk and limits on claiming an original defect.

## Native paths

| Entry | Current native behavior |
| --- | --- |
| New farm → Use region map → numbered square | Source-backed climate/cash/town finalization, then cold original-farm weather/traffic initialization; saved date retained |
| Original farm dropdown / initial browser farm | Direct supplied-file cold import; keeps SSM climate and town, then existing weather/traffic initialization |
| Native Save farm / Load farm | Exact native runtime continuation; never replays chooser setup |
| Generated custom or unmarked region | Existing recovered cold creation pipeline |
| Financial-default restart | Existing native fresh import or generated creation screen; exact DOS warm restart is not claimed |

`finalizeRegionFarm` validates original origin, map sizes, all climate tables and town construction input. `GameSimulation.openRegion` works on detached constructor-owned state and applies the finalizer before weather initialization. React supplies selected source climate, loads all assets before replacement and retains cancellation/failure atomicity. No save schema changes are needed: v17 already stores mutable climate, town, finances, map and runtime. UI state does not own these rules.

This corrects the known geographic setup writes; it does not reproduce DOS elapsed-time seeding, pre-chooser terrain-preview RNG consumption, menu/window scratch ownership, cheat command-line startup, or all warm retained state. The source's broader in-process state must not be approximated by blanket clearing or by treating every load as a fresh game.

## Restart and next work

Main269e checks exit/restart byte0194 for2, calls stub0f60/file402a8, clears its local setup result and jumps to2343. That routine partially resets records/maps/accounts, invokes4060c and setup3f854, then returns through the startup branches above. It does not simply reload the currently selected SSM. The fixed calendar written inside4060c is an intermediate state: non-loaded return passes main's host-date conversion again. Earlier descriptions of a fixed restart calendar apply only to the partial reset helper.

Known reset primitives already preserve omitted worker/building ledgers, report totals and unknown records. Remaining work is to trace the separate in-game SSM-load caller, inventory all retained runtime fields (disasters, irrigation, animals, market, RNG and scratch), and then compose an explicit warm lifecycle with native save coverage. Region setup must not be copied onto the checkpoint restore path.

## Verification

Four new tests pin the executable hash, branch and overlay bytes, compare all eight finalizers with source climate and town layout constraints, retain dates/source/field records, reject malformed climate/town input atomically, and check detached creation plus14-day saved continuation for all eight presets. Existing town-construction tests cover the road and boundary rules. The geographic browser flow compares all eight loaded checkpoints with canonical startup; existing generated/cancellation/error flows remain active.
