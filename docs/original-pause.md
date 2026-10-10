# Original pause depth and Speed checks

Evidence comes from unchanged `SIMFARM.EXE`, size `0x917b9`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets; DS is initialized segment `6190`, file base `0x846f0`. Confidence is high for the listed bytes and represented callback transitions. Complete original window nesting, interrupt scheduling and audio effects remain unfinished.

Native v23 adds `runtime.originalPause`, owned by the TypeScript simulation. `depth` retains DS `0187`; `speedChecks` retains the five low item-flag bytes in display order. Every member accepts an unsigned byte or explicit `null` when a historical checkpoint did not retain it. These bytes are independent of the browser `paused` boolean, multiplier, saved equipment pacing byte and current delay words.

| Owner | DS offset | Initialized byte |
| --- | --- | --- |
| Pause depth | 0187 | 0 |
| Ultra check | a760 | 0 |
| Fast check | a752 | 0 |
| Normal check | a744 | 1 |
| Slow check | a728 | 0 |
| Pause check | a736 | 0 |

The callback writes bytes, not entire flag words. Item rendering at `3f3a2` tests bit 0, so nonzero check bytes must not be coerced to booleans. Other descriptor flag bits remain in the recovered menu metadata; this owner does not claim to reconstruct additional dynamic flag writers.

## Represented transitions

Pause helper `3f492` increments depth at `3f49d`. For a nonzero result it clears the four rate checks and sets Pause to 1. For `255 → 0`, `3f4a2` skips those writes. The pinned sequence is `26fe06870174422ac0a260a7a252a7a244a7a228a7c60636a701`. This helper does not write the equipment pacing byte. Its audio/window effects are not part of this state increment.

Resume helper `3f4e8` returns for depth 0 and decrements other values. Only `1 → 0` reaches the six Normal pacing stores at `3f505..3f53a`, followed by Normal check 1 and the other four checks 0 at `3f541..3f551`. Values `2..255` retain their pacing/checks after decrementing. The native importer now uses this shared state transition rather than examining a source byte and discarding the resulting counter.

Ordinary File Load creates its dialog at `3ed4c`, joins Save As insertion through `3ed67 → 3ec8b`, and pauses at `3ecd0/3ecd1`. Geographic result 1 pauses through stub `132a` at `3fa42`. Successful loading then replaces depth from SSM `21719` at `4619e..461b3`, retains the check bytes, and resumes through `43284 → 3f4e8`. Thus an ordinary loaded depth 0 can leave the Pause check set while the resulting depth is 0. This is verified state divergence, not proof of an unintended visible bug; SF-152 retains the reachability and timing limitations.

The native import transaction applies these steps to a detached candidate and publishes only success. Cancellation and invalid input leave the active farm unchanged. Result 1 currently composes temporary startup before this atomic transfer; no elapsed interrupt time or intervening check consumer is represented. The source opens its dialog before main's temporary-farm finalization, which does not contain another identified writer to these owners. Full event timing remains deferred.

Restart routine `4060c..4094d` resets Normal at `40777` and clears Ultra/Fast/Slow/Pause at `4084e..40866`; it does not reset depth. Its final planner loop writes a distinct segment `2c8b`, selected by DS `ce68`, rather than the pause owner. Native restart therefore retains known or unknown depth while establishing known Normal checks. Numbered chooser result 2 loads the saved depth but does not invoke the ordinary file-dialog pause/resume callbacks. Cold numbered entry starts with initialized Normal checks. Fresh generated entry starts with the initialized depth/checks.

## Historical knowledge and browser policy

Versions 1–22 migrate all six members to `null`. No value is inferred from the browser pause flag, equipment byte, delay words, immutable SSM template or generated provenance. A later original load establishes its depth from the new file. If the preceding depth was unknown, dialog opening could either wrap without touching checks or write the Pause checks. Only check bytes identical in both branches remain known. Loaded depth 1 establishes all Normal checks on return; other loaded depths retain the represented uncertainty. Explicit restart also establishes Normal checks without inventing a depth.

Native restoration preserves every known/raw/unknown byte exactly, without replaying callbacks or consuming RNG. Snapshots detach the nested tuple. Current-format validation rejects missing owners, invalid byte values and check arrays of the wrong size before replacing the active farm.

The browser's Play/Pause, Next day, flight/default/town handling and existing multiplier retain their current policies. This increment does not make original depth freeze the browser or interpret it as a complete reconstructed modal stack. Source pause checks at `bcf6`, original work before that gate, the separate `151e` guard and interrupts continuing independently of the main loop remain reference evidence; freezing every clock through the browser boolean is not claimed to match DOS behavior.

The user's subsequent direction is to skip original timing rules and use today's0.25× as the new1×. Original timer/guard reconstruction is therefore no longer a prerequisite for restoring usable UI. The preservation owner remains useful for retaining loaded/checkpoint state; live controls will use an explicit native pacing policy. The baseline change follows as a separate increment.

Tests pin instructions and initialization, exhaust all 256 counter values, cover raw check bytes and wrap, and exercise all eight farms with loaded boundary depths. Cold/generated/restart/numbered/result-1 compositions remain distinct. Migration tests cover every historical version and subsequent loads that either retain uncertainty or establish Normal state. Browser checks cover exact raw-byte round trips, v22 migration, malformed v23 atomic rejection, loaded-depth branches and fresh-page continuation.
