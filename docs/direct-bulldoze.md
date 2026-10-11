# Direct Bulldoze and original MESSAGE popup

Source is immutable SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All addresses are hexadecimal file offsets, verified by static disassembly and source-pinning tests. No emulation. Confidence is high for the listed input branches, geometry, messages and resource identities; exact DOS modal timing/audio arbitration is not reproduced.

## Input and canonical commands

Palette ID1/table22352 selects215ea;21667 writes Edit mode15 and uses the1×1 crosshair. Mode table20d9c entry14 selects20cf2;20d11 calls233c:035c/file2591c. Shared interception255e6..255f7 explicitly bypasses gate/valve activation only for mode15 **and event5 (primary press)**. Secondary-button fixture interaction remains available. Thus a primary Bulldoze press removes a valve or gate rather than toggling it first.

Loop25936 reads pointer171b/171d, clips against Edit's client rectangle, shifts by4 and adds viewport offsets2598e/2599e. Previous coordinates startFFFF at25929;259a8..259b2 skips the last accepted coordinate. Leaving Edit clears held-left-button1721 bit0 at2657e;26588/26590 loops only while that bit remains set. Town rejection and insufficient cash retain their existing canonical guards. Source insufficient cash returns at259f5. Busy fields show the original message and return at25b44.

Native uses the existing captured pointer sampler: no interpolation over skipped cells, one command per newly sampled cell, and cancellation on release/cancel/blur/Escape/tool change. Bulldoze additionally ends its stroke when the pointer leaves Edit, including a captured pointer that later returns while still held. Touch uses the same coordinate path at either zoom; desktop layout is unchanged.

Terrain, inventory and chemicals now submit existing `remove-object` directly. Fields/buildings stop the stroke and retain only a React confirmation draft; YES submits the same command with the original clicked coordinate and target identity. `checkManualRemoval` and `removeManualTarget` continue to own all rules, ordering, costs, record/contents cleanup, shoreline RNG and connection repair. A modal does not move canonical state into React. Save schemas are unchanged. Full cleanup evidence remains in [manual-removal.md](manual-removal.md).

The source confirm cancellation falls through into terrain handling (SF-112). Native CANCEL/Escape submits no command and leaves the complete checkpoint unchanged, retaining the existing correction. All other previous bounded-scan/atomic-cleanup protections remain. No new original defect is established by this input increment.

## Popup evidence and reconstruction

Building25a42 loads events.dat record46; field25b48 loads47. The fixed256-byte records contain eight physical text rows with CRLF and `@` padding. Display removes padding and keeps nonempty rows; raw imported bytes stay intact. They say “Are you sure you want to” followed by “destroy this structure?” or “destroy this field?”. Busy-field text is initialized DS5a1a, referenced25b39.

Both confirmation call sequences25a50..25a66 and25b56..25b6c pass portrait74, button codes11/4, x192/y150, no third button, and call0636:10f4/file9654. Popup local descriptor establishes256×192 (9752/9761). ResourceDS1e30 is popup.bmp. Portrait loading9a11..9a8d uses alltiles.btl record74 and draws112×64 at local72,24. Text993b..995c uses local16,96 and width224. Two-button branch9c3a places48×24 buttons at local40/168,156;93ca reads buttons.til at index×576 (9493), subtracting1 from caller codes. Indices10 and3 are YES/CANCEL. Busy-field caller25b28 supplies button code1 (OK) and no second button;9b24 centers it at104,156. Popup titleDS1e1e is MESSAGE.

| Archive member | Decimal offset | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| popup.bmp | 464680 | 24584 | `13c67ce4fce48a351a23e3f814c2f9c487ed5f6efc04377272978a6ce37d7685` |
| buttons.til | 1797296 | 10368 | `326c56476dc871cfd583b89d23b8c8b085463884ea25b5c0985a0fe44976cfb2` |
| alltiles.btl | 593168 | 286900 | `f77032c6726cc13c38adf15082c59babf0573724a8a0a01dc7a61d866e4dd502` |
| events.dat | 896380 | 16282 | `616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb` |

The original popup frame and portrait are reused at1×. Import creates a caption-free48×24 button frame; all pixels outside the mask match OK/YES/CANCEL frames, and imported PNG bytes match the decoder. MESSAGE, body text and button captions are actual React text. Browser font metrics replace bitmap glyphs. The shared GameWindow gains optional native `<dialog>` modality, preserving movable wooden titles, keyboard movement, bounds and focus restoration. The source popup has no close gadget; Escape/CANCEL closes it. Each invocation starts at source192,150; movement is presentation state.

Native dialog modality blocks background inputs and suspends the browser's elapsed-time feed, preserving canonical pause/clock state. Closing resumes with no catch-up for time spent deciding. Source9654 waits for mouse release at9849 before painting; native opens on pointer press and immediately terminates capture. The ordinary simulation still runs during nonmodal terrain strokes. These are explicit browser policies, not DOS interrupt-loop emulation. Source pre-action bulldoze/uhoh sound timing remains incomplete: existing successful removal commands retain their original PCM requests, and rejection/cancellation remains silent. MIDI is unchanged.

## Validation and next work

Three new unit cases pin palette/mode/bypass/held-loop branches, popup calls/geometry, text bounds and every button-frame pixel, including malformed/truncated resources. Existing removal tests cover all eight farms, field-state bytes, terrain IDs, stale targets, town/cash guards, loose stock, full building contents, shoreline RNG and exact continuation.

Four new browser flows cover immediate removal of all existing target families, exact saves and eight-day continuation; source popup geometry/portrait/button positions and actual text; modal background blocking, dragging, Escape/CANCEL nonmutation, stored cow/tractor destruction; busy/growing fields and twelve seconds of suspended elapsed time; valve removal without toggle, same-cell suppression, outside exit, touch cancellation at2×, exact25 payment and tool changes. Reviewed artifacts/browser-direct-bulldoze-confirmation.png. The duplicate **Map tool → Bulldoze** form has now been removed; the original palette and MESSAGE dialogs provide removal access. Its browser checks now exercise these original interactions, including PCM, exact checkpoint continuation and cleared-field reuse.

Next restore town/aircraft map entry and remaining original window interiors. The broad preservation goal is still incomplete; this increment completes direct access to the existing removal rules, not the full original UI or all game systems.
