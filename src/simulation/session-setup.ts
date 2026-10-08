import { initialTerrainHistory, type TerrainRandomHistory } from './terrain-random';

/** Canonical setup continuation, independent of the current farm's provenance. */
export interface SessionSetup {
  /** Null only when a legacy checkpoint did not retain this stream. */
  terrainHistory: TerrainRandomHistory | null;
  /** Wrapper4027e targets; null when no represented preliminary preview ran. */
  previewRaw: { ds1521: number; ds23db: number } | null;
  /** Last original file replaced by a generated restart; unknown source bytes remain available. */
  sourceArchive: Uint8Array | null;
}
/** Native cold entry has not run a DOS chooser/preview. Capture its explicitly
 * supplied initial seed now; never derive missing history from a later RNG state. */
export function createSessionSetup(simulationSeed: number): SessionSetup {
  return { terrainHistory: initialTerrainHistory(simulationSeed), sourceArchive: null, previewRaw: null };
}
