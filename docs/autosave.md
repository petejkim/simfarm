# Browser-stored current game (autosave)

Native feature (user request, 2026-10-12); the DOS original has no equivalent. One IndexedDB slot (`simfarm` database, `games` store, key `current`) holds `{ version: 1, savedAt, text }`. The `text` is the native checkpoint exactly as `GameSimulation.save` produces it, so restoring uses the proven Load from File path. Window placement and other presentation state are not stored.

## When it saves

- **New game or loaded file:** immediately when New Game starts a farm and after Load from File....
- **Week rollover:** at each calendar week rollover (year/month/week change of `scenario.farm.calendar`).
- **Manual:** File → **Save** (status "Farm saved.").
- **Hide or close:** when the tab becomes hidden (`visibilitychange`), and best-effort on `pagehide`. These flushes skip writing if the simulation snapshot is unchanged since the last save.

A save serialises synchronously (about 10 ms for a ~572 KB checkpoint) and queues the IndexedDB `put` before its first `await`, so a hide/close handler captures the snapshot even if the commit lands later. The first successful save calls `navigator.storage.persist()`.

## Startup

`App` restores the stored game before the first farm mounts, through `GameSimulation.load` and `loadSavedFarmTiles`, and pauses it (status "Saved farm restored (paused)."). With no record it starts Scenario 1 as before, unsaved until one of the triggers above. An unreadable record moves to key `rejected` (kept, not overwritten) and the game falls back to Scenario 1 with a notice. If assets fail to load, the record is left in place.

## Tabs

Only the tab holding the `simfarm-current-game` Web Lock writes. Another tab's Save reports "Another SimFarm tab is saving this farm." and queues for the lock, taking over when the owner closes.

## File menu (native labels over the source item order)

About SimFarm · New Game · **Save** (IndexedDB) · **Save to File...** (source Save As slot) · **Load from File...** (source Load Game). Load Crop and Quit (and its pause dialog) are omitted. The decoded source labels are unchanged.

- **Save to File...** uses `showSaveFilePicker` where available (Chromium), opened first so the menu click still counts as user activation, then writes the gzip checkpoint. Elsewhere it downloads the dated file. Cancelling reports "Save to file cancelled." without an error dialog.
- **Load from File...** uses `showOpenFilePicker` where available, otherwise the file input. Either way it continues through the existing loader.

## Code

`src/storage/game-store.ts` (IndexedDB), `src/storage/autosave.ts` (triggers, flush, lock; plain TypeScript, StrictMode-safe `connect`), `src/storage/restore.ts` (startup restore). React wires them in `App`, `FarmView` (`attach`) and `SaveControls`.

## Tests

- **Playwright config:** launches Chromium with `--disable-blink-features=FileSystemAccessLocal`, so existing tests use the download and file-input fallbacks.
- **`tests/browser/autosave.spec.ts`:** covers the menu, manual save and paused restore, week rollover, New Game/Load saves, hide flush, the unreadable-record fallback, the second-tab lock, and the picker paths via stub pickers (save, load, cancel).
- **Existing specs:** two that reloaded expecting a fresh Scenario 1 now expect the restored game.
