import type { ClimateSelection } from '../formats/new-farm';
import type { NewFarmRuntimeDefaults } from '../formats/new-farm-runtime';
import type { TrafficDefaults } from '../formats/traffic';
import type { RandomState } from './random';
import type { TerrainRandomHistory } from './terrain-random';

export interface NewFarmOptions {
  climate: ClimateSelection;
  river: boolean;
  lake: boolean;
  date: { year: number; dayOfWeek: number };
  seeds: RandomState;
}
/** Recovered state not yet consumed by ongoing market/traffic updates. Preserve
 * it independently of live prices and never reconstruct it by replaying setup. */
export interface NewFarmState {
  provenance: { kind: 'cold-start'; version: 1; options: NewFarmOptions };
  raw: NewFarmRuntimeDefaults['raw'];
  terrainHistory: TerrainRandomHistory;
  plannerBuffer: number[];
  marketMood: number;
  marketHistory: number[][];
  traffic: TrafficDefaults;
}
