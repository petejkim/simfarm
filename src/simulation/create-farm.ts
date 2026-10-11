import { copyLocatedTerrainPreview, type TerrainPreviewState } from './terrain-preview';
import type { CropDefinition } from '../formats/crop';
import { climateForSetup, type ClimatePresets } from '../formats/new-farm';
import { createSetupRecords, type NewFarmRecordDefaults } from '../formats/new-farm-records';
import type { NewFarmRuntimeDefaults } from '../formats/new-farm-runtime';
import { createTrafficState, snapshotTraffic, type TrafficDefaults } from '../formats/traffic';
import { validateIrrigation, type IrrigationState } from '../formats/irrigation';
import type { TownLayouts } from '../formats/town';
import type { Scenario } from '../formats/scenario';
import type { SimulationState } from './save-state';
import type { NewFarmOptions } from './new-farm-state';
import { createSetupRuntime } from './new-farm-runtime';
import { createSetupSchedule, loadStartingCrops } from './new-farm-records';
import { generateFarmTerrain } from './terrain-generation';
import { FarmRandom } from './random';
import { TerrainRandom, initialTerrainHistory } from './terrain-random';
import { initializeStartingProperty, selectStartingLocations } from './starting-property';
import { createStartupCalendar, initializeStartingTown } from './starting-environment';
import { initializeStartingMarket } from './starting-market';
import { initializeStartingTraffic } from './starting-traffic';
import { initializeWeather, type StartupWeatherPolicy } from './weather';
import { createMovingDisasters } from './moving-disasters';
import { createWaterDisasters } from './water-disasters';
import { createAircraftServiceState } from './aircraft';
import { createAnimalFrameState } from './animal-world';
import { initialOriginalPause } from './original-pause';

export interface NewFarmAssets {
  records: NewFarmRecordDefaults;
  runtime: NewFarmRuntimeDefaults;
  traffic: TrafficDefaults;
  climate: ClimatePresets;
  crops: readonly CropDefinition[];
  townLayouts: TownLayouts;
}

/** Known initialized registry, before any chooser SSM transfers. */
export function createColdSetupIrrigation(defaults: NewFarmRuntimeDefaults): IrrigationState {
  if (defaults.irrigation.sources.length !== 192 || defaults.irrigation.sources.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Invalid cold irrigation bytes');
  const state: IrrigationState = { ...defaults.irrigation, sources: Uint8Array.from(defaults.irrigation.sources), phase: 0, active: false, flow: [] };
  validateIrrigation(state); return state;
}
/** Main first-launch sequence, with explicit seeds/date and no SSM input.
 * A supplied preview already owns terrain/sites/RNG; Play must not redraw them.
 * See docs/new-farm.md for each recovered phase and remaining fidelity gaps. */
export function createNewFarmState(options: NewFarmOptions, assets: NewFarmAssets, accepted?: TerrainPreviewState, weatherPolicy: StartupWeatherPolicy = 'original'): SimulationState {
  const preview = accepted ? copyLocatedTerrainPreview(accepted) : null;
  const calendar = createStartupCalendar(options.date), climate = climateForSetup(assets.climate, options.climate);
  if (typeof options.river !== 'boolean' || typeof options.lake !== 'boolean') throw new Error('Invalid terrain water option');
  const random = new FarmRandom(preview?.random ?? options.seeds), terrainRandom = new TerrainRandom(random, preview?.terrainHistory ?? initialTerrainHistory(options.seeds.simulation));
  const records = createSetupRecords(assets.records), runtime = createSetupRuntime(assets.runtime, records);
  const regionData = new Uint8Array(1008); for (let i = 0; i < 144; i++) regionData[i * 7] = 255;
  const soilMoisture = preview?.terrain.soilMoisture ?? options.climate.precipitation * 4;
  const world = preview?.world ?? generateFarmTerrain(regionData, { soilMoisture, river: options.river, lake: options.lake }, random, terrainRandom);
  const placement = preview ? { ok: true as const, locations: preview.locations } : selectStartingLocations(world, random);
  if (!placement.ok) throw new Error('No starting property fits this terrain. Choose another seed or water setting.');
  const { player, town } = placement.locations, property = initializeStartingProperty(world, player);
  runtime.farm.cash = property.cash; runtime.finances.homestead = property.homestead;
  runtime.finances.accounts.homeRegionX = player.regionX; runtime.finances.accounts.homeRegionY = player.regionY;
  if (!initializeStartingTown(world, runtime, assets.townLayouts, town).ok) throw new Error('Invalid starting town');
  runtime.farm.calendar = calendar;
  const crops = loadStartingCrops(records, assets.records.cropFiles, assets.crops);
  const cropMarketPrices = records.cropDefinitions.slice(0, 16).map(d => d.price);
  const marketHistory = initializeStartingMarket(cropMarketPrices, records.marketMood, random);
  const schedule = createSetupSchedule(records.plannerBuffer);
  const weather = initializeWeather(climate, calendar, runtime.farm.precipitationDays, random, world.cells, soilMoisture, weatherPolicy);
  const traffic = createTrafficState(assets.traffic); initializeStartingTraffic(traffic, town, random);
  // Cold registry is empty. Setup phase/flow are zero; delay is the EXE's64,
  // not the3 read from supplied saved farms. Original ring aliases are SF-088.
  const irrigation = createColdSetupIrrigation(assets.runtime);
  const scenario: Scenario = { origin: 'generated', sourceBytes: null, version: null,
    cells: world.cells, regionalConditions: world.regionalConditions, schedule, climate, farm: runtime.farm,
    cropFiles: [...assets.records.cropFiles], fields: records.fields, equipment: records.equipment,
    animals: records.animals, buildings: records.buildings, inventory: records.inventory, chemicals: records.chemicals,
    equipmentDefinitions: records.equipmentDefinitions, buildingDefinitions: records.buildingDefinitions,
    seedDefinitions: records.seedDefinitions, cropDefinitions: records.cropDefinitions,
    harvestDefinitions: records.harvestDefinitions, chemicalDefinitions: records.chemicalDefinitions, irrigation };
  return { scenario, crops, setup: { climateSelection: { ...options.climate }, terrainHistory: terrainRandom.snapshot(), sourceArchive: null, previewRaw: preview ? { ...preview.raw } : null }, retainedSetup: null, townLayoutBytes: [...assets.townLayouts.bytes], random: random.snapshot(), weather,
    newFarm: { provenance: { kind: 'cold-start', version: 1, options: structuredClone(options) }, raw: runtime.raw,
      terrainHistory: terrainRandom.snapshot(), plannerBuffer: [...records.plannerBuffer] },
    traffic: snapshotTraffic(traffic),
    daysAdvanced: 0, paused: true, originalPause: initialOriginalPause(), speed: 1, elapsed: 0, dayTicks: 0,
    disasters: createMovingDisasters(), waterDisasters: createWaterDisasters(),
    grassTravelCount: 0, equipmentAnimationTick: 0, animalFrame: createAnimalFrameState(),
    aircraftService: createAircraftServiceState(), aircraftFlight: null, cropMarketPrices,
    market: { history: marketHistory, mood: records.marketMood, rawBC72: 0 },
    finances: runtime.finances, pendingTown: null };
}
