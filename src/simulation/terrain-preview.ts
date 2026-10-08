import { generateFarmTerrain, type TerrainWorld, type TerrainOptions } from './terrain-generation';
import { FarmRandom, type RandomState } from './random';
import { TerrainRandom, type TerrainRandomHistory } from './terrain-random';
import { selectStartingLocations, type StartingLocations } from './starting-property';

export interface TerrainPreviewState {
  world: TerrainWorld;
  random: RandomState;
  terrainHistory: TerrainRandomHistory;
  terrain: TerrainOptions;
  locations: StartingLocations | null;
  /** Wrapper4027e writes these bytes; their other semantics remain unresolved. */
  raw: { ds1521: number; ds23db: number };
}

/** Source setup3f854 ->4027e ->3fe1a. The chooser has not selected locations.
 * Cold67b4 is1; restart408e6 clears it. Soil is retained, not selected rain*4.
 * This detached setup phase does not reset records/accounts or finalize a farm. */
export function beginTerrainPreview(regions: Uint8Array, randomState: RandomState, history: TerrainRandomHistory,
  soilMoisture: number, entry: 'cold' | 'restart'): TerrainPreviewState {
  if (entry !== 'cold' && entry !== 'restart') throw new Error('Invalid preview entry');
  const random = new FarmRandom(randomState), terrainRandom = new TerrainRandom(random, history);
  if (regions.length !== 1008) throw new Error('Invalid preview regions');
  const reset = Uint8Array.from(regions);
  for (let i = 0; i < 144; i++) { reset[i * 7] = 255; reset[i * 7 + 1] = 0; }
  const terrain = { soilMoisture, river: entry === 'cold', lake: false };
  const world = generateFarmTerrain(reset, terrain, random, terrainRandom);
  return { world, terrain, random: random.snapshot(), terrainHistory: terrainRandom.snapshot(), locations: null,
    raw: { ds1521: 201, ds23db: 201 } };
}

/** Custom entry33146 ->33ca6 ->33aa6 paints existing terrain and chooses sites.
 * Re-entering this source phase draws new sites; merely reading a snapshot does not. */
export function locateTerrainPreview(previous: TerrainPreviewState): TerrainPreviewState {
  const state = structuredClone(previous), random = new FarmRandom(state.random);
  const result = selectStartingLocations(state.world, random);
  if (!result.ok) throw new Error('No starting property fits this preview');
  state.locations = result.locations; state.random = random.snapshot(); return state;
}

/** Custom New Map337a6 writes rainfall*4, generates, then redraws/chooses sites.
 * The caller keeps water/climate control changes separate until this action.
 * No date/crop/property/town/weather/traffic phase or reseeding occurs here. */
export function rebuildTerrainPreview(previous: TerrainPreviewState, rain: number, water: { river: boolean; lake: boolean }): TerrainPreviewState {
  if (!Number.isInteger(rain) || rain < 0 || rain > 3) throw new Error('Invalid preview rainfall');
  const random = new FarmRandom(previous.random), terrainRandom = new TerrainRandom(random, previous.terrainHistory);
  const terrain = { soilMoisture: rain * 4, river: water.river, lake: water.lake };
  const world = generateFarmTerrain(previous.world.regionalConditions, terrain, random, terrainRandom);
  return locateTerrainPreview({ world, terrain, random: random.snapshot(), terrainHistory: terrainRandom.snapshot(),
    locations: null, raw: { ...previous.raw } });
}
