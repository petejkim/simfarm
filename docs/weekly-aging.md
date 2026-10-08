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

`weekly-equipment.ts` composes existing wear, sale, aircraft/storage cleanup and clearing functions and returns detached sale/deferred metadata. `weekly-chemicals.ts` updates only the two recovered fields. Native v10 already persists the record bytes, accounts and clearing ring. Live calendar and React feedback are the next increment; these primitives alone do not change running gameplay.

Seven tests pin source instructions/dispatch/string bytes, all eight original farms, five-week/wrap boundaries, rentals/storage/work states, every ordinary equipment type and rotation, cash caps/wrapped accounts, multi-sale traversal, malformed removals, every chemical condition byte, unchanged application cost and complete saved continuation.
