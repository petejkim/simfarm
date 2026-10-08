import type { ClimateSelection } from '../formats/new-farm';
import { initialTerrainHistory, type TerrainRandomHistory } from './terrain-random';

/** Canonical setup continuation, independent of the current farm's provenance. */
export interface SessionSetup {
  /** Null only when a legacy checkpoint did not retain this stream. */
  terrainHistory: TerrainRandomHistory | null;
  /** DS67b6/67b7/67b8 chooser levels; null when absent from a legacy save. */
  climateSelection: ClimateSelection | null;
  /** Wrapper4027e targets; null when no represented preliminary preview ran. */
  previewRaw: { ds1521: number; ds23db: number } | null;
  /** Last original file replaced by a generated restart; unknown source bytes remain available. */
  sourceArchive: Uint8Array | null;
}
/** Native cold entry has not run a DOS chooser/preview. Capture its explicitly
 * supplied initial seed now; never derive missing history from a later RNG state. */
export function createSessionSetup(simulationSeed: number): SessionSetup {
  // Initialized EXE file8aea6..8aea8; ordinary SSM loading does not write these.
  return { climateSelection: { precipitation: 0, temperature: 0, wind: 0 }, terrainHistory: initialTerrainHistory(simulationSeed), sourceArchive: null, previewRaw: null };
}
