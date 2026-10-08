# Original load and restart lifecycle

Source `SIMFARM.EXE`: size0x917b9, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets in that image. No DOS code was executed. Confidence is high for the direct branches/stores described below; the in-game load entry and selected retained transfers are now traced; canonical import of represented session state is now connected; exact menu timing, remaining scratch ownership and warm restart remain incomplete.

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
| Load farm → original .SSM | Retained session transfer without chooser setup; starts paused; see the v18 policies below |
| Native Save farm / Load farm | Exact native runtime continuation; never replays chooser setup |
| Generated custom or unmarked region | Existing recovered cold creation pipeline |
| Financial-default restart | Existing native fresh import or generated creation screen; exact DOS warm restart is not claimed |

`finalizeRegionFarm` validates original origin, map sizes, all climate tables and town construction input. `GameSimulation.openRegion` works on detached constructor-owned state and applies the finalizer before weather initialization. React supplies selected source climate, loads all assets before replacement and retains cancellation/failure atomicity. No save schema changes are needed: v17 already stores mutable climate, town, finances, map and runtime. UI state does not own these rules.

This corrects the known geographic setup writes; it does not reproduce DOS elapsed-time seeding, pre-chooser terrain-preview RNG consumption, menu/window scratch ownership, cheat command-line startup, or all warm retained state. The source's broader in-process state must not be approximated by blanket clearing or by treating every load as a fresh game.

## Restart and next work

Main269e checks exit/restart byte0194 for2, calls stub0f60/file402a8, clears its local setup result and jumps to2343. That routine partially resets records/maps/accounts, invokes4060c and setup3f854, then returns through the startup branches above. It does not simply reload the currently selected SSM. The fixed calendar written inside4060c is an intermediate state: non-loaded return passes main's host-date conversion again. Earlier descriptions of a fixed restart calendar apply only to the partial reset helper.

Known reset primitives already preserve omitted worker/building ledgers, report totals and unknown records. The separate in-game caller and represented runtime transfers are now connected below. Remaining work includes exact nested-menu timing, unmodeled scratch ownership and warm restart composition. Region setup must not be copied onto the checkpoint restore path.

## Verification

Four new tests pin the executable hash, branch and overlay bytes, compare all eight finalizers with source climate and town layout constraints, retain dates/source/field records, reject malformed climate/town input atomically, and check detached creation plus14-day saved continuation for all eight presets. Existing town-construction tests cover the road and boundary rules. The geographic browser flow compares all eight loaded checkpoints with canonical startup; existing generated/cancellation/error flows remain active.


## In-game file-load entry and return

Overlay22 handler4314e routes the load action to43200. It appends the file suffix, then uses a same-overlay call at43258 to4543c. On success43272 clears chooser flag66be and window flag0188, calls resume stub1334 at43284, removes/restores windows, sets redraw flag019e=1 at432c7 and returns through431fb. Keyboard Enter has a separate call4308b to the same loader followed by filename/redraw handling. Neither direct caller jumps to main2343 or calls geographic finalizer3f854. Initial chooser file selection32bd5 uses the common loader too, but returns through the chooser setup caller described above; it must not be conflated with the in-game window.

Stub1334 resolves to overlay18:1138/file3f4e8. It does nothing if pause-depth byte0187 is0, otherwise decrements it; only transition1→0 executes its pacing writes. Those include equipment pacing a8a0=2 at3f505, disaster delay69b2=4, day delay1f8c=256, saved speed1f90=1, traffic delay2286=16 and irrigation delay2402=2, plus menu/check state. This occurs after the SSM decoder reads saved day/speed/traffic/irrigation delays at461c6/461de/461f6/4620e. The decoder alone must therefore retain the saved values, while the native import factory applies its conditional return callback separately under the native pause mapping described below. Cancellation43193 invokes the same callback. Exact nested-pause ownership remains to be integrated; the browser speed slider remains its explicitly native multiplier.

## Retained transfer primitives

These APIs remain separate decoder phases. The v18 factory described below now calls them with retained state for browser SSM imports.

| Decoder | Replaced by SSM | Retained from validated input |
| --- | --- | --- |
| `readFarmState(bytes, workerExpenses)` | Existing farm/calendar/clock/account members | Worker expense dword3e88, omitted by original loader (SF-014) |
| `readFinancialState(bytes, retained)` | Existing account/definition transfers; all four loan words/dwords; tax debt/countdown; report values; saved statistic dwords; home coordinates; town coordinates/recreation/airport count/revenue | Building book value3e54; six runtime annual accounts; untransferred statistics arrays/counters; homestead rank; loan rate and tax-failure byte; installment arrears/countdown; town funds/development spending; clearing queue and native modal state |
| `readIrrigation(bytes, retained)` | Registry count240f, original overlapping writes into bytes0..128, saved delay2402 | Registry bytes129..191; active/phase, FIFO and last tick |

The financial prior is validated/copied through the existing native financial boundary before combining writes; every nested array/definition/queue is detached. Native modal state is carried by the partial decoder only, with no claim that it is a DOS saved field or the final policy for replacing a session in default. Cold calls preserve their existing EXE defaults and all legacy checkpoint readers remain unchanged.

Irrigation loader459b7..45a35 reads64 triples but writes at `2*i+0/1/2`, touching129 bytes of the192-byte runtime array. Cold imports still reject active counts above43 because the remaining state is unknowable. Warm transfer can accept up to64 only when the prior tail yields valid active coordinates. It does not zero unsaved bytes or abort the active wave. Saved delay is read at4620e; conditional menu-resume delay2 is a later phase. Invalid old state, input truncation or invalid combined active coordinates rejects without mutating the prior. SF-087 retains the lossy-layout defect; SF-149 records the unresolved cross-map active-wave consequence.

Six new tests cover the actual loader/resume branch bytes and overlay target, all eight source farms' financial replacements and omissions, all worker dword boundary values, all129 registry writes and63 retained bytes, active queues, full64-source warm tails, detached ownership and atomic malformed/truncated rejection. Existing finance-save and irrigation tests protect unchanged cold behavior. Browser regression checks exercise existing geographic selection, annual finances and irrigation; they do not claim a live original-file import.

The composition below now carries represented weather, market, traffic, animal, disaster and pacing state around these transfer phases. In particular, loading changes saved clocks while many subsystem timestamps are retained, and the original file payload does not contain a complete session snapshot. Keep address-named unknown SSM fields (for example2410/2424) distinct from the verified weather moisture accumulator23fe/precipitation-active23da; adjacent saved bytes do not establish equivalent semantics. Full original menu/scratch lifecycle and warm restart remain unfinished.


## Canonical import and native v18

`transferOriginalFarm` composes the established SSM4543c..4644c transfers, crop-load repricing, retained financial/irrigation phases and conditional43284 resume callback. GameSimulation validates/detaches the result before replacement. React's Load farm accepts .SSM and labels the result Imported farm. No geographic finalizer, startup weather, initial car allocation or random market-history generation is replayed. Native checkpoints preserve the resulting state directly.

| State | Import behavior |
| --- | --- |
| Map, records, calendar, timer words, climate, planner, saved financial members | Replaced through existing verified SSM decoders; unknown source bytes retained verbatim |
| Worker ledger, omitted financial members, irrigation tail/wave | Retained through the decoder phases above |
| Market | First29 history samples, mode and rawBC72 retained; crop loading resets sample29 and crop/seed quotes from CRPs; saved harvest definitions remain loaded |
| Weather | Existing forecast/moisture/wind/anomaly state retained; saved precipitation-day counter replaced |
| Traffic | Records/count/last tick retained; delay loaded from2171e, then optionally overwritten by resume |
| Animals, disasters, grass/equipment clocks, water effects, RNG | Represented unsaved session members retained; no startup/reset events |
| Generated setup | Archived as retainedSetup; does not claim to be a complete current DOS memory image |
| Native modal continuations | Explicit replacement clears pending town/default/flight actions, starts paused and drops fractional elapsed time; no stale callback runs on the new map |

The calendar adapter preserves the prior last-day timestamp algebraically when the saved animation counter changes. Its unsigned phase can now be overdue or wrap; native v18 stores the whole word. Existing native day-boundary pacing remains an adapter, not DOS strict-greater timing equivalence. Running imports model the ordinary dialog's resume1→0 stores, including equipment pacing a8a0=2; paused imports model a remaining outer pause and keep saved delays. The file chooser does not reconstruct DOS nested windows, cancellation timing or menu clock advancement. Asset loading is asynchronous and atomic, with prior running play continuing until successful replacement.

Five live simulation tests and three browser flows cover these transfers,64-source irrigation, malformed input, retained setup, clock wrap, no startup RNG replay and exact native continuation. The previous decoder-only browser limitation above is historical; these new checks exercise actual file import. Full warm restart remains next. Its partial reset/setup/main chain must be composed from recovered writes, not replaced with a fresh cold farm.


## Restart audit: additional direct writes

Review of402a8..4094d confirms the following phases for the next composition. They are source evidence, not a newly exposed restart command:

- 403a4/403ae mask terrain and overlay high bytes withc7/87 across all96×96 cells. Subsequent terrain generation replaces the map; the masks alone do not constitute regeneration.
- 40594..405b9 clears all192 irrigation registry bytes. 40641..40665 clears FIFO read/write indices240c/240e, active2400, phase2425 and count240f. The native bounded FIFO should therefore be emptied at this phase. Delay2402 is not assigned here. The later setup caller3fa90..3fa9c sets irrigation lastTick to animationTicks; this differs from retaining its old timestamp indefinitely.
- 405fc invokes traffic reset0xd2be, clearing record flags/count while retaining other bytes and traffic clocks. Main2560..258e later allocates eight cars after weather; it must not substitute a fresh zero table for this partial reset.
- 40304 re-enables disaster entry6995. It is not a write to disaster flags6996, and the reset's1ed0/1ed4 stores must not be mislabeled as those flags. Full subordinate-call and setup-state review is still required before choosing which effect/forecast globals survive the complete restart.
- 4072b writes equipment pacing2;407c1/407c9 reset timer/animation words. Calendar main2343 still replaces the intermediate fixed1992 date for non-loaded chooser returns. Main24ef advances the retained forecast through1e63c; a fresh weather object would silently clear unrelated globals.

Full composition still needs explicit ownership of retained terrain RNG history and raw setup fields for every origin, forecast/reset ordering, source menu pacing and generated-versus-loaded chooser outcomes. The current generated setup archive is historical provenance, not a complete live DOS memory image. Keep these boundaries explicit rather than silently using cold defaults during a warm restart.

## Detached restart activity phases

`resetSetupActivity` now ports the direct activity writes from402a8..4094d on detached map/irrigation/traffic/weather/effect owners. This is an intermediate reset, not a complete playable farm. Existing record/account reset helpers remain separate. It validates map words/attributes, active irrigation/traffic/effect bounds and climate-year indices before returning; rejected inputs never mutate the old owners.

| Owner | Direct reset | Deliberately retained in this phase |
| --- | --- | --- |
| Map | Terrain word ANDc7ff, overlay word AND87ff for all9216 cells | Other bits, low image bytes and attributes; subsequent generation remains separate |
| Irrigation | All192 source bytes, count, active flag, phase and native FIFO cleared | Delay and lastTick |
| Traffic | All16 flag bytes and active count cleared through0xd2be | Seven other bytes per record, delay and lastTick |
| Weather | windYear4092, temperatureYear4277, precipitationYear4185 become0 | Forecast buffers, moisture accumulator, current wind, anomalies, precipitation-active state and other globals; annual-reset precipitationDays remains the financial reset helper's write |
| Disasters | enabled6995 becomes1 | Flags, positions, frames and timestamps; this is not proof that every later callback leaves effects untouched |

Selector words at initialized DS cd82/cda0/cdca resolve to2d9f for map/registry stores; cdd2/cd90/ce58/ce5a/ce5c resolve to6190 for runtime and climate-year stores. The source tests pin these segments as well as instruction bytes, avoiding an assumed shared ES segment.

`synchronizeSetupIrrigation` separately implements3fa90..3fa9c: assign lastTick from the current animation word after the chooser returns. A loaded chooser outcome can have replaced this word, so synchronization must not be folded into the earlier zero-timer reset. It changes no delay, registry or wave members.

`initializeStartupWeather` implements main24ef..2532 on retained weather: call forecast1e63c, then assign temperature table[0] and signed-byte display temperature plus one bounded5 draw. Forecast copies407f..4085 into4078..407e before generating a new next week. If retained accumulator23fe crosses±8, it applies signed/clamped soil change and redraws grass on the current map before clearing the accumulator. Wind, anomalies and precipitation-active globals are not cold-initialized by this phase. Cold `initializeWeather` now delegates the same startup phase after constructing its existing fresh defaults; cold results remain identical. SF-150 records the potential cross-farm carry-over and limits of the complete-caller evidence.

Five new tests pin source hash/instructions/segment selectors, exercise all original maps and every high-byte mask value, retain inactive traffic data, clear a64-source active irrigation wave, verify repeated reset and detached copies, reject malformed inputs atomically, and verify clock boundaries plus retained forecast/moisture and exact RNG consumption. These phases are not yet wired to a browser restart. The live creation/import browser regressions protect unchanged cold startup after extracting the common weather phase. Canonical warm reset still needs raw/terrain-history ownership, record/account composition, chooser outcomes and full callback ordering.


## Calendar timestamp correction

Calendar0xc8a9 reads animation word13a0, subtracts retained1f8e at0xc8ad, and compares delay1f8c at0xc8b1. After the day,0xd175..0xd179 writes13a0 to1f8e. Machinery dispatcher0x14a4c instead reads139e. The SSM loader separately addresses13a0 at45fe3 and139e at45ffb, from offsets216f7 and216f9. The eight supplied SSMs happen to store equal words, so an equal-counter fixture cannot distinguish them.

`transferCalendarPhase` now preserves `(oldAnimationTicks - oldDayTicks) & 65535` across a replacement of the animation word. It validates all three words and retains unsigned wrap/overdue phases. Original import uses this helper; changing only the loaded machinery word no longer changes the calendar phase. A future restart can pass replacement animation0 after407c9, without assuming the retained last-day timestamp is also0. This helper does not implement the restart caller or replace the native scheduler's documented>=delay pacing with DOS interrupt timing.

This corrects a native importer bug and earlier misleading equipment/calendar labeling, not an original defect. Source hash/opcodes, rewinds/zero resets/word boundaries, unequal native and SSM words, day advancement, unchanged old session and exact checkpoint restoration are covered by three new unit cases and one browser flow. Existing native saves continue from their stored phase without retroactive recomputation; no schema change or original bytes are modified.

## Canonical generated restart and v19 setup ownership

`GameSimulation.restartGenerated` now composes the represented generated outcome into a detached playable candidate. It uses the retained RNG streams and terrain history, partial record/account/activity resets, selected terrain generation, property/town construction, injected main calendar, default CRPs/planner/history, retained weather and eight traffic allocations. Final native validation checks assets/state before returning a replacement; failures leave the previous simulation untouched. No browser button calls this operation yet.

The phase order follows402a8 →4060c →3f854 → main2343 with the generated return. Region type/owner reset precedes terrain generation. Record scratch is fully overwritten with word209 at4093b before planner construction. Reset-to-zero animation407c9 preserves the old last-day timestamp through the calendar adapter. Post-chooser3fa90 sets irrigation lastTick to this reset animation counter; town3fab0 sets active coordinates and rawFedd0. Main2347 replaces the intermediate1992 date; default crop/history phases run because the outcome is generated. Weather24ef uses retained forecast/moisture before traffic2560..258e. Worker/building ledgers, report totals, unreset account/record bytes, traffic payloads/clocks, animal cache/clocks, weather and effect members omitted by the recovered resets survive in their existing owners. SF-042/065/150 retain the confidence limits on original visible effects.

The small address-named raw setup object is taken from retained setup when present. Without that archive, its initial EXE values are safe inputs only because reset overwrites every represented member exceptFedd, which town construction then overwrites. This is not a general permission to replace unknown live scratch with cold defaults. The last original file is archived byte-for-byte when generating a replacement map. V19 supplies a separate live terrain-history owner; older original-only checkpoints explicitly lack that history and reject retained generation instead of deriving a guessed past from current RNG. See native-save.md.

**Remaining source-sequence gap:**3f854 calls4027e →3fe1a for preliminary terrain before opening the chooser. The current native cold and restart factories generate one explicitly selected landscape; they do not simulate that preliminary preview, user rerolls, DOS interrupt time or nested-menu callbacks. Original cold native entry therefore captures the history of its explicit seed without pretending a DOS preview already ran. Retaining/advancing that history makes native continuation exact, but does not establish an identical original landscape or RNG state for a complete DOS UI session. Effect retention reflects the audited phases, not a completed audit of every intervening callback. These policies are provisional and documented, not recovered source behavior.

The loaded-preset restart outcome, preliminary preview/reroll lifecycle, exact menu pacing and browser restart/default wiring remain next work. The current custom/geographic UI keeps its cold-entry behavior until both outcomes can be supplied coherently. Tests verify all eight original-to-generated transfers, nonzero retained ledgers/unknown bytes, malformed input atomicity, repeated restart/import/checkpoint sequences, and a positive plant–grow–harvest–store–sell cycle. Browser checks load the resulting checkpoint and compare exact subsequent days/downloads, including missing legacy history. They do not claim a live restart dialog or complete original interface.
