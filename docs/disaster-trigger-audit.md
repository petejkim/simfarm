# Extra disaster trigger reachability audit

Static evidence from the unchanged supplied SIMFARM.EXE, SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Reproduce with `.venv/bin/python tools/audit-disaster-triggers.py`; output is ignored `artifacts/disaster-trigger-audit.json`. No DOS code is executed.

## Crop-circle input is debug-only

Resident keyboard handler f254 calls BIOS wrappers404:00f8/file6338 (INT16 AH=0, read scan/ASCII) and404:010f/file634f (INT16 AH=2, modifiers). At f26d Ctrl bit04 routes to a scan-code branch that returns at f344. Without Ctrl, f346 copies ASCII to local bp−10. The comparison at f350 reads DS1b78; zero jumps directly to f6c5, bypassing all debug operations. Only a nonzero flag reaches f6b5: uppercase ASCII41 (`A`) pushes mode7 at f6bb and calls the general disaster manager stub at f6bd. Lowercase `a` is not this branch. A standalone ordinary Shift+A shortcut would therefore expose behavior unavailable during normal source play.

Initialized DS1b78 at file86268 is zero. Startup227e..22d0 requires argc>1 and exact argv[1] string at DS005d/file8474d, `eeadebug`. The DOS date wrapper5dba invokes INT21 AH=2a and writes year at struct+2 and month at+1. Startup22ac rejects year>1993 **or** month>11; only matching argument with year<=1993 AND month<=11 stores1 at22ca. This is a debug availability gate, not a proposed native timing rule or a gameplay restriction to reproduce using the browser's clock. No new defect/security claim is made about it.

Confidence high for the inspected startup and input paths. The crop-circle button was a provisional native debug exposure, not an original ordinary menu action. Original debug startup/keyboard behavior is separate unfinished input work; do not silently replace the button with an ungated `A` handler.

## Toxic warning and bounded general-start reference scan

General start36574 is overlay10 offset00c4; manager stub280f6 contains overlay10/segment27ce dispatch. Six literal far calls to24e6:1096 were found: f6bd(mode7/debug),1e1fa(mode6),1e20b(mode1),3e3c2(mode1),3e3e4(mode4),3e3f4(mode2 and shared menu branches3/5/6). The menu table3e448 contains six ordinary starts plus Disable, with no crop-circle/toxic item.

Four relative call candidates inside overlay10 were disassembled:364e9 takes mode6 or1;364fd mode4;36519 mode3;3652e mode2. These belong to the existing automatic weather/calendar dispatcher. No mode7/8 request appears in these callers. A raw overlay pointer also occurs at484f4, but that address is inside overlay25's relocation table48100..486c0, not executable code or evidence of another disaster call. The other occurrence280fa is the known overlay10 manager stub.

Mode8 at36836 remains verified as a persistent flag80 plus source Message51. The bounded scans do **not** establish an ordinary caller, and do **not** prove dead code: computed/indirect references or alternate segment aliases remain possible. There is no evidence to invent natural toxicity damage, a seasonal trigger, or an eighth menu row. Preserve the canonical primitive, saved flag and notification while retiring its unverified ordinary UI button.

## Next implementation

Remove the two provisional trigger buttons from ordinary Disaster details. Preserve the source simulation primitives and tests; use deterministic pre-event saves/native clock advancement for reachable events, and prepared source-state checkpoints for otherwise unproven event states. Keep actual MIDI/PCM event verification at the simulation/audio boundary when it cannot be reached through ordinary original controls. Do not maintain hidden product controls solely for browser tests. Then retire diagnostic Locate/state prose after checking original AutoGoto, Map and source Message coverage. This audit changes that implementation plan; it does not claim the overall disaster system or port is complete.

## Fingerprints

| File range (end exclusive) | SHA256 |
| --- | --- |
| 0x227e..0x22d0 | `6e2bb5026f91d332291650a7a584bc1ad7404c7cf699b44bcde248748da43e7a` |
| 0x5dba..0x5dd5 | `c27c58cc4f7cc24cefa3f37e2449b67760be1a9154343f599172f6c1aff7e1e1` |
| 0x6338..0x6369 | `777fc0c842666a3b5d3d78fbc4cd67c346c96a398aa79df212d1a5cb524c711d` |
| 0xf254..0xf35b | `f4d083943e22e24820977d08162cb8b6c34a2227358946385f7241f0dcbe4bc1` |
| 0xf6b5..0xf6c5 | `69c916a321ec1263604c629c47875472df4fb2a324f879640cae77fdad1f35f2` |
| 0x3e3b0..0x3e456 | `c47edb1a09acb7dde554928461fc4dcf849b172de36ebba3fa38cda4be40b88f` |
| 0x36836..0x36853 | `0afd0a1ca512ea23be07e5d40367d7f4e4ce98830af43ce1db305e66a826b520` |
| 0x364b0..0x36574 | `74ac786b9b39bf78a53c45ba425abd38370177978bbad30ceb74441805744592` |
