import type { GameAssets } from '../assets/game-assets';
import { loadSavedFarmTiles } from '../assets/game-assets';
import { GameSimulation } from '../simulation/game';
import type { Autosave } from './autosave';

export interface RestoredFarm { scenarioId: number | null; simulation: GameSimulation; tiles: HTMLImageElement }

/** Startup restore of the IndexedDB current game through the same path as Load from File, paused.
 * An unreadable record is moved aside (kept, not overwritten); missing assets leave it in place. */
export async function restoreStoredGame(autosave: Autosave, assets: GameAssets, signal: AbortSignal):
  Promise<{ farm?: RestoredFarm; notice?: string }> {
  const record = await autosave.read();
  if (!record) return {};
  let restored: ReturnType<typeof GameSimulation.load>;
  try {
    if (record.version !== 1 || typeof record.text !== 'string') throw new Error('unknown save record');
    restored = GameSimulation.load(record.text, assets.catalog.crops, assets.townLayouts);
  } catch (error) {
    await autosave.reject(record);
    return { notice: `Saved farm could not be restored (${error instanceof Error ? error.message : String(error)}); it was kept aside.` };
  }
  try {
    const tiles = await loadSavedFarmTiles(restored.simulation.getSnapshot().scenario, restored.scenarioId, signal);
    restored.simulation.dispatch({ type: 'set-paused', paused: true });
    return { farm: { ...restored, tiles } };
  } catch (error) {
    return { notice: `Saved farm could not be restored: ${error instanceof Error ? error.message : String(error)}` };
  }
}
