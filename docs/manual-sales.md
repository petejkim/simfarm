# Manual livestock and equipment sales

Source SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets. List/caller/valuation evidence is high confidence. Native controls and canonical commands are now connected; original shop presentation remains a fidelity gap.

## Original player-facing gates

Shop-list builder0x4baee dispatches DSbcde at0x4c09c:0 selects crop inventory,1 equipment,2 animals. The equipment scan0x4bd3e first excludes rented flag0x40 at0x4bd7a, then requires active0x20 at0x4bd82. It does not exclude reserved/field-work flags from the displayed list; those are rejected by the final sale routine. Animal scan0x4bf14 accepts active records at0x4bf3a without a stored/adult/pregnant condition filter. Native bounds the scans to the decoded record arrays rather than trusting source counts to terminate an unbounded scan.

Widget action6, dispatch word0x4c3ce, enters0x4c286. Depending on the selected one of three visible rows,0x4c2d0/0x4c346/0x4c38a pass the cached kind/type/slot to generic sale0x4c41c, then rebuild the list and redraw. Thus generic rental eligibility does not establish a shop exploit: the original player list hides rentals (SF-058). Other possible callers remain a separate reachability question. Native manual-sale preflight enforces this same filter, while generic sale remains unchanged for previously recovered consumers.

## Quotes, receipts and removal

Equipment quote0x1192e is unsigned definition price shifted right by condition byte17>>6. Animal quote0x12958 uses the retained valuation word+10 with source multiplier3/5/3/2/0 for types160..164, truncates the multiplication to16bits, adds the definition price as an unsigned dword, shifts right by3−(condition byte8>>6), and returns a word. Generic sale sign-extends these word values (equipment0x4c502, animal0x4c5a5). Native displayed manual quotes use that **signed receipt**, including negative amounts for unusual data, rather than advertising the unsigned intermediate (SF-055/056).

Both branches add the signed amount modulo32bits to cash before its9,999,999 cap, the annual sales accumulator and the appropriate equipment/livestock income ledger. Equipment0x4c4e3 requires active and clears flags1/8; livestock0x4c588 requires active. The existing generic map/storage erase and deletion then clear active state/counts, remove occupied storage cells, reduce owned equipment book value by the full definition price, and clear aircraft home/parking where applicable. Unknown record bytes survive. SF-027/057 native preflight rejects inconsistent counts/storage/links before credit. Manual sale calls the generic routine directly: no weekly worn-out explosion/clearing wrapper or invented service fee is added.

The raw fifth animal definition duplicates a source type; native retains it and permits the already-decoded160..164 quote range without inventing another named species. Ordinary purchases/breeding use the four recovered species. A browser label for an unknown supported type should remain neutral.

## Native foundation and checks

`asset-sale.ts` now shares a private read-only preparation path between quote checks and existing sales. It validates the complete removal before either quoting or crediting; public quote results contain no mutable closure. `manual-asset-sale.ts` adds the recovered rental filter and delegates actual bookkeeping/removal to those same generic routines. Generic/default/weekly rental semantics and other sale behavior are preserved.

Three new tests pin the original list gates, all three sale callers and widget dispatch. They check read-only quotes and actual displayed signed receipts for every original farm animal/owned machine, reject repeat sales and verify rental/busy/inconsistent/native-boundary rejection without mutation. The existing seven generic tests retain full arithmetic, counts, map/storage, aircraft and link coverage. The initial all-farm test redundantly serialized complete source snapshots per record and exceeded its deadline; batching the no-mutation comparison across the read-only quote pass retains all records and completes in1.21seconds. No product behavior was changed to accommodate that test.

GameSimulation now owns the sell-asset command and detached transient result. Current native v12 already stores the affected records/accounts; no new persistent sale state or version change is needed.


## Live controls and continuation

**Livestock → Sell livestock** selects an animal and shows its current source receipt, Sell animal and Show on map. **Machinery → Sell machinery** does the same for owned machines, including parked aircraft. Rental entries are excluded; busy machines remain listed with a disabled sale button and explanatory text, matching the original list/handler split. Stored animals/machines are selectable. Signed negative receipts, if present in unusual native data, are displayed as deductions rather than an unsigned promise of income. Normal original definitions/conditions yield the tested positive amounts.

Commands recompute current eligibility/value and use the existing prevalidated sale path. They obey pending town/default decisions and flight suspension. Closing/opening panels or quoting/locating an asset does not mutate simulation state. Only the simulation owns records, accounts and removals; React owns selection and submits commands. Receipts remain visible after the last item is sold, but are transient and clear on load. A deleted slot's unknown bytes are preserved, with only the source removal members changed. There is no extra confirmation or speculative sale tax, sound or demolition animation.

Three live tests connect an actual gestation completion to newborn sale income, sell the stored parent and release its stall, resume35days exactly, sell ground/stored/aircraft equipment with book-value and parking cleanup, and reject rentals/busy or modal actions without changing checkpoints. Two Chromium flows perform those actions through selectors/buttons, compare every saved state with native commands, verify original ground/pad pixels after removal, check cash/feedback and reload, and inspect390px layout. The sale panel screenshot is artifacts/browser-manual-sales.png. Full original dialog styling, category navigation and asset movement/removal commands remain separate work; these usable sales do not complete the preservation goal.

## Original Sell catalog update

The toolbar/Windows Sell launcher now opens the original192×256 client, with harvest/machinery/livestock categories, three-row navigation, original item/condition artwork and HTML titles, grade markers and prices. The recovered manual-sale list filters and canonical commands above supply this restored interface. Older livestock/machinery controls remain alternate access until their other dialog interactions are reconstructed. See [sell-dialog.md](sell-dialog.md) for layout evidence, checks and remaining presentation/event-loop adaptations; the original scan-boundary hazard is retained as SF-156.

2026-10-11 user follow-up: the interim feedback area below this window was removed; outcomes show through the source controls, readouts and Funds. See progress.md.
