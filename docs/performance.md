# Native performance work — 2026-10-13

User requested four optimizations, one local commit each. These are native implementation changes, not recovered DOS behavior or original-game defects. Keep simulation ownership, detached views, exact checkpoints, source assets, browser pacing and original artwork intact.

1. Restore incremental world painting when neither aircraft nor a tornado/swarm sprite is visible. **Implemented.** Disaster state exists even with zero flags; only bits1/32 draw sprites. Retain full redraw during those sprites and once after removal.
2. Reuse unchanged detached scenario sections rather than allocating all world cells, records and source bytes every publish. **Implemented.** Compare actual values/all bytes to repair accidentally edited current views; never share with mutable ownership. Historical values, mutation/save isolation, binary tails and deterministic continuation pass focused tests. Unchanged members are shared between read-only UI views. A warmed Bun timer-only copier benchmark measured medians632.3ms full-copy/192.5ms reuse for1,000 copies; browser gains remain unmeasured.
3. Skip expensive closed-window contents while retaining React selection/form state and window placement. **Next.** Check reopen, live data, stacking, focus and mobile scaling.
4. Reuse world-renderer comparison buffers. **Pending.** Keep randomized incremental/full pixel equivalence and palette/bank invalidation.

Initial browser instrumentation (development Chromium, clock driven): a paused AutoScroll toggle with unchanged terrain made9,281 world drawImage calls; resume plus one wall-clock second made575,544. These are work counts, not measured frame-time or device-speed gains. After step1, unchanged option publishes make zero world draws for flags0/8/64/128. Tests verify retained full redraw for bits1/32 and restoration of base pixels on removal. Aircraft/disaster sprite pixel checks and harvest-worker animation remain relevant.

Further work should follow profiling after these four changes. Active aircraft/disasters still intentionally repaint the whole world; narrower sprite damage tracking is outside this batch.

Full regression will run sequentially after this related batch: scenario view structure and window rendering affect many consumers. Focused checks establish each commit's behavior before that milestone.
