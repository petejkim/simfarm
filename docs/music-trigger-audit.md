# Situational music and town events

Static evidence uses SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are file offsets unless qualified. Reproduce with `.venv/bin/python tools/audit-music-triggers.py`; ignored `artifacts/music-trigger-audit.json` includes exact source strings and range fingerprints. No DOS execution is involved.

## Direct filename requests

The literal far call to resident `212a:0682` (file `23b22`) has eight occurrences. Every occurrence immediately pushes DS and a filename offset:

| File call | DS filename | Track | Current native coverage |
| --- | --- | --- | --- |
| ca7b | 2060 | carnival | Missing fair interaction |
| cb57 | 2078 | rodeo | Missing rodeo interaction |
| 1f147 | 454c | dfarm | Field/financial report |
| 1f174 | 4556 | ffarm | Field/financial report |
| 1f38f | 45c9 | cowman | Homestead upgrade |
| 3676a | 69e2 | alien | Crop circles |
| 3eaf8 | a8a2 | genfarm | Options Music enable |
| 40e15 | a9cc | amain | Source lifecycle still unclassified |

This list is exhaustive only for that literal far-call encoding. It does not exclude segment aliases, indirect calls, near loader calls or sequence changes. The helper checks Music enabled DS5741 and another audio capability pointer, compares the filename with DSd0d6 on one playback-state branch, stops/reloads as needed and starts an XMIDI sequence. Full playback-state and sequence-control fidelity remains unaudited. Native track selection does not disable future automatic requests. XMIDI internal loop fidelity is separately incomplete; see reverse-engineering.md.

## Calendar entry and choices

`c88e` advances the day, calls the daily update, and on the seventh day calls weekly routine `bdbe` at `c90e`, resets day and increments week at `c920`. The event checks follow, **before month normalization**. Fair checks `(month-9)*4+week == 0` at `c9b0..c9c7`; rodeo checks `(month-6)*4+week == 0` at `cafc..cb13`. For valid calendar input these are September week3→October week0 and June week3→July week0 boundaries, not every day in those months. Preserve the pre-normalization ordering rather than testing an already advanced month plus incremented week.

Both branches require Messages `6190:a8a1 != 0`, then call `d9b2` with mode2 for fair or mode1 for rodeo. This helper immediately fails when recreation count `6190:9cbc` is zero. Coordinates `2d9f:f7aa/f7b2` and their SSM provenance are documented in town.md. It is not merely a predicate: it restores earlier event terrain, loads mode-dependent recreation artwork from `twnevent.til` (DS2094), and stores current mode DS1ed2. At `db55` the selected bank starts at mode*0x1180; the read is0x1180 bytes, and35 tile entries are uploaded at `db98..dbd6`. Exact native artwork integration remains required.

Fair `c9eb..caf9`:

- Zero livestock count `6190:230c`, or failure to afford200 through `1a66:0006`, selects announcement “The town fair is starting!” and animal/type sentinel DS1ed9=ff.
- Otherwise `0f87:1b2a` selects an animal record; its word at+6406 minus160 becomes DS1ed9. Selection criteria still need tracing. Seven-byte text records at6190:22a0/22bc supply species/name substitutions; the complete source prompt and200-dollar fee are captured by the audit.
- `carnival` is requested **before** the dialog, including the announcement-only case. Message portrait74 uses button IDs1/0 for announcement or11/12 for entry choice.
- Entry result zero attempts a200-dollar category−1 debit (`cad3..cae3`). Nonzero debit result stores participation DS1ed0=1; declining clears it. Announcement and failed-debit paths do not explicitly clear that word. Countdown DS1ed3 becomes3.

Rodeo `cb34..cbae`:

- Affordability checks1000. Failure stores event mode zero and skips music/dialog/countdown, despite the earlier artwork helper. See SF-174; do not silently substitute500 for this source threshold.
- Success loads `events.dat` record61 (`cb45..cb50`), requests `rodeo`, then opens portrait74 with button IDs11/12.
- Choice result zero attempts500 dollars/category−1; a nonzero debit result stores DS1ed0=1000. Declining clears participation; failed debit leaves its previous value. Countdown becomes2.

## Later outcomes

Weekly routine `bdbe` calls `dbe4` at `be96`, hence existing countdown resolution precedes the new event checks. `dbe4..dd3d` does nothing for zero countdown; otherwise decrements it and resolves only upon reaching zero.

For participation nonzero and mode1, `dc0c..dc15` draws the simulation RNG and wins when `(random & 3)==2`. Winning text says cousin Jed won500 dollars; the credit call `1a66:01c8` receives1000/category0, consistent with returning the500 stake plus500 winnings. Loss says the500 stake was lost. For participation nonzero, mode2 and animal sentinel other thanff, `dc84..dc8b` draws once and wins on low bit1. Success formats the animal name and awards1000/category0; loss formats its name without payment. After the animal result DS1ed9 is cleared toff. Common tail `dd34` calls artwork helper mode0. Complete reset, save/load and interruption behavior still need auditing; this document does not claim those globals are serialized.

## Implementation sequence and limits

Next trace animal selection, event61 text/portraits, mode0 artwork/map restoration, all writes/initialization of DS1ed0/1ed2/1ed3/1ed9, and original save/load lifetime. Then implement the event state and calendar ordering in plain TypeScript, with bounded recreation coordinates and checkpoint continuation; expose source dialogs in React and emit MIDI requests at the actual dialog branches. Browser tests should cover entry/decline, Messages gating, no recreation, insufficient funds, delayed outcomes and load continuation. A calendar-only music switch would not restore the original interaction.

High confidence: pinned direct calls, gates, amounts, countdowns, random masks and strings. Unresolved: complete caller coverage, amain lifecycle, animal selection and state lifetime. No runtime behavior changed by this audit, and full native preservation remains incomplete.
