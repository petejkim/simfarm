# Player construction reconstruction

Evidence is static analysis of supplied `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets. No original executable is run.

Existing building records/definitions, storage reservation/delivery, demolition and terrain restoration are implemented. Player purchase/placement controls are not yet reconstructed. The immediate goal is to let the player build original usable storage through verified placement and accounting, without bypassing occupied land, construction costs or record capacity.

## Confirmed allocator and accounting entry

Generic addition `0x3a2ca` takes a type, quantity and coordinates. Its building branch `0x3a32a..0x3a377` accepts types 64–127, invokes resident `17d4:0168` / `0x1a0a8`, and on a nonzero return increments the selected definition count. It multiplies unit-price helper `1a66:0a20` by quantity with low-word retention, then adds that value to building book account `6190:3e54`. Only nine building definitions (64–72) are currently verified in the supplied files; the wider dispatch range is not permission to index beyond them. Cash debit and map painting are not performed by this branch and still require caller tracing.

Allocator `0x1a0a8..0x1a17d` scans byte slots 1–126 for a record lacking active flag 0x20, at 70-byte stride. It writes type +0, clears flags +2, writes tile coordinates +4/+5, clears byte +6 and word +8, initializes all twelve storage cells to graphic 217/type -1/slot 0, then sets active and increments global count `6190:2430`. Byte +7 and other unwritten bytes must be retained. Its full-table return is unsafe (SF-081); native placement must preflight capacity before payment/counts/terrain changes.

Next trace the caller's placement validator, affordability/debit, painting and storage initialization order. Reuse canonical building book value and definitions, preserving the existing cold-import uncertainty (SF-065). Add the command/UI only when those pieces compose into a complete atomic placement. Tests should cover original definitions, all retained bytes, map edges, occupancy/ownership, full capacity, affordability, rendering and a harvest delivered into newly built storage. Livestock follows construction rather than further report-detail work.

Adjacent rectangle query `0x1a17e..0x1a243` compares requested cells with building coordinate/dimension rectangles but uses a dense count-limited prefix without checking active flags (SF-082). Trace its callers and any compaction assumptions; native placement tests must explicitly include inactive holes, high active slots and retained inactive coordinates.
