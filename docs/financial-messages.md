# Original financial Message dialogs

Source is immutable SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets. This increment reconstructs the information dialogs from static executable/archive evidence; no DOS code runs.

## Dispatcher, text and artwork

Loan failurec5a6 passes166 to24e6:0fd8. Stub28038 selects overlay4:0000/file30220. The dispatcher rejects optional IDs below128 when DS a8a1 is zero (3023c..30251); optional IDs also compare animation age with3c0 ticks (30266..3027a). Mandatory IDs subtract128 at3025f and bypass both gates. The jump table at3035c has63 words. Relevant entries are:

| Request | events.dat row | Portrait | Meaning |
| --- | --- | --- | --- |
| 159 | 31 | 76 | Failed annual tax |
| 161 | 33 | 74 | Estimated tax exceeds cash |
| 162 | 34 | 74 | Unpaid tax reminder |
| 163 | 35 | 76 | Tax paid |
| 36 | 36 | 76 | Tax assets about to be auctioned |
| 165 | 37 | 75 | Tax assets sold successfully |
| 166 | 38 | 74 | Failed scheduled installment |
| 39 | 39 | 76 | Bank foreclosure/assets to be auctioned |
| 168 | 40 | 75 | Bank assets sold successfully |
| 169 | 41 | 74 | Unpaid installment reminder |
| 170 | 42 | 75 | Overdue installment paid |

Portrait assignments are30286 (74),30292 (76),30344 (75). The common tail303da..303e6 loads DS6346/events.dat through24e6:1000/file4a2ee. That loader seeks record×256, reads256 bytes, replaces every `@` with a space (4a341..4a34f), and NUL-terminates bytes254/255 (4a359..4a35f). Renderer882e word-wraps at224 pixels and treats CR/LF and repeated spaces as separators; it does not preserve the physical resource lines. Native decoding bounds each complete record and normalizes those separators, retaining original words and punctuation. Raw imported events.dat remains unchanged.

Popup calls3041a..3043d pass position192,150, button1 (OK), no second button and the selected portrait to9654. The existing [Message artwork](direct-bulldoze.md) supplies256×192 popup.bmp,112×64 alltiles.btl portraits at local72,24, text at16,96 and48×24 OK at104,156. Native uses these pixels at1×, with actual HTML title, body and button text. Native word metrics and wrapping use a browser font; original bitmap font rendering is deliberately not restored.

Source range hashes:

| Range | SHA-256 |
| --- | --- |
| 30220..30485 dispatcher | `5b7ef887168a851aa6ea40210d8a18d3a1f6757bf99af016050245e69a56d884` |
| 4a2ee..4a364 text loader | `972a90ed5dc5176168a64a959f42b8d99e2a25702e823f9f0581e9b03817bdb4` |
| 882e..8931 word renderer | `4b40550eb5b45523f765e696b3e9d1432999cdf87c0c161e5f41a2371a81ee19` |
| events.dat (archive offset896380,16282 bytes) | `616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb` |

## Publication, ownership and limitations

The plain TypeScript simulation emits typed transient finance-notice events at the recovered financial branches. Monthly ordering remains balance before tax, then any seasonal warning. Annual159 follows failed tax settlement; a later scheduled-payment166 follows the existing weekly continuation. Forced-sale entry1d77a..1d784 requests optional36/39 before the first sale; successful monthly callers then request165/168. A failed liquidation leaves the existing persistent default decision and does not report successful payment. Tests cover all eleven request types and multi-message ordering through actual canonical transactions.

GameSimulation continues to publish events after completing its current simulation phase and snapshot. React queues only presentation requests, never debts, transactions, calendar phases or RNG. The original calls are synchronous inside the financial routines; native acknowledgements currently occur after that phase's financial mutations. Thus a pre-auction notice is presented before the success notice, but the auction has already been computed. Exact interruption and saving inside those intermediate source calls remain a fidelity gap; this increment does not claim to reconstruct that execution stack. No save-schema or transaction rule change is introduced.

The browser Message dialog blocks background inputs and suspends elapsed-time feeding while any notice awaits acknowledgement. It resumes without accumulating the time spent reading. Each notice starts at the original position, can be moved using the shared titlebar, and closes through OK or native Escape. Notices are not saved or replayed from snapshot polling/load; unpaid balances and pending default/town decisions retain their existing checkpoint ownership. Acknowledgement does not mutate a financial result. Existing Tax details/Bank status summaries remain available after acknowledgement.

The nine mandatory notices are always shown. The two optional forced-sale warnings are currently also shown once per real invocation: source optional-message preferences/cooldown gating await the remaining Options reconstruction. The source DOS animation timeout is not mapped to a new wall-clock delay. The [terminal YES/NO default dialog](default-dialog.md) now appears after these informational notices, retaining saved restart/exit decisions and a native ended-session bridge. See SF-069 for debt retention and SF-169 for source text versus rule discrepancies. Other farming/disaster messages and original event scheduling remain unfinished.

## Validation

Tests pin dispatcher/loader/render bytes, record/portrait mappings and popup geometry; reject unknown IDs and every short prefix within each referenced record; verify original text and raw-data immutability. Canonical tests assert ordered one-shot publication, exact identical saves with/without event observers, no snapshot/load replay and existing financial rules. Browser tests cover every notice, portrait pixels, real text fit, original geometry, movement, modal blocking, keyboard acknowledgement, queue order, save/load, default continuation and running-game suspension/resume. Existing annual and Bulldoze tests continue through their actual controls; subsystem helpers acknowledge informational popups before continuing an unrelated action. Full gate results are recorded in progress.md.
