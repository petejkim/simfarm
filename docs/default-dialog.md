# Original terminal default dialog

Source is immutable SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets. This is static source/artwork reconstruction; no DOS or x86 environment runs.

## Verified source

After the bounded native equivalent of forced-sale exhaustion, source1db42..1db5b calls the common popup9654. Arguments select screen192,150, portrait74, button codes11/12 (YES/NO), no third button and DS3efa text. The Message frame is256×192; portrait112×64 at local72,24; body starts16,96; two48×24 buttons start40/168,156. The common popup evidence and artwork hashes are in [direct-bulldoze.md](direct-bulldoze.md). Source button atlas indices10/11 supply YES/NO; their frames match the existing caption-free imported button outside the removed lettering rectangle. The native title, body and both button captions are actual React text.

The source text says: “You have had to sell your homestead to pay your debts. Would you like to start a new game?” Its first sentence is false for this control flow: land scan1db1a..1db2d skips the saved homestead coordinates and no final home sale occurs. SF-068 retains the defect evidence. Native wording is “You cannot pay your debts. Your homestead remains yours. Would you like to start a new game?” It corrects the claim without changing the existing protected-home rule or introducing a new transaction.

Zero popup return (YES) follows1db65..1db6f and writes main state2. Nonzero (NO) follows1db72..1db7e and writes state1. Main loop2694..26bf routes state2 back to new-game setup and state1 to exit. Source ranges are pinned:

| Range | SHA-256 |
| --- | --- |
| 1db42..1db7e | `12e1bf7c3e80d57069f76a0d46f2dd753d0ac8e0c43f6a2fbc190ebf09be8126` |
| 2694..26bf | `c6ff3dc8b6059604c13e709d777062de5f552ae492a637e1990b454d6e6351f4` |

## Native integration and deliberate adaptations

The old default section inside Bank is removed. The existing plain TypeScript DefaultDecision and resolve-default command still own the pending/restart/exit status and exit code. YES dispatches restart before opening the existing New Game flow; NO dispatches exit and leaves the frozen session available. Neither action changes unpaid balances, assets or homestead ownership; SF-069's separation of a button choice from successful payment is retained. No schema, ledger, simulation phase, RNG or timing rule changes.

The decision is a forced movable desktop window at the source position. Escape and the hidden close control cannot dismiss a pending decision or choose an outcome. Unlike the short informational notices, it is not a browser top-layer modal: canonical default guards already block gameplay, and File must remain usable for native saved decisions. Bank can be inspected independently with its borrowing controls disabled. Edit remains fixed/maximized. Window movement is presentation state and resets on a loaded farm; it never enters checkpoints.

The original process would exit on NO. The browser instead retains a small Message frame saying the session ended, with a NEW GAME bridge and File load/save access. This ended screen is explicitly native, not an undiscovered original screen. Keyboard focus moves to that bridge when the YES/NO controls disappear. New Game setup temporarily hides the default frame. Cancelling or failing setup leaves the existing terminal session untouched; only a completed replacement farm removes it. Reloading an ended restart/exit save does not automatically generate a farm or reinterpret the decision as unpaid/pending.

When actual foreclosure also emits optional notice39/36, those informational requests are acknowledged before the terminal frame appears. Their financial-phase publication limitations remain in [financial-messages.md](financial-messages.md); this change does not claim full synchronous DOS call-stack reproduction. Source font metrics, keyboard polling and browser process-exit behavior are not emulated.

## Validation

Source tests pin the default call, initialized text, main-loop exit routing and all YES/NO frame pixels outside caption masks. Existing default/loan cases retain asset ordering, protected-home behavior on all farms, single-use decisions, debt preservation and native save validation. Browser cases check original frame/button/portrait geometry, every portrait pixel, corrected real text and fit, movement/fixed Edit, Escape nonmutation, pending and terminal save/load, disabled controls, keyboard NO/focus, YES/cancel/reload, new-farm replacement after Play, loading a viable save and real foreclosure warning order. The old native default flow and financial-message suite also exercise the new window. Full regression results are recorded in progress.md.

## Shared MessageDialog (2026-10-12)

This popup now renders through the shared `MessageDialog` on shared chrome; see financial-messages.md.
