# Original crop market

Source: supplied `SIMFARM.EXE`, size0x917b9, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets unless explicitly segmented. These findings come from static code/data and independent arithmetic checks, without executing or emulating DOS. Confidence is high on the traced instructions and data locations; complete original loading/UI lifecycle remains unfinished.

`src/simulation/market.ts` now implements independent market state, crop-load history assignment, weekly history/trade updates and planting/disaster history callbacks. `src/formats/market-defaults.ts` decodes the original cold data. **These primitives are not yet connected to GameSimulation.** The live port still lacks weekly price updates and still applies planting/disaster adjustments directly to trade prices. Correcting those consumers, canonical ownership and native-save migration is the next increment. This document supersedes earlier descriptions that called callback0x4b090 an immediate trade-price change.

## Data and initialization

Initialized data overlay29 starts atfile4ec60, load segment2be7. Its image translation is `0x4ec60 + (segment - 0x2be7)*16 + offset`.

| Data | Original address | File offset | Cold value |
| --- | --- | --- | --- |
| Sixteen thirty-word histories | 4d9f:fa00 | 801e0 | 960 zero bytes |
| Market mode | DSbc66 | 90356 | 0 |
| Unresolved byte tested/reset by updater | DSbc72 | 90362 | 0 |

The history block hashes to SHA256 `3dc463a76fc170607c07b104c3cb531362ce7d6e10c1a34e0c0f370aeae08ce8`. Crop slot `s`, sample `i` is addressed atfa00+s*60+i*2; newest sample29 isfa3a+s*60. DS selectorscf7c/cf7e atfile9166c/9166e select crop segment2d9f/history segment4d9f. Crop loader selectorcef6 atfile915e6 also selects4d9f.

Original SSM loader0x4543c reads sixteen fourteen-byte crop filenames at0x45a37..0x45a7f and calls crop loader0x46520 with its final byte argument0. At0x466d0..0x466ee, that loader writes CRP word34 to the crop definition price and to history sample29. It leaves the earlier29 history words untouched. It independently sets seed price to max(5, CRPword38>>>2) at0x46712..0x46728; harvest definition prices are not assigned by this crop-loading branch. Pointer/graphics assignments retain their separate implementation in the existing crop loader.

Main0x2393..0x239f checks setup byte66c4 against2 and skips to0x24bb for the loaded path. Thus it skips both the default-crop loads and sixteen random startup histories at0x24a2..0x24b9. The new-farm history generator in `starting-market.ts` must not be replayed for loaded farms. A cold market plus the crop loader gives zero earlier samples and base-price heads, without history RNG. A warm crop load retains earlier histories and both mode bytes; do not substitute a flat generated history or reset all data. Full warm-load initialization elsewhere in the executable is not claimed here. The final2048 SSM bytes are read as1024 words repeatedly into the same DSb028 scratch word at0x4640e..0x46431, not into this market history array.

The cold decoder retains every history word and both raw byte values, including unusual values in patched fixtures. It accepts typed-array slices with offsets and rejects a wrong image size/signature. Generated farms already preserve random startup histories in v15 `newFarm`; they will migrate to a shared live market owner without repeating startup draws.

## Weekly update

Overlay26 starts atfile4a640/load segment27ce. Stub24e6:0fba resolves to0x4aea4. The weekly driver calls it at0xbe55 **after the entire five-phase aging routine0xbf02**, then updates wind at0xbe74. Planting from the weekly schedule occurs later. This placement matters because the routines share simulation RNG.

Updater0x4aea4..0x4b064:

1. Draw simulation RNG&15. For13..15 only, replace mode with bounded RNG below3. These are separate original generators.
2. Compare DSbc72 as a signed byte with12. If greater, increment mode modulo256; if the resulting signed mode>2, set it0. Then clear DSbc72. No increment of DSbc72 was found: the complete executable contains its literal little-endian address only at the comparison0x4aece and reset0x4aee5. This does not rule out indirect writers. Preserve it as `rawBC72`, without inventing a weekly duration counter.
3. For crops0..15, shift samples1..29 to0..28, then take sample29 as the price. Compute a **signed** eighth-price step with SAR before replacing a zero price with1.
4. Always draw simulation RNG&7. Mode0 increases for choices0..3; mode1 for0..1; mode2 for0..5. The other choices decrease. Modes outside0..2 skip the adjustment. A valid mode draws another simulation RNG&3 for magnitude and adds/subtracts magnitude×step modulo65536.
5. Apply an unsigned upper bound `(CRPword34*2)&65535`, then unsigned lower bound `CRPword34>>>1`. Finally, if the resulting **signed** word is below10, set price10 and global mode1. This mode change affects subsequent crops in the same call.
6. Write price to sample29, crop definition+6 and harvest definition+6. Set seed definition+6 to unsigned max(5, signed-price SAR2). Other definition bytes remain untouched.

The remaining0x4b018..0x4b063 invalidates two original windows; native UI notification will use the existing snapshot publication mechanism. Valid modes usually consume33 simulation draws and optionally one bounded draw per week. Invalid modes consume fewer magnitude draws until/unless a minimum-price branch changes the mode.

SF-146 records signed-step reversals and mixed bounds. They are preserved source arithmetic, not asserted reachable vulnerabilities.

## Event callbacks change history, not trade prices

Planting callback0x4b066..0x4b08e writes only sample29:

`history = (history - (signed16(history) >> 2)) & 65535`

General disaster callback0x4b090..0x4b238 also writes only sample29. Modes2/3 use CRP sensitivity bytes71/70 respectively; modes5/6 use72; modes1/4/7/8 do nothing. A zero raw sensitivity skips the crop. Otherwise, mask the shift count with31 as the original386 instruction does; counts16..31 produce a zero word. Add the shifted unsigned history modulo65536, then cap it at `(CRPword34*4)&65535`. The enabled gate and mode eligibility remain responsibilities of the existing disaster callers; this callback runs between them. SF-130 retains the word-overflow finding with this corrected target.

Neither callback synchronizes crop, seed or harvested-goods prices. Weekly updating provides that synchronization. Failed or disabled operations must retain their original mutation gates rather than changing history simply because a UI action was attempted.

## Verification and next integration

Eight new tests pin executable/hash/selectors/dispatch and decoder boundaries, all256 mode bytes with every choice/magnitude, conditional bounded draws, signed byte boundaries, ordered price clamps and cross-crop mode changes. Event tests cover planting signed boundaries and all256 sensitivity bytes for every ordinary disaster mode. History shifting, retained definition bytes and trade synchronization are checked independently. Malformed inputs reject before consuming randomness or changing state.

A52-week calculation uses the sixteen default CRPs, cold crop-load histories, initial visual27/simulation9029/bounded51, planting crop`week%16` every fifth week and drought every seventh week, including week0. An independent Python arithmetic calculation gives final history SHA256 `28ee597ec92285571b6fba2e84d6aead17d85135f4f812061943e0fde0862af2`, mode2, simulation11253 and bounded182. It consumes1716 simulation draws and6 bounded draws. Detached JSON/RNG continuation matches the uninterrupted calculation at every week; this is a primitive test, not yet a native-save integration test or an original execution trace.

Next: move generated market state into a single canonical owner used by both farm origins; persist both mode bytes and histories; migrate v15 generated histories and older checkpoints without replaying RNG or fabricating historical samples; initialize cold original imports from source defaults and crop-loader assignments; connect weekly update after aging; redirect all manual/scheduled planting and disaster consumers to history; verify quotes, income, save continuation and browser play. Original warm-load semantics beyond the traced crop-loader writes, historical chart presentation and indirect DSbc72 writers remain explicit research gaps.
