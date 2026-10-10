# Original AIRPLANE window and parked-plane entry

SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All executable addresses below are file offsets. Initialized DS maps to file846f0; overlay5 starts30670. Evidence is static byte/disassembly analysis; no DOS/x86 emulation was used. Purchase, service and flight rules remain in [aircraft.md](aircraft.md).

## Descriptor, artwork and controls

Descriptor DS658c has flags0061, position192,160 and dimensions256×192. Its title points to DS64a6 `AIRPLANE`, artwork to DS64af `airpwndo.bmp`, and controls to DS6576. The sixteen-pixel title leaves a256×176 bitmap client. The native shared wooden titlebar remains movable, with actual React text. The generated image removes only five text rectangles; Gas/Spray/Damage/FLY!/CLOSE are HTML text. The artwork is22536 bytes, SHA-256 `0704617f6eaf1098f8ccaa2e9286da88a14df4413b436075e25cbca768b99b67`. Import validates its dimensions and reproduces every unmasked pixel.

The eight22-byte control nodes at6576,6560,654a,6534,651e,6508,64f2,64dc form a bounded linked chain. Source y includes the title; these are client coordinates:

| ID | Action | x,y | Size |
|---|---|---|---|
|1|Fuel|21,3|38×38|
|7|Load|21,58|38×38|
|8|Repair|21,113|38×38|
|2|Pesticide221|197,5|38×38|
|4|Herbicide222|197,45|38×38|
|3|Fungicide223|197,85|38×38|
|5|FLY!|197,125|44×20|
|6|CLOSE|197,146|44×20|

Button callback308d4 uses switch30d88/table30d96. Chemical handlers30a08/30a7e/30ae4 choose221/223/222 respectively. The selector is the existing canonical shared state, not a per-plane React value. Fly begins at30b4a, prepares/closes the window and reaches flight30f70; close begins30c7e. Native Fly retains captured map dimensions, existing service preflight, flight rules, controls, engine PCM, calendar suspension and saved continuation.

## Gauges and quotes

Paint30670..308b1 reads condition byte17, fuel word20 and payload word32. Event17 draws48×24 frames from `fldgrph.til` through4a196. Fuel at306ea and payload at30732 divide by52 and add10; damage at3077a divides by52 without the addition. Client destinations are104,16;104,64;104,112. Thus255 supplies selects14, not15;255 damage selects4. The native display preserves all thresholds. Out-of-range supplies receive no gauge/quote, with the existing invalid-supplies message and transaction guard; corrupt words cannot index outside the atlas.

Fuel price at307b8 is low16((255−fuel)×DS65f6), initialized rate1. Payload price at30802 is low16((255−payload)×floor(shared chemical price/10)); repair at3085b is low16(condition×signed DS65f8), initialized10. DS64bc/64bf/64c2 are `%u` strings. Prices draw at client24,44;24,99;24,154. Quotes are visible even when unaffordable. Native payload text deliberately uses the full actual debit: source payment30cda uses both product words, unlike its displayed quote. This display correction is retained as SF-163. Other arithmetic and payment/refund behavior are unchanged.

Pinned byte ranges:

| Range | SHA-256 |
|---|---|
|30670..308b2 exclusive|49357293979dcb882e168c691283720e8abe0d4b8364e728bad125e6088d1cc2|
|308d4..30dc6 exclusive|d79669aa95c0df925307de67772ce5b968262dcf45f6fe3a0ce32bb7bbfaa241|
|257b0..25863 exclusive|e451419fe9ccf7a58166081e70217fc745d1d537ddafb59ba6359991746f57cf|

## Entry and native presentation choices

Shared map handler257b0 recognizes terrain71/72/111/112. Lookup257d1 calls0d5f:000e (filef7fe), the existing first-active-footprint equipment lookup. Zero still consumes the press. Nonzero stores selected slotDSfa46, records clicked region, and opens descriptorDS658c at25804. Native bounds lookup and additionally requires type8 before showing aircraft controls; orphan parked graphics consume the press without issuing a farming command. Existing coherent-home/parking checks still gate services and takeoff.

Primary map selection and secondary press now use this entry. Construction checks it only on the initial press, before entering the held stroke. The primary Bulldoze bypass at255e8 is retained; secondary entry is independent of tool. Selecting/closing/moving a window preserves active tool drafts and never changes simulation checkpoints. React owns only the selected plane and window position. The source's transient region globals are not invented as saved financial state; flight already derives its canonical home from the aircraft record.

The interim disclosure/purchase form is removed. Purchase is **Buy → Machinery → Crop Duster → BUY**, using existing canonical airport/parking/cash rules. **? → Aircraft** remains an access shortcut; clicking a parked plane is the direct game interaction. A small native footer provides Show on map, a selector when multiple planes exist, transaction/error feedback and no-plane instructions. It extends the original client height without moving/scaling its controls. Exact quantities are also accessible meter/status text. Disabled unaffordable/unneeded services, keyboard focus outlines, persistent dragging and the footer are explicit native usability choices. Source click.voc callback3099a and exact cross-window/audio arbitration remain future work; this increment does not claim complete window-manager or aircraft fidelity.

Four unit cases pin the descriptor/control chain/code, compare every imported pixel, reject malformed dimensions/truncation, enumerate all byte gauge thresholds and2048 tile IDs, check map bounds/orphan/type/first-record behavior, read-only saves and full-width quotes. Browser checks cover original geometry and all three rendered gauge frames, actual text, movement/reopening, both buttons and zoom levels, multiple aircraft/shared chemicals, exact service costs/refunds/repair age, canonical saves, failed purchases, takeoff/flight/crash/repurchase and audio lifetime. The broader native game reconstruction remains incomplete.
