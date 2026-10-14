# Predecoded UI content

User request2026-10-13: decode the43 `card*.hc` resources during import and combine them with `events.dat` and `qmessage.dat` in one JSON. `tools/import.ts` generates ignored `public/assets/ui-content.json` reproducibly from the supplied archive; the browser fetches it once at startup. This replaces45 binary requests with one JSON request. Original resources are still imported unchanged under `public/assets/raw`, and the supplied DOS distribution is never modified.

Schema version1 contains `expertCards` (source page ID and ordered decoded commands), `eventMessages` (source record indices0–62), and `editStatuses` (source quick-message indices0–75). Empty strings and blank records retain their indices. All24 crop pages continue to use the original deck plus the established native page extension; no generated extra page is written into the source deck. Crops' separate expert descriptions remain in the catalog.

Each decoded event record contains its existing paragraph display, parsed `lines` with centered-heading flags, and `physicalText` for the two-line Bulldoze confirmations. This preserves the distinct existing consumers without re-decoding or normalizing records during rendering. Source-derived portrait, notice and record mappings retain their owners. JSON validation bounds command kinds, geometry, control counts, page targets, source picture/crop/tile indices, text lengths and all required record counts. Sound commands accept only the recovered rooster request. Missing/malformed bundles prevent startup with the existing asset error. Binary readers remain callable by preservation tests; browser message readers select the predecoded record.

All importer JSON outputs use compact `JSON.stringify(value)` with no indentation or physical line breaks. Spaces within prose and escaped newline characters remain intact. This includes catalog, manifest, setup/defaults, menus, Examine and Buy. The 2026-10-14 [asset cleanup](generated-assets.md) removes unused MIDI sequence JSON and abandoned MP3 metadata; playback uses converted `.mid` files.

## Source evidence and retained bytes

| Resource | Archive offset / bounds | SHA-256 |
| --- | --- | --- |
|43 Expert cards|IDs1,2,5–8,10–37,40–48;8351bytes total; individual offsets in generated manifest|`52aca80ac8d649e09446a7368ee6360f9d89c109a2bc942a7a521d37c25cfdfc` (numeric-order concatenation)|
|events.dat|896380;16282bytes;63 complete256-byte records plus154bytes|`616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb`|
|qmessage.dat|931591;4866bytes;76 complete64-byte records plus CR/LF|`f49a867d63b52d4157977f6e06dfc231af3689042af3da8ae032cbfcff5594b1`|

Expert card loader/interpreter evidence is in [farm-expert.md](farm-expert.md): overlay28/file4c820, loader4d25a, dispatch4d1ec. The event reader4a2ee exposes the first254bytes of each256-byte record; display rules come from renderer882e..8931. The Edit reader4a0be exposes62bytes of each64-byte record. No semantics are invented for the unread two-byte tails, padding, or final partial event record63. They remain in the unmodified raw files; record63 is not accepted as a complete message. [Financial messages](financial-messages.md), [disaster messages](disaster-messages.md), [Bulldoze](direct-bulldoze.md) and [Edit status](edit-status.md) retain the executable addresses and original boundary/markup evidence.

Confidence is high for unchanged display output: tests compare all43 decoded cards and every complete message record against source bytes, all existing consumers against their binary input, and imported raw bytes against archive members. Original SF-165 resource/string hazards remain recorded; this packaging optimization establishes no new original defect. Native simulation state, checkpoints, HTML text, artwork and audio are unaffected. Fewer requests and import-time decoding are verified; overall startup-time improvement is unmeasured. Focused browser validation covers Expert, Edit history, financial/disaster/rodeo messages, Bulldoze confirmation and bundle failures. Results are in progress.md.
