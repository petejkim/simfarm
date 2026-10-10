# Roads, fences and gates

Source: supplied SIMFARM.EXE, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are executable file offsets. Initialized DS base is0x846f0; overlay tile/count tables use filebase0x4ec60. `src/simulation/network-placement.ts` implements the isolated purchase and gate-state rules. Canonical `network` commands now run these rules through GameSimulation. Farm controls → Roads & fences and the same Map tool expose purchases and gate operation. Quotes/previews are read-only queries against detached snapshots. React owns only navigation and the selected action.

## Placement and accounting

The shared one-cell loop0x24196 auto-clears at0x24224, rejects town overlay0x4000 at0x24274, and rejects terrain occupancy0x0800 at0x24295 except for the separate ditch tool. Road/fence/gate branches bypass the generic ownership check0x24ad5. Only the fence branch explicitly requires ownership. Native preflight preserves the existing SF-095 correction: failed operations do not clear terrain or spend partial charges. Trees535..538 cost25 in worker expenses;131..146 require25 available but clear freely. Restored grass uses signed soil moisture and attribute>>>2. Unknown high terrain bits, overlay and attributes remain intact.

| Selected terrain | Source branch | Eligible terrain | Definition / original price | Result |
| --- | --- | --- | --- | --- |
|161 road |0x244e8..0x24587 |15..31 inclusive |288 /20, DS73ca |161+connection shape |
|150 road |0x2461a..0x24699 |15..31 inclusive |293 /30, DS7424 |150+connection shape |
|Either road |0x24588..0x24618 |87..109 or39..69 inclusive |301 /40, DS74b4 |172, repair road neighbors |
|177 fence |0x2480e..0x248ab |15..31 and overlay0800 |297 /50, DS746c |177+connection shape |
|188 gate |0x248ac..0x249a7 |Straight fence177 or178 |303 /75, DS74d8 |188 or190 respectively |

All eight supplied farms have these prices. The current saved definition price, zero-extended from16 bits, is debited via category−1 into annual other expenses DS3eac; price equality succeeds. Counts, inventory slots and definition bytes do not change. Clearing posts separately to worker expenses. Both expense accumulators wrap32 bits. No RNG is consumed. Roads cannot replace existing roads as a style upgrade. Gates cannot replace corners/junctions. Neither roads nor gate insertion require ownership in their specialized branches. Crossings preserve existing water flags without adding one, repaint center172 regardless of approach, and repair only road neighbors. Inclusive endpoints69/109 are retained and documented as SF-135.

Original strings “Paved Road” and “Dirt Road” occur at0x4f21e/0x4f248. Inspection of the decoded original scenario4 atlas identifies the gray paved family150..160 and brown dirt family161..171. Live labels use those names; internal tool identifiers retain the terrain bases. Browser tests compare the resulting pixels directly with decoded original ega16til.til bytes.

## Connections

Helper0x24e9e paints a center then repairs eligible neighbors in N/E/S/W order. DS59c4 contains16 word shapes `[0,0,1,2,0,0,3,4,1,5,1,6,7,8,9,10]`. TableDS5696 contains road150/count11, fixed crossing172/count2, road161/count11 and sentinel−1. DS56c6 contains fence177/count11, fixed gate188/count4 and sentinel−1. Fixed flag0x20 preserves crossing/gate orientation. Each flexible neighbor retains its own base/style and high terrain bits. The shared `connectTerrain` uses the same tables and repair implementation as bulldozing/disaster damage. Native map edges remain bounded.

Corrected earlier evidence: boolean-mask helper0x24b54 scans at most4 entries (0x24cd1); packed-category helper0x24cf4 scans at most6 (0x24e7b). Both honor the sentinel. Parent repair visits only boolean-admitted neighbors; irrigation's fifth pump entry therefore still cannot contribute a connection (SF-094). This correction changes documentation, not the native irrigation behavior. Zero neighbor masks still skip repaint (SF-113).

## Gate interaction

Map handler0x255ca is called at0x20ab8/0x20e1a. Its gate branch0x25708..0x257ad increments188/190 to189/191 and decrements189/191 to188/190, preserving0xf800 flags. It has no shop payment, ownership, town or occupancy guard and performs no neighbor repair. The window dirty flag is set; helper0x9536 subsequently identifies building image ranges for the general interaction dispatcher. Gate state is encoded in terrain, not a new record. `animalCanWalk` already accepts189/191 and rejects188/190; the existing source machine route scoring has different gates (SF-008).

`setGateOpen` exposes explicit, idempotent native open/close over these verified pairs. Canonical commands retain existing town/default/flight modal guards. Original window pointer/event guards and held-button input timing are not claimed equivalent to browser controls. The preceding branch0x25616..0x25705 uses DS08ce=122 (valves) and changes field byte6 bit0 through an(x+1,y+1) lookup. Its four transitions are now recovered in [map-interactions.md](map-interactions.md), including SF-162; the broader flag meaning remains unresolved. It is separate from the gate branch and is not applied to gates.

## Verification and remaining work

Focused tests pin exact instructions and loop bounds, check all eight farm prices and unmodified source/account bytes, enumerate all2048 terrain IDs, cover every16 connection mask for both roads/fences, fixed neighbors, crossings, corners, town/occupancy/ownership asymmetry, unsigned65535/zero prices, equality, atomic auto-clearing, expense wrap and both gate orientations' actual livestock passability. Live tests cover every action, original accounting, detached feedback, no RNG consumption, modal guards, idempotent free gates and35-day paired continuation. Two Chromium flows verify direct navigation and map/review focus, source pixels for both roads/crossing/fence/open gate, audible placement, rejection boundaries, exact downloaded saves/reload and390px layout. Native v14 already stores the affected cells and ledgers; no schema change is needed. Feedback is transient and loading cannot replay purchase audio.


## Player controls and audio

Open **Farm controls → Roads & fences** or select the same **Map tool**. Choose dirt road, paved road, fence, gate, open gate or close gate. **Choose on map** focuses the viewport; **Review construction** returns to the panel. The explicit apply button shows the current price and any tree-clearing charge. Unsupported terrain, unowned fence land, town land, insufficient cash and non-straight gate locations receive specific feedback. The one-tile preview uses the same simulation quote. Construction success requests original ploptool.voc; failure requests uhoh.voc, matching the one-cell click loop0x24b1e..0x24b28. Gate open/close has no invented sound request. Native controls replace the DOS held-button/window interaction, whose exact timing/presentation remains a fidelity gap.


Right-button press now toggles gates directly on the map through the canonical free open/close command. The mouse queue proves event7's identity, and release does not retoggle. Valve map interaction has also been recovered, including the orientation-dependent field-flag write retained as SF-162. See [map-interactions.md](map-interactions.md). Direct road/fence/gate placement and source primary-button interception remain next.


The Edit palette now provides direct road/fence/gate click-and-drag construction through these canonical rules. Ditch/valve construction shares the pointer lifecycle, and initial primary presses preserve the recovered gate/valve interception. The older forms remain alternate access. See [direct-construction.md](direct-construction.md) for source palette IDs, held-loop evidence, audio and explicit browser input adaptations.
