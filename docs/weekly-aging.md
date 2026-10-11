# Weekly equipment and chemical aging

Static source: SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets; initialized6190 data starts at0x846f0. No executable/emulator is run.

The weekly dispatcher0xbe4d calls0xbf02. Its record order is equipment, buildings, chemicals, animals, inventory. Buildings/animals/inventory were previously connected; these two remaining primitive phases now use their original retained bytes and the existing financial/clearing operations.

## Equipment prefix0xbf02..0xc02d

For each active equipment slot1..126,0xbf2f increments word+18 with16-bit wrap. Above4,0xbf43 calls0d5f:2182 =0x11972 with amount1, then clears the counter. The existing wear helper adds(counter>>2)+amountByte to condition byte+17, saturated at255. Thus an ordinary five-week interval increases wear by2. Stored, reserved, working and rented records all age; no RNG is consumed by this prefix.

Condition255 and rental flag64 clear qualify for action2 at0xbf8c. Stub0x28042 dispatches overlay27 entry0x0fcc = file0x4c41c, the existing asset-sale routine. It rejects reserved/field-work flags9. Success credits definition price>>3 through the sale accounts, decrements the owned count and equipment book value, and removes storage/terrain/aircraft-home references. No extra destruction charge is invented. Native retains the existing preflight for corrupt counts/storage and linked equipment (SF-027/057); a rejected sale leaves the machine active and its elapsed wear intact for later retry.

After success,0xbf99 requests DS1fae `explode.voc`, even for a stored machine. If the prior location intersects a building,0xbfb8 skips outdoor cleanup and source notice73. Otherwise0xbfc7 gets the equipment footprint (definition dimensions, swapped for directions2/6) and0xbfec queues clearing for every cell in x-then-y order. Notice73 follows at0xc00c. This wrapper does not credit the sale a second time. Native prepares the additional clearing bounds before a sale, including aircraft's potentially distinct rotated footprint.

The source loop compares processed count against the live equipment count after deletion. Native visits the bounded initial active slots so one sale cannot skip later records (SF-059). The shared64-slot clearing ring retains its original replacement/count behavior; existing SF-060/061/066 corrections and retained quirks still apply.

## Chemicals0xc110..0xc13d

DS:c674 initializes to2d9f. Active flag32 at record+2 gates word+10 increment0xc120 and byte+9 increment0xc125. Both wrap. Helper0x1454e reads byte9 at0x14562 and returns condition band3−(byte9>>6), while returning the definition price without scaling it by condition. Consumption0x146e0 consumes one record regardless of this byte. Native aging therefore neither reduces treatment strength nor discards old chemicals or invents a fee. Unknown bytes remain untouched.

Byte9 wraps from255 to0 after another week, restoring the best displayed band. Word+10 wraps from65535 to0. Chemical allocation0x14590 initializes word+8 (including byte9) but does not initialize word+10, so the latter must not be presented as guaranteed elapsed time since purchase. These arithmetic/initialization observations are retained under SF-104; no vulnerability is inferred.

## Native implementation and validation

`weekly-equipment.ts` composes existing wear, sale, aircraft/storage cleanup and clearing functions and returns detached sale/deferred metadata. `weekly-chemicals.ts` updates only the two recovered fields. Native v10 already persists the record bytes, accounts and clearing ring. GameSimulation now runs both phases at their exact weekly positions, before wind/gestation and calendar rollover. React exposes a Machinery panel with owned/rented counts, wear percentages and transient sale/deferred messages. Percentages are a native view of condition/255; they do not alter wear or allocation rules. Stored sales receive readable native feedback even though source notice73 is limited to outdoor removal. Sound requests are emitted after successful sales, independent of mute state. Loading clears presentation history while retaining every canonical byte/account/clearing entry.

Seven tests pin source instructions/dispatch/string bytes, all eight original farms, five-week/wrap boundaries, rentals/storage/work states, every ordinary equipment type and rotation, cash caps/wrapped accounts, multi-sale traversal, malformed removals, every chemical condition byte, unchanged application cost and complete saved continuation.

The original `explode.voc` archive member at2157593 is12769 bytes, SHA-256 `1156a56ebd0d8bc2cd598d2ad91b6fb9d9f00b5c82db0a8c9f5bc065dd29c59f`. Its single type1 codec0 block contains12736 mono U8 samples at1000000/181 Hz. The existing local importer already extracts it. A decoder test compares every PCM sample; browser checks verify audible output, clearing tile664, sale feedback, a deferred busy sale and exact saved continuation. Two live tests cover weekly composition, pause/default suspension, detached transient notices and clearing completion.

Manual machinery purchase and livestock/equipment sale commands are now live; aircraft repairs belong to the separate aircraft service path. Manual relocation/removal interactions, original sound arbitration, disasters and other game systems remain incomplete. The panel uses neutral machine identifiers where original equipment names have not yet been recovered; it does not invent a source naming table.

## Original outdoor-loss status restored (2026-10-11)

Machinery inventory retirement exposed a missing original presentation path. Rechecked0xc00c..0xc015: `6a49 9ab42b751d 83c402` pushes73 and calls1d75:2bb4/file22504, the existing quick Edit history writer. This is not a modal Message. SHA256 of0xc00c..0xc016 is `ba0ad6f1cadd4306b6e89c8d37eb1a314b80b504b1c8aaf6dbc586a8c1482d6e`. Archived qmessage.dat record73 at0x1240..0x127f reads “A piece of machinery was lost.”; record SHA256 `7ed02f1bf088404ff1124862ecfabf8d9cb3592ff8ef2e7693b600cac34ec5cc`. Confidence high: caller bytes and the already verified22504 writer/64-byte text format agree.

GameSimulation now appends73 after a successful outdoor weekly sale. The0xbfb8 stored-asset branch skips outdoor cleanup and this status, while retaining explode.voc. Deferred/busy sales add no loss status. History uses the existing duplicate suppression, real HTML text and transient load-reset behavior; no save or financial rule changed. Unit checks cover outdoor/stored/deferred paths, source call bytes and exact continuation. Browser checks verify source text/history, audible explosion, original clearing pixels, reload reset and no busy-sale loss message. This fixes a native omission, not an original defect.

The diagnostic Machinery panel remains temporarily; its original outdoor notice is now restored, and original Examine/Sell provide condition/value/ownership eligibility. Next retire that panel and its duplicate Move shortcut without preserving native wear-percentage/deferred-sale prose as original UI.
