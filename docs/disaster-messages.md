# Original disaster Message dialogs

Restored the eight start and four ending messages through canonical transient events and movable React dialogs. All titles, captions and message words are actual text. Source artwork remains1×; Edit remains fixed and maximized. This replaces log-only event presentation, not the remaining original event/trigger reconstruction.

## Source evidence

SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Overlay10 starts at file364b0. Start36574..36d08 has SHA256 `046109e5d1cf8d38d1bb4df5ead2181ef8b88e3246ccc3936c681d5728caa1d1`; stop36d16..3709c has SHA256 `ecadc5b52e7b83806f44183ca73fdf8fe6def05e5f0c56f65fbe7ac5a99c84b3` (ends exclusive). Confidence high for the listed call arguments and gates, pinned by source tests.

All calls use resident0636:10f4/file9654, x192/y150, OK1, and text2d9f:c3e4. Frame256×192, portrait local72,24 at112×64, text local16,96, OK104,156 at48×24. Reuses the caption-free imported Message/button assets and alltiles.btl portrait atlas documented in financial-messages.md. The initialized filename strings in DS69ba..6a85 are events.dat. That archive member is at896380, length16282, SHA256 `616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb`. Loader4a2ee reads256 bytes and terminates at254; renderer882e wraps words and treats source line padding as whitespace.

| Event | Record | Portrait | Popup call | Honors Messages |
| --- | ---: | ---: | --- | --- |
| Frost starts |49|56|365f8|Yes|
| Wind starts |48|57|366ef|Yes|
| Crop circles |50|65|3679b|No|
| Toxic land |51|59|36869|No|
| Tornado starts |52|63|368e6|No|
| Drought starts |53|58|369fd|Yes|
| Flood starts |54|62|36b62|Yes|
| Locusts start |55|47|36c42|Yes|
| Wind ends |57|57|36d82|Yes|
| Tornado ends |20|63|36dfe|Yes|
| Drought ends |58|58|36f34 jumps to36df8/36dfe|Yes|
| Flood ends |56|62|37057|Yes|

Start preference comparisons against a8a1 are365da,366d1,369df,36b44 and36c24. Mandatory start branches have no such comparison. Ending gates are36d56,36dcf,36f19 and37039. Frost36d38, crop-circle36d4a and locust36d6c stop branches only clear state/checks; no invented ending popup is added. Toxic land has no stop-table entry. Tornado stop retains its1920-tick minimum age. Drought/flood restore shoreline state before the ending popup; wind clears its flag after its original synchronous popup.

## Native behavior and limits

The plain TypeScript simulation emits one disaster-notice for each successful event transition. Failed starts do not emit a popup; the source history-price callback can still run before active-event rejection (retained SF-130). Loading/snapshotting does not replay notifications. Existing interim detail logs remain supplementary and may contain information that never had an original popup.

A single React queue preserves publication order across disaster and financial messages. The current modal blocks background input and edge scrolling and suspends browser elapsed-time delivery until acknowledgement. OK and Escape acknowledge; title dragging/arrow movement remain available. Acknowledgement does not write canonical state or saves. No schema or pacing change; native saves remainv25.

As with financial notices, canonical commands/frames finish before publishing queued requests. This is a documented adaptation, not faithful suspension at each original mid-function popup: initial terrain/damage, later phases of the same command, sound requests and AutoGoto may already have run before acknowledgement. Reconstructing a saved continuation for those intermediate calls is deferred. Original audio/window lifecycle, natural trigger reachability and multiple-window stacking remain incomplete. No original-game defect is inferred merely from mandatory messages ignoring the optional preference.

## Validation

Source tests pin all rows/portraits/gates and coordinate pushes, including the shared drought tail. All256 truncation boundaries per record, NUL handling and input immutability are checked. Live tests cover all eight starts with Messages on/off, failed repeats, no replay and exact checkpoint continuation, four endings with both preferences and absence of invented frost/swarm popups.

Browser tests check each of the twelve messages, decoded words, every portrait pixel against the local atlas, source geometry, text fit, mandatory/optional behavior, exact saves, reload, modal blocking, title movement, keyboard acknowledgement, running-time suspension/resume and interleaved financial notices. Related disaster, Options and financial flows are checked with focused regression. See progress.md for counts and corrections; full suites are intentionally not repeated for this bounded feature.
