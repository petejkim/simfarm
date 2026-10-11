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

The plow claim in SF-035 and field-calendar.md was too strong: finding a handler does not prove reachability. DS selector words c97a/ca1c/c9e6 resolve to6190 and c97c to2be7. The inspected palette includes computed writes to selected tool018a (for example21852..2185e indexes the tile table), while a bounded whole-file scan finds no literal `c7 06 8a 01 01 00` immediate store. That absence does **not** exclude computed, indirect, aliased or bulk writes. No speculative extra palette button is added. The source editor also recognizes action26, but its selection route remains to be traced. State2's inert dispatcher behavior is retained, not replaced with invented machinery work.

Updated field-tools.md to reflect actual current controls: all24 crops in one popup, persistent spraying, retired interim forms, restored frames/stacking/trees/button sounds. This prevents stale milestone notes from being mistaken for a current backlog. No simulation expressions, command behavior, assets or save fields changed in this audit.

Next actions: the user's new priority is amain-first startup music, then the original About dialog, each in its own commit. After those, continue reachable-interaction auditing; tool1/action26 selection and broader map/cursor behavior remain explicit questions. Music sequence/lifecycle fidelity is also unfinished. Annual tax and fair/rodeo coverage does not establish a completed port.
