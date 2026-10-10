import { readNativeSave, writeNativeSave } from '../formats/native-save';
import type { NewFarmAssets } from './create-farm';
import { createGeographicFarm, restartGeographicFarm } from './geographic-setup';
import type { NewFarmOptions } from './new-farm-state';
import { transferOriginalFarm } from './original-load';
import type { SimulationState } from './save-state';
import { createSessionSetup } from './session-setup';

export type OriginalStartupOptions = Pick<NewFarmOptions, 'date' | 'seeds'>;

/** Geographic Load/result1:3245a/3245f generates and locates the second map,
 * then returns before the highlighted climate is copied. Like result3 it skips
 * custom design and finalizes a generated farm; unlike result2 main initializes
 * date/crops/market/weather/traffic before the dialog can read an SSM.
 * The native transaction omits elapsed menu time and publishes only success. */
export function createOriginalSaveStartup(bytes: Uint8Array, options: OriginalStartupOptions, assets: NewFarmAssets): SimulationState {
  const climate = createSessionSetup(options.seeds.simulation).climateSelection!;
  const temporary = createGeographicFarm({ ...options, climate, river: true, lake: false }, assets);
  return transferOriginalFarm(temporary, bytes, assets.crops);
}

/** Restart retains the chooser bytes, not the highlighted cell or loaded climate
 * tables. Missing legacy state cannot be reconstructed from past provenance. */
export function restartOriginalSaveStartup(previous: SimulationState, bytes: Uint8Array, date: NewFarmOptions['date'], assets: NewFarmAssets): SimulationState {
  const prior = readNativeSave(writeNativeSave(previous, null)).state;
  if (!prior.setup.climateSelection)
    throw new Error('This older save has no retained climate selection. Choose Start fresh session, or use Load farm to import without restarting.');
  const temporary = restartGeographicFarm(prior, { date, climate: prior.setup.climateSelection, river: false, lake: false }, assets);
  return transferOriginalFarm(temporary, bytes, assets.crops);
}
