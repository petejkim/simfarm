# Original Disasters dropdown

Source: immutable SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets unless marked DS. Only static disassembly and original data decoding are used; no executable code or DOS environment runs in the browser.

## Source dispatch and state

Descriptor DSa650 gives header288,0,72,16 and popup288,16,104,88. The linked items are Tornado, Locusts, Drought, Flood, Frost, Windstorm and Disable, with12-pixel row pitch. Their decoded source labels are actual React text. The native dropdown retains this1× layout and does not add the interim panel's crop-circle/toxic-land controls to the original menu. Active-event details and explicit Locate remain temporarily available through Edit tools → Disaster details. Crop-circle/toxic-land buttons have been removed after the [trigger audit](disaster-trigger-audit.md): circle input is debug-only and no ordinary toxic-mode caller was proven. The six duplicate ordinary start buttons and Allow new disasters checkbox have been removed; original menu choices and Disable now provide those player interactions exclusively.

Stub24e6:1348/file283a8 dispatches overlay18:0000/file3e3b0. Table3e448 has seven16-bit targets relative to3e3b0:

| Item | Branch | General start mode | Active mask |
| --- | --- | --- | --- |
| Tornado |3e3c0|1|01|
| Locusts |3e3e2|4|20|
| Drought |3e3f2|2|02|
| Flood |3e414|3|04|
| Frost |3e418|5|10|
| Windstorm |3e41c|6|08|
| Disable |3e420|none|inverse enabled6995|

General start is24e6:1096/file36574. The native canonical disaster entry already implements these events, their price callback, eligibility, source RNG, damage, animation, audio and save continuation; this increment routes the original menu into those systems. The existing normal start-disaster command and automatic weather/calendar starts retain their disabled gates.

Disable XORs byteDS6995 at3e424, XORs a copy with1 at3e42e and stores that inverse to the selected node's check byte+12 at3e433. It does not invoke any stop routine or clear an active flag. Native Disable toggles canonical enabled only. Current events continue damaging/expiring normally; their checked marks remain independent of Disable. Selecting a checked event is another start request, not a stop action. General callback rejection/repricing therefore retains its existing source rules.

## Input and SF-171 correction

Popup input3f114..3f1b6 subtracts20 from y, divides by12, follows the selected menu's linked item list and calls descriptor+26 at3f1b1 with the ordinal and node. It does not test DS6995 or node flags before dispatch. This resolves the previously deferred SF-171 input audit: the popup accepts selections while disabled. Rendering3f3a2 uses node+12 bit0 only for the checkmark.

Tornado and the four stationary/water/wind entries invoke the guarded start **before** setting6995=1 and checking the chosen item. A disabled start returns0 immediately at36580..3658b, but those menu callbacks still check it and clear Disable. Locusts uniquely tests the start result at3e3eb and leaves these stores alone on failure. Thus source checkmarks can describe events that did not begin.

The native disaster-menu command deliberately enables before attempting an explicit menu start, making a first valid selection actually start the event. Checkmarks derive from actual flags, never from an optimistic UI store. A failed Locusts request preserves its previous enabled state, matching its source failure branch; no-fields or tornado-active failure produces actual HTML feedback in Edit's footer. Repeated active choices do not stop events; repeated Locusts failure also preserves Disable. Invalid menu actions fail before state mutation. This is an explicit correction, not a claim of byte-identical defective source behavior. SF-171 retains the original evidence.

## Ownership and limits

GameSimulation owns menu enable/start behavior and publishes snapshots/events. React only renders checks, dispatches the command and displays feedback. Viewport, artwork, messages and MIDI/PCM remain separately owned. No native checkpoint schema changed: v25 already stores enabled, flags, clocks, effect coordinates and RNG. Load/snapshot reads do not repeat starts, damage or one-shot navigation/audio. All24 crops and the user's native speed slider remain unchanged.

Pending town/default decisions and aircraft flight keep all seven menu commands disabled and canonically guarded. A fully disabled popup can still receive focus and close with Escape; File remains accessible during existing nonmodal decisions. Keyboard arrows/Home/End, Enter/Space, Escape and outside click are browser affordances. No mobile rearrangement is introduced.

Original disaster notification popup interiors are still unfinished: Messages currently controls the existing native disaster notice text. The source uses events.dat48..58 and common Message artwork, distinct from this menu. These interiors, exact event-phase suspension and broader event scheduling remain next work; restoring the dropdown is not completion of the whole game.

## Evidence and verification

| Range, end exclusive | SHA-256 |
| --- | --- |
|3e3b0..3e482, callback/table|8d5b75fe5d8fd09a9f3f24e2c4144f1c6177cf8d989bbcd3d0fdc262cfd60086|
|3f114..3f1b8, input|a9e62ae4bc0a296884a47f704b45f9bab9d029113294627a9f179803b3e8183b|
|36574..3658c, disabled gate|3e871a61ecdecc204f276ced0d4896b59d4821a9877d55858011f364590eed15|

Confidence high for menu geometry/order, call modes, ungated input, enabled/checked stores and the source mismatch. Browser enable-before-start, canonical check projection, accessible keyboard control and interim failure feedback are explicit native policies. Unit checks pin bytes/table modes, all256 low flag combinations with both enabled values, all six actual start effects from enabled/disabled states, exact saves/events/no replay, ongoing disabled damage, failed requests and town/default/flight guards. Browser checks cover real text/layout/checks, keyboard/focus, all six manual actions, disabled active damage, failed locusts, natural ending, unchanged saves and retained detail-panel access. Reviewed artifacts/browser-disaster-menu.png at1×.
