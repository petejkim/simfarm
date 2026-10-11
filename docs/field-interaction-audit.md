# Field interaction coverage audit

2026-10-11, after live fair/rodeo commit721f85d. This is a bounded source-route audit, not proof that all original interactions are implemented. Reproduce its executable fingerprint, instruction pins and source-range hashes with `.venv/bin/python tools/audit-field-interactions.py`; output is ignored `artifacts/field-interaction-audit.json`. No DOS code is executed.

| Interaction | Current native route | Evidence and limits |
| --- | --- | --- |
| Plant a new field | Plant popup, crop, map placement | Source38386 selects toolFFFE; map23e9b/23eae routes through22571 to constructor1957:0830. Existing occupied fields reject placement. |
| Plant/harvest an existing field | Schedule edits, then weekly execution | Weekly2f697..2f6a5 calls2e93a before processing new orders. Native finishWeeklyFieldWork already returns equipment, completes/settles prior work and handles source quirks. |
| Spray an existing field | Persistent Spray tool and field clicks | Source26c75 resolves the selected field;26d3c..26f86 enforce state/equipment gates. Native persistence is the user's requested adaptation. |
| Immediate replant/cancel working job | No current React control | Native plant-field adapts the weekly branch; its safety guard is not evidence of an unported original gesture. The old comment incorrectly suggested weekly equipment returns were absent. Retain the guard until a real caller establishes another action. |
| Plow a Waiting field | Backend handler/order semantics only |26c84/26c95 dispatch selected tool1;26cc4 checks state0,26ccf sets state2/step0 and26cdb records order1. This proves handler behavior, not availability of a UI selector. |

No src/ui component dispatches plant-field or harvest-field; the previous interim Field orders panel is gone. Source-backed tests still exercise those native adapters, but a command in the simulation API must not be mistaken for a verified original UI action. Current original-map/Schedule browser tests complete planting, growth, harvest, storage, sale and replanting.

The plow claim in SF-035 and field-calendar.md was too strong: finding a handler does not prove reachability. DS selector words c97a/ca1c/c9e6 resolve to6190 and c97c to2be7. The inspected palette includes computed writes to selected tool018a (for example21852..2185e indexes the tile table), while a bounded whole-file scan finds no literal `c7 06 8a 01 01 00` immediate store. That absence does **not** exclude computed, indirect, aliased or bulk writes. No speculative extra palette button is added. Action26 is the first palette control, Move object; its selector route is now pinned below and was already reconstructed in manual-movement.md. State2's inert dispatcher behavior is retained, not replaced with invented machinery work.

Updated field-tools.md to reflect actual current controls: all24 crops in one popup, persistent spraying, retired interim forms, restored frames/stacking/trees/button sounds. This prevents stale milestone notes from being mistaken for a current backlog. No simulation expressions, command behavior, assets or save fields changed in this audit.

The startup music/About queue is complete. Continue reachable-interaction auditing; field tool1 selection and broader map/cursor behavior remain explicit questions. Music sequence/lifecycle fidelity is also unfinished. Annual tax and fair/rodeo coverage does not establish a completed port.


## Palette selector follow-up

The preceding action26 uncertainty was stale documentation, not missing gameplay. Original descriptorDS562a points at controlDS5614 through+30h. Follow the22-byte linked controls through+12h: the16 action IDs are26,2,15,16,11,12,20,19,13,14,17,1,22,23,30,32. Action dispatch215e0 reads the control's+0ah ID;22344 subtracts1, bounds0..31 and dispatches through the32-word table22352. Action26 resolves to21726, writes Edit mode11 at2172f, installs pickup cursorDS1a2e at2173e and requests message6 at2174a (“Choose an object to move.”). This is precisely the existing canonical Move object gesture; see manual-movement.md. Do not confuse palette action1 (Bulldoze), action26 (Move object), Edit mode11, and selected field tool018a=1.

The audit now follows and asserts the entire linked control chain and action table, pins the Move mode/message bytes and reports computed selection inputs. Actions11..20 read definition graphic bytes and translate through2be7:085e; action14 additionally increments its result at21a8b. **Initialized** definitions produce177,188,1020,176,150,161,131,172,122,87; none is1. These are not asserted to be final runtime selections: setup can rewrite definition graphics (notably Ditch; direct-construction.md pins its later definition updates). This static table check narrows the original speculative computed-write example, but does not prove field tool1 unreachable. Retain the original handler and uncertainty without adding a speculative Plow button.

Source range hashes now include the linked control chainDS54ca..562a, mode/computed handlers21726..21eec, and action dispatch22344..22392. No simulation, browser input, artwork, saved state or original source changed. Remaining missing cursor artwork is a concrete presentation gap documented in manual-movement.md and is a better next implementation target than reopening the already-ported Move action.
