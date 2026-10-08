import { climateForSetup } from '../formats/new-farm';
import { readNativeSave, writeNativeSave } from '../formats/native-save';
import { TownLayouts } from '../formats/town';
import { createNewFarmState, type NewFarmAssets } from './create-farm';
import type { NewFarmOptions } from './new-farm-state';
import { FarmRandom } from './random';
import { restartGeneratedFarm, type RestartFarmOptions } from './restart-farm';
import type { SimulationState } from './save-state';
import { createStartupCalendar } from './starting-environment';
import { initialTerrainHistory } from './terrain-random';
import { beginTerrainPreview, locateTerrainPreview, rebuildTerrainPreview, type TerrainPreviewState } from './terrain-preview';

export interface CustomFarmSetupSnapshot {
  phase: 'preview' | 'accepted' | 'cancelled';
  entry: 'cold' | 'restart';
  settings: RestartFarmOptions;
  preview: TerrainPreviewState;
}

/** Detached custom chooser. React may own form inputs, but terrain, locations
 * and all RNG streams belong here. Source phases:3f8ab,33146,337a6,336f0.
 * No farm history/weather/traffic initialization runs until acceptance.
 * Geographic/preset chooser paths are separate and not composed here yet. */
export class CustomFarmSetup {
  private readonly assets: NewFarmAssets;
  private readonly prior: SimulationState | null;
  private readonly options: NewFarmOptions;
  private preview: TerrainPreviewState;
  private phase: CustomFarmSetupSnapshot['phase'] = 'preview';
  private snapshot: CustomFarmSetupSnapshot;
  private readonly listeners = new Set<() => void>();

  private constructor(options: NewFarmOptions, assets: NewFarmAssets, previous: SimulationState | null) {
    this.assets = { ...structuredClone({ ...assets, townLayouts: undefined }), townLayouts: new TownLayouts(assets.townLayouts.bytes) };
    this.options = structuredClone(options);
    this.validateSettings(options);
    new FarmRandom(options.seeds);
    this.prior = previous ? readNativeSave(writeNativeSave(previous, null)).state : null;
    if (this.prior && !this.prior.setup.terrainHistory) throw new Error('This older save has no retained terrain history. Start a fresh farm instead.');
    // Initialized DS0164/file84854=8; reset does not write it. No rain*4 yet.
    this.preview = locateTerrainPreview(beginTerrainPreview(this.prior?.scenario.regionalConditions ?? new Uint8Array(1008),
      this.prior?.random ?? options.seeds, this.prior?.setup.terrainHistory ?? initialTerrainHistory(options.seeds.simulation),
      this.prior?.weather.soilMoisture ?? 8, this.prior ? 'restart' : 'cold'));
    this.snapshot = this.makeSnapshot();
  }

  static fresh(options: NewFarmOptions, assets: NewFarmAssets): CustomFarmSetup {
    return new CustomFarmSetup(options, assets, null);
  }

  static restart(previous: SimulationState, options: RestartFarmOptions, assets: NewFarmAssets): CustomFarmSetup {
    return new CustomFarmSetup({ ...options, seeds: { ...previous.random } }, assets, previous);
  }

  getSnapshot = (): CustomFarmSetupSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  /** Original controls change options without repainting or drawing RNG. */
  setSettings(settings: RestartFarmOptions): void {
    this.requirePreview(); this.validateSettings(settings);
    const { climate, river, lake, date } = structuredClone(settings);
    Object.assign(this.options, { climate, river, lake, date }); this.publish();
  }

  generateWorld(): void {
    this.requirePreview();
    const next = rebuildTerrainPreview(this.preview, this.options.climate.precipitation, this.options);
    this.preview = next; this.publish();
  }

  /** Play336f0 accepts this landscape/sites, then performs ordinary finalization.
   * Validation failure leaves the draft retryable and the live farm untouched. */
  accept(): SimulationState {
    this.requirePreview();
    const candidate = this.prior
      ? restartGeneratedFarm(this.prior, this.options, this.assets, this.preview)
      : createNewFarmState(this.options, this.assets, this.preview);
    const state = readNativeSave(writeNativeSave(candidate, null)).state;
    this.phase = 'accepted'; this.publish(); return state;
  }

  cancel(): void { this.requirePreview(); this.phase = 'cancelled'; this.publish(); }

  private validateSettings(settings: RestartFarmOptions): void {
    climateForSetup(this.assets.climate, settings.climate); createStartupCalendar(settings.date);
    if (typeof settings.river !== 'boolean' || typeof settings.lake !== 'boolean') throw new Error('Invalid terrain water option');
  }
  private requirePreview(): void { if (this.phase !== 'preview') throw new Error('This setup is already closed'); }
  private makeSnapshot(): CustomFarmSetupSnapshot {
    const { seeds: _, ...settings } = this.options;
    return structuredClone({ phase: this.phase, entry: this.prior ? 'restart' : 'cold', settings, preview: this.preview });
  }
  private publish(): void { this.snapshot = this.makeSnapshot(); for (const listener of this.listeners) listener(); }
}
