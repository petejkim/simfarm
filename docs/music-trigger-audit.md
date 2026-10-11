# Situational music and town events

Static evidence uses SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets unless qualified. Reproduce with `.venv/bin/python tools/audit-music-triggers.py`; ignored `artifacts/music-trigger-audit.json` includes exact source strings and range fingerprints. No DOS execution is involved.

## Direct filename requests

The literal far call to resident `212a:0682` (file `23b22`) has eight occurrences. Every occurrence immediately pushes DS and a filename offset:

| File call | DS filename | Track | Current native coverage |
| --- | --- | --- | --- |
| ca7b | 2060 | carnival | Missing fair interaction |
| cb57 | 2078 | rodeo | Missing rodeo interaction |
| 1f147 | 454c | dfarm | Field/financial report |
| 1f174 | 4556 | ffarm | Field/financial report |
| 1f38f | 45c9 | cowman | Homestead upgrade |
| 3676a | 69e2 | alien | Crop circles |
| 3eaf8 | a8a2 | genfarm | Options Music enable |
| 40e15 | a9cc | amain | Source lifecycle still unclassified |

This list is exhaustive only for that literal far-call encoding. It does not exclude segment aliases, indirect calls, near loader calls or sequence changes. The helper checks Music enabled DS5741 and another audio capability pointer, compares the filename with DSd0d6 on one playback-state branch, stops/reloads as needed and starts an XMIDI sequence. Full playback-state and sequence-control fidelity remains unaudited. Native track selection does not disable future automatic requests. XMIDI internal loop fidelity is separately incomplete; see reverse-engineering.md.

## Calendar entry and choices

`c88e` advances the day, calls the daily update, and on the seventh day calls weekly routine `bdbe` at `c90e`, resets day and increments week at `c920`. The event checks follow, **before month normalization**. Fair checks `(month-9)*4+week == 0` at `c9b0..c9c7`; rodeo checks `(month-6)*4+week == 0` at `cafc..cb13`. For valid calendar input these are September week3→October week0 and June week3→July week0 boundaries, not every day in those months. Preserve the pre-normalization ordering rather than testing an already advanced month plus incremented week.

Both branches require Messages `6190:a8a1 != 0`, then call `d9b2` with mode2 for fair or mode1 for rodeo. This helper immediately fails when recreation count `6190:9cbc` is zero. Coordinates `2d9f:f7aa/f7b2` and their SSM provenance are documented in town.md. It is not merely a predicate: it restores earlier event terrain, loads mode-dependent recreation artwork from `twnevent.til` (DS2094), and stores current mode DS1ed2. At `db55` the selected bank starts at mode*0x1180; the read is0x1180 bytes, and35 tile entries are uploaded at `db98..dbd6`. Exact native artwork integration remains required.

Fair `c9eb..caf9`:

- Zero livestock count `6190:230c`, or failure to afford200 through `1a66:0006`, selects announcement “The town fair is starting!” and animal/type sentinel DS1ed9=ff.
- Otherwise `0f87:1b2a` selects an animal record; its word at+6406 minus160 becomes DS1ed9. Selection at1359a..135f7 draws below the active livestock count through05fd:00a3, scans records from index1, counts only flag0x20 and returns the chosen ordinal. It does not filter by species, age, condition or storage. The native implementation must bound this count-driven scan (existing SF-059 hazard). Seven-byte text records at6190:22a0/22bc supply species/name substitutions; the complete source prompt and200-dollar fee are captured by the audit.
- `carnival` is requested **before** the dialog, including the announcement-only case. Message portrait74 uses button IDs1/0 for announcement or11/12 for entry choice.
- Entry result zero attempts a200-dollar category−1 debit (`cad3..cae3`). Nonzero debit result stores participation DS1ed0=1; declining clears it. Announcement and failed-debit paths do not explicitly clear that word. Countdown DS1ed3 becomes3.

Rodeo `cb34..cbae`:

- Affordability checks1000. Failure stores event mode zero and skips music/dialog/countdown, despite the earlier artwork helper. See SF-174; do not silently substitute500 for this source threshold.
- Success loads `events.dat` record61 (`cb45..cb50`), requests `rodeo`, then opens portrait74 with button IDs11/12.
- Choice result zero attempts500 dollars/category−1; a nonzero debit result stores DS1ed0=1000. Declining clears participation; failed debit leaves its previous value. Countdown becomes2.

## Later outcomes

Weekly routine `bdbe` calls `dbe4` at `be96`, hence existing countdown resolution precedes the new event checks. `dbe4..dd3d` does nothing for zero countdown; otherwise decrements it and resolves only upon reaching zero.

For participation nonzero and mode1, `dc0c..dc15` draws the simulation RNG and wins when `(random & 3)==2`. Winning text says cousin Jed won500 dollars; the credit call `1a66:01c8` receives1000/category0, consistent with returning the500 stake plus500 winnings. Loss says the500 stake was lost. For participation nonzero, mode2 and animal sentinel other thanff, `dc84..dc8b` draws once and wins on low bit1. Success formats the animal name and awards1000/category0; loss formats its name without payment. After the animal result DS1ed9 is cleared toff. Common tail `dd34` calls artwork helper mode0. Complete reset, save/load and interruption behavior still need auditing; this document does not claim those globals are serialized.

## Implementation sequence and limits

Next trace event61 text/portraits, mode0 artwork/map restoration, all writes/initialization of DS1ed0/1ed2/1ed3/1ed9, and original save/load lifetime. Then implement the event state and calendar ordering in plain TypeScript, with bounded recreation coordinates and checkpoint continuation; expose source dialogs in React and emit MIDI requests at the actual dialog branches. Browser tests should cover entry/decline, Messages gating, no recreation, insufficient funds, delayed outcomes and load continuation. A calendar-only music switch would not restore the original interaction.

High confidence: pinned direct calls, gates, amounts, countdowns, random masks and strings. Unresolved: complete caller coverage, amain lifecycle, state lifetime and live event integration. No runtime behavior changed by this audit, and full native preservation remains incomplete.

## Recreation artwork decoder

`src/formats/town-event-graphics.ts` now exposes detached banks for modes0(normal),1(rodeo),2(fair), and a nonmutating atlas patch. Source pointerc682 selects2be7; initialized word2be7:0984 at file4f5e4 is483. Loaderdb55 seeks mode*4480, reads4480 bytes and uploads35 consecutive planar16×16 tiles to483..517. The resource has20480 bytes, SHA256 `533e3c7f544bfcd1b18752f3eff0f222771ca9bb2d21cd46e4b401844647aac2`; bytes beyond the three traced banks remain uninterpreted. Do not treat trailing data as padding or expose unproven extra event modes.

Local import emits ignored town-event-0/1/2.png contact sheets (seven columns,112×80); these are resource previews, not the recreation district's map layout. Actual map placement and transient atlas ownership still need integration. Tests compare every pixel in all105 tiles directly with source plane bits, pin source upload constants, retain all unaffected original/expanded atlas bytes and reject malformed resources/modes/atlas boundaries. Inputs including Bun Buffers are never aliased. Type checking/build and import pass; fair contact sheet was visually inspected. No browser behavior changes in this decoder increment.

## Recreation terrain and animation primitives

`src/simulation/town-event-map.ts` reconstructsd9b2..db51 terrain changes anddd3e..df46 animation. These are plain TypeScript primitives, not yet called by the live game. Artwork bank upload remains separate. The event's original state maps modeDS1ed2, last animation tick1ed4, shared phase1ed6 and position bits1ed7/1ed8.

For each saved recreation origin(x,y), outgoing rodeo clears terrain bit0800 over(x+2..3,y+3..4), retaining overlay words and other terrain bits. Outgoing fair replaces six complete terrain words. Requesting mode0 repeats that six-cell restoration in a second pass over all districts, after outgoing-mode cleanup. Source offsets relative to origin are(3,2),(2,1),(1,3),(1,5),(3,3),(5,2), with tiles492,484,497,511,499,494. Overlays/attributes are untouched. The helper does not reset animation phase, position or timestamp. With zero recreation it returns before changing the mode.

Animation requires nonzero recreation, mode1/2 and unsigned16-bit elapsed ticks>=8. Rodeo clears its old2×2 overlay visibility, increments the shared phase modulo4 **per district**, draws two simulation RNG bits for X/Y only on phase wrap, then always draws the sprite937+(random&7). It replaces only overlay low11 bits at the selected position, sets terrain0800 and retains other overlay/terrain flags. Fair draws once per district: low bit1 selects526,527,528,528,529,529 at the six positions; low bit0 selects492,484,497,511,494,499. The last two ordinary-frame tiles differ from cleanup; this is preserved source evidence, not assumed to be a defect. Both modes store the current tick after processing every district. No host randomness or browser timer owns this primitive.

Native validation checks all active footprints before writes/RNG, permits at most seven districts as the source constructor does, and ignores unused coordinate pairs. Malformed counts/coordinates cannot index outside the native map; see SF-047 follow-up. Tests pin the complete animation range fingerprint and key source instructions, cover all nine mode transitions, untouched cells/flags, both fair frames, shared multi-district rodeo phase/draw order, unsigned tick wrap, no-op gates and atomic rejection of malformed later districts. Live clock ownership, source transient state initialization/import and browser integration remain next work; no claim of visible event animation yet.

## Saved event state and original invitation

Paired saver44bc4..44c53 and loader45be6..45c75 establish eight bytes immediately after recreation countSSM21673. Both use identical sizes/order, followed by the separately recovered equipment account at2167c:

| SSM offset | Size | Runtime DS | Meaning |
| --- | --- | --- | --- |
| 21674 | 1 | 1ed6 | Shared rodeo phase |
| 21675 | 2 | 1ed4 | Last animation tick |
| 21677 | 1 | 1ed9 | Selected animal type minus160; ff sentinel |
| 21678 | 2 | 1ed0 | Participation word; fair1 / rodeo1000 |
| 2167a | 1 | 1ed2 | Current event mode |
| 2167b | 1 | 1ed3 | Weekly countdown |

`readTownEvent` decodes raw values without normalizing unexplained bytes or discarding dormant state. All supplied farms have mode/countdown/participation/type zero; SCEN5 alone has phase2 and timestamp49467. This proves that inactive mode does not imply fresh animation state. The initialized EXE data1ed0..1ed9 is zero, but restart stores and ordinary import must still be distinguished from cold data. The position bits1ed7/1ed8 are absent from this event save/load block; broader retained-state audit is still needed before choosing their import policy. In particular, the event fields are **not all transient** as the earlier investigation considered. Native checkpoint integration must persist the complete represented runtime state, including position bits.

`readRodeoInvitation` decodes events.dat record61 into actual text, using the shared source254-text-byte/256-record boundary and removing @ padding for display. It confirms a500-dollar bet with1000 dollars returned on a win, supporting the stake-inclusive credit interpretation. The1000 affordability gate remains a separate source discrepancy(SF-174). Unit tests pin both save/load argument sequences, all eight source farms, noncanonical raw values, byte-order/boundaries/nonmutation and the full invitation. No bitmap text or extra browser control is introduced.

## Decision-flow primitive

`src/simulation/town-events.ts` now implements the source entry/choice/weekly-result flow independently of React and the live scheduler. Entry explicitly takes pre-month-rollover month/week, returns artwork-bank and MIDI requests, and stores a pending original interaction. Acknowledgement commits fees or winnings at the source post-dialog point. Announcements retain prior participation; decline clears it; failed debit retains it. Weekly expiry draws only for an eligible participating event, pauses with the result, then acknowledgement performs cash credit and map cleanup. Participation is not cleared by cleanup. No active event, optional Messages suppression, pending dialog or missing recreation does not invent a music request.

Rodeo insufficient-funds behavior returns artworkMode1 while storing mode0, matchingcbae after the bank load; integration therefore must not derive the uploaded artwork bank solely from mode. This is the recorded SF-174 behavior, not an implementation fix. Prize category0 at1ca28..1ca7a jumps to the plain return1cb40: credit wraps unsigned cash then caps at9,999,999, without adding a sales/income ledger. Entry category−1 adds to annual otherExpenses with dword wrap. Tests verify source amounts, both random outcome masks, timing, announcement/decline/failed-payment differences, ledger wrap, cash cap and no repeated decisions/draws. Full live suspension and exact checkpoint serialization remain required; these primitives alone do not expose playable calendar events.

## Exact native event checkpoint codec

`src/formats/town-event-save.ts` provides a validated, detached encoding of event state plus uploaded artwork mode. Unlike original SSM it includes rodeo position bits and pending entry/result dialogs. The loaded bank may differ from event mode and is therefore independent. All fields are mandatory; unknown dialog kinds, invalid ranges and incompatible pending result/entry states fail instead of replaying startup or silently defaulting. Result checkpoints retain the already-drawn outcome, so loading never redraws or credits before acknowledgement.

Three codec tests cover every dialog kind, field requirements, invalid combinations and uninterrupted-versus-restored animation/RNG continuation between entry and result, including unsigned clock wrap and exactly-once fees/prizes. This codec is not yet connected to SimulationState/native-save version25. The main save migration must add calendar continuation state alongside it when the scheduler is wired; serializing a pending dialog without its interrupted calendar phase would be incomplete. No original-save position-bit retention policy is inferred from this exact native checkpoint codec.

## Live calendar continuation boundaries and restart evidence

The live GameSimulation weekly tail is now split at the original dialog-return boundaries without activating events yet. `finishWeeklyWater` begins at the work following weekly result callbe96(field-waterbea3); `finishWeeklyRollover` begins atcbb3 after optional entry dialogs, before town development and scheduled field orders. Existing monthly default and annual town-choice returns still terminate their own phase; finishDay executes exactly once. Event scheduler integration must save the prior normalized calendar, the selected continuation boundary and running state, rather than exposing temporary week4 as a native saved date.

Main tick tail still needs its own exact continuation when an event interrupts advanceDay: irrigation, animal frame, traffic and disasters follow the calendar, and recreation animationdd3e is called atbdb0. Resuming a dialog must not advance the timer or repeat equipment updates merely to finish that interrupted tick. Correction after inspecting dispatch: Next day also advances through advanceTick; advanceDay has no direct command caller. Every calendar event interruption therefore owns the remaining tick tail, without a separate direct-day case.

Additional source pins: initializedDS1ed0..1ed9 are ten zero bytes. Restart4063b zeroesAL; stores40679/406a9/406b1 clear mode/phase/species through pointers to6190. ZeroAX stores407b1 and40908 clear timestamp and participation. No countdown reset is established by these inspected stores; do not synthesize one from the fact mode clears. A bounded literal scan finds near calls to helperd9b2 atc9de/cb2a/dd37 and animationdd3e atbdb0, with no literal resident far alias call matching those physical addresses. This does not exclude indirect calls or bulk state writes; exact import artwork/position-bit retention remains under audit. The original ega16til tiles483..517 equal normal twnevent bank0 byte-for-byte.

## Version26 canonical event ownership

GameSimulation now owns a detached townEvent value, exposes a copy in snapshots and serializes it through the checkpoint codec. Version26 requires the field; version1–25 migration creates an inactive cold event instead of resurrecting original event bytes embedded in an old checkpoint whose simulation never advanced this subsystem. Direct cold SSM construction and geographic source setup decode the saved event fields. Ordinary source import transfers those fields into the prior runtime owner, retaining position bits/uploaded bank and clearing replaced-world dialogs. Fresh generated farms start from initialized zero event state; retained restart applies the explicitly recovered mode/participation/timestamp/phase/species zero stores while retaining countdown/position/bank.

These lifecycle operations are an incremental native mapping of known transfers/stores, not proof of all original renderer callbacks or bulk writes. Underlying original source bytes remain immutable. In particular uploaded-bank retention is tracked separately from world replacement; browser asset replacement still needs to consume it during renderer integration. Current version26 rejects pending event dialogs at both the top-level writer and loader because no calendar/tick continuation is wired yet. The standalone codec can represent them for upcoming integration; valid game-produced saves cannot contain one at this stage. Event countdowns and animations are not yet advanced by the live scheduler.

## Browser recreation-bank rendering

GameAssets now decodes the three original35-tile banks with each ofsimfarm/rainpal/frostpal palettes and registers them with the existing weather-variant cache. FarmView selects the canonical saved artworkMode independently from event mode. FarmMap passes that artwork into the imperative world renderer, which substitutes only terrain tiles483..517 from the seven-column bank; all other terrain and masked overlays keep their existing atlases and draw order. No atlas/canonical world mutation or React-owned simulation state is introduced.

Browser coverage loads all nine bank/palette combinations through File Load, independently decodes every source tile and compares actual canvas pixels. Adjacent tiles482/518 remain unchanged, full checkpoints survive viewing/reloading, and bank1 renders correctly while mode0(SF-174). The separate harvest-worker browser check confirms its frame animation/pause/reload remains intact. Screenshot browser-town-event-artwork.png is an explicitly synthetic contact-sheet arrangement at1× in the terrain, not a claim that those tiles form the original district layout. Event scheduling and dialogs remain unwired; renderer ownership now follows saved state when they are connected.

## Live recreation animation ticks

GameSimulation now invokes the recovered animation primitive after its represented disaster tick work, matching the sourcebdb0→dd3e tail position. Mode0 takes a no-op fast path; active mode uses the canonical event owner, animationTicks and simulation RNG. Existing pause, flight and annual/default modal gates also suspend these frames. No wall-clock renderer random state or animation hook is introduced. Constructor/current checkpoint read/write validate active recreation footprints before any live mutation; dormant source bytes are still retained.

Live tests compare a complete eight-tick simulation against an event-disabled control followed by the independently tested source primitive, including full state and RNG. Both modes preserve exact continuation over multiple frames after save/load, and malformed later district coordinates fail at the save/load boundary. Browser checks resume paused active-event fixtures through actual Play, compare rendered terrain/masked source pixels (masked atlas base848), freeze on Pause and restore the identical visible frame after reload. These are loaded-active-event fixtures; ordinary calendar entry/result dialogs and automatic event music remain pending.

## Original event message presentation

`src/ui/town-event-message.ts` maps canonical pending decisions to real text, portraits and explicit accept/decline buttons without changing simulation state. Initialized DS6190/file846f0 contains announcement1fba/2045, fair entry1fd5, rodeo win20a1/loss20cf, fair win20fe/loss212a. Four seven-byte species records at22a0 are Horse/Cow/Pig/Sheep; names at22bc are Rascal/Missy/Stella/Bogie. Fair entryca2b..ca56 formats name, species twice and200; resultsdc8d..dcb1/dcea..dd0e format the stored selected name. This is evidence for these message substitutions, not an exhaustive audit of writes to the string arrays.

Pinned call arguments: fair choicecab8 and rodeocb69 use button12/11 and portrait74. Rodeo windc21 uses button1/portrait75; lossdc50 uses button18/portrait76. Fair winnerdcc2 computes70+animalType; lossdd1b uses button1/portrait74. Visual inspection of decoded original buttons.til (ignored artifacts/event-buttons.png, all eighteen48×24 records in order) identifies1=OK,11=YES,12=NO,18=RATS. Captions become actual text; bitmap lettering will not be used. Results use the already-drawn pending outcome/type; rendering must never roll a new outcome or pay a prize. The rodeo win text describes500 net profit even though the source credits1000 including the stake.

Three new focused tests pin source executable hash, initialized strings and call bytes, exercise all four animal entry/win/loss presentations, sentinel/error handling, announcement and rodeo captions, and confirm presentation leaves pending state intact. Combined with state and decision tests:12 pass. Type checking/build pass. No live dialog is rendered by this increment, so browser verification remains required with calendar/modal integration.


## Live calendar, dialogs and MIDI (version27)

GameSimulation calls advanceTownEventWeek after the reported-field status/music phase (weeklybe96 boundary), before field-water work. When a result appears, continuation phase weekly-water retains the old normalized date and prior run state. finishWeeklyWater applies field water, exposes source day0/week+1 and calls beginTownCalendarEvent beforecbb3. Entry/announcement pauses at phase weekly-rollover. While paused, the public date is the normalized next day, dayTicks/elapsed are zero, daysAdvanced does not increment and unrelated gameplay commands cannot mutate the farm. Message-option changes retain the existing options policy; pointer input remains transient.

resolve-town-event performs the source decision/credit/cleanup once, clears the old continuation and resumes its saved calendar phase. finishTick resumes irrigation, animal frames, traffic/collision sounds, disasters and event animation without incrementing either clock or repeating equipment work. A result may open a new entry on the same boundary; its new continuation owns the same unfinished tick. Imported countdowns can also place a result at year-end: if annual collection opens a town choice, resumeTickTail transfers that ownership to the existing annual continuation. Terminal default still terminates the simulation. No independent direct-day path exists.

Version27 stores continuation inside townEvent; read/write validate pending/phase/date/run-state consistency, normalized calendar, zero fractional/day ticks, recreation presence and exclusive modal ownership. Version26 migrates with continuationnull while retaining mode/artwork/timing/species/participation; older versions keep the existing inactive migration. Source import/reset dismiss native continuations. Outcomes and artwork are canonical; transient MIDI requests are issued only at actual event entry, not replayed by checkpoint loading.

TownEventMessage uses the existing movable256×192 modal frame at192,150, original portraits and real HTML text/buttons. Earlier queued messages display first. YES/NO dispatch explicit decisions; Escape declines entry and acknowledges single-button notices/results. Modal browser input and canonical command guards both suspend other farm actions. Carnival/rodeo go through the existing MIDI request path and honor Music enabled. Visual checks inspected fair entry and rodeo loss; text fits within the original message area at1×.

Focused coverage: seven live calendar cases cover all entry forms, running/paused advancement, gates/decline, exact restored state, both results,2/3-week countdowns, chained decisions, annual-tail handoff, and malformed/migrated continuations. Three browser cases cover ordinary entry, actual MIDI playing status, canonical fee/save equality, modal pause, restored entry/keyboard decline and all four result branches. Two existing annual browser cases still pass. Milestone results: full unit run908 pass/8 fail across916 cases; full browser263 pass/8 fail across271. Legacy long-running/rollover scenarios now answer actual event dialogs; event-free crop-value goldens were updated for the source animation RNG. All failed unit cases subsequently passed in focused runs (30 related passes, one corrected fertilizer case, six loan cases), and all eight browser rechecks passed52.7s, including an unrelated terrain-menu timeout without a production change. Thus every case has passing coverage; neither initial full run was entirely green. Type checking/build/source audit pass. No production changes occurred during those regressions.

## Native startup priority

At the user's request, amain is the first sequence played per browser mount. Until its first successful playback, situational requests cannot replace it, including during fetch/unlock; an initially muted session also starts amain on first enable. Browser gesture requirements and saved mute preferences remain respected. Later events select their normal tracks; subsequent Options enable retains original genfarm. This is an explicit native startup policy, not a new claim about the unclassified source40e15 lifecycle. Internal XMIDI sequence loops remain a separate fidelity limitation.
