# Field feedback: Schedule warning and placement history

Source is immutable SIMFARM.EXE, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Offsets below are hexadecimal file addresses. Static byte evidence distinguishes actual modal messages from Edit's status history; the native game does not run DOS code.

## Fixed harvest week

Schedule editor2e46a selects the currently planted crop;2e488 tests crop definition byte76. If nonzero,2e490..2e4a9 calls0636:10f4/file9654 with x192,y150, OK1, portrait74 and initialized DS6142. The literal is `This crop has a fixed harvest week.` There is no Messages/a8a1 gate in this branch. It returns without writing the plan. Range2e46a..2e4b0 SHA256 `55c7850f8417a2619066a5bae2162af96936e7509509aacac03e56f4f14a3072` (end exclusive). Confidence high on text, guard, arguments and absence of plan writes.

The native canonical edit-field-plan rejection now emits a transient field-notice. The existing ordered financial/disaster presentation queue displays it with the original256×192 frame, portrait and OK button, actual React wording and movable title. The modal suspends browser elapsed-time delivery and background input, returns to Schedule on acknowledgement, and changes no canonical state. It appears once per rejected request, even with Messages off, and does not replay on save/load. Earlier validation failures, such as a current-week edit, do not create this warning. Existing source plan protection and SF-039's native slot15 correction are unchanged. Supplemental readable footer feedback remains available.

## Plant placement failures are different

Plant map branch23eae calls2255e, which calls8×8 wrapper1bfa0. That delegates to validator1bc68 and constructor1ba84. Zero return jumps to24164; seed failure after23f85 also reaches this tail. It pushes status code51 and calls1d75:2bb4/file22504. That helper compares against the newest byte atDS0170+DS017a, suppresses consecutive duplicates, advances a ten-entry ring, writes the new byte and marksDS5694 for redraw. It does not invoke a Message popup. Range24164..24173 SHA256 `d4886602eff21d0ad38fd779597816f87187dcdd78ff0f495b9bef5df9a5b64a`;22504..2255d SHA256 `9aecff368338acda5c25189476ac6c1cb02b3ddc62affc3de0597bbed84f046a`.

The Edit history renderer at22188..22194 calls24e6:1118, resolved through stub28178 to overlay25:19fe/file4a0be. This text loader uses unsigned code×64, opens the filename atDSba4c, reads62 bytes intoDS149e and terminates two bytes at14dc/14dd. Filename/member text and full history display/input lifecycle are next research; no new status-history UI is claimed here. Native placement retains detailed footer feedback and SF-018's atomic failure correction rather than inventing source dialogs or restoring destructive partial mutations. Bounds/slot-capacity native safeguards remain in place.

## Checks and remaining work

Ten focused source/editor/live tests cover the literal and call bytes, existing calendar/contract/crop restrictions, mandatory transient requests, repeated rejection, unchanged checkpoints and no reload replay. Five browser cases cover the actual warning from Schedule with Messages off, original geometry/portrait coordinates, real text, movement, modal state, acknowledgement, reload and existing planner workflows. Original portrait/frame pixels were already verified by shared Message and financial tests. Screenshot browser-field-message.png reviewed at1×; build/type checking passes.

Original Edit status history, other operation feedback and full window/audio lifecycle remain incomplete. The full port is not claimed complete. This integration establishes no new original-game defect; previously documented SF-018 and SF-039 remain retained.

## Shared MessageDialog (2026-10-12)

This popup now renders through the shared `MessageDialog` on shared chrome; see financial-messages.md.
