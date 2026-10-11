import { Binary } from '../formats/binary';
import { readScenario } from '../formats/scenario';
import { readFinancialState } from '../formats/finance';
import { climateForSetup, type ClimateSelection } from '../formats/new-farm';
import { createSetupRecords } from '../formats/new-farm-records';
import { readNativeSave, writeNativeSave } from '../formats/native-save';
import { createTrafficState, snapshotTraffic } from '../formats/traffic';
import { createColdSetupIrrigation, createNewFarmState, type NewFarmAssets } from './create-farm';
import { restartGeneratedFarm, type RestartFarmOptions } from './restart-farm';
import { beginTerrainPreview, generateGeographicTerrain } from './terrain-preview';
import { initialTerrainHistory } from './terrain-random';
import { FarmRandom, type RandomState } from './random';
import type { NewFarmOptions } from './new-farm-state';
import type { SimulationState } from './save-state';
import { createSetupRuntime } from './new-farm-runtime';
import { finalizeRegionFarm } from './starting-environment';
import { synchronizeSetupIrrigation } from './restart-activity';
import { createColdMarket, loadMarketCropPrices } from './market';
import { initializeWeather, type StartupWeatherPolicy } from './weather';
import { initializeStartingTraffic } from './starting-traffic';
import { createMovingDisasters } from './moving-disasters';
import { createWaterDisasters } from './water-disasters';
import { createAnimalFrameState } from './animal-world';
import { createAircraftServiceState } from './aircraft';
import { initialOriginalPause } from './original-pause';

/** Geographic result3: preliminary generation, second generation with retained
 * soil/water, then sites/property/finalization. No custom controls or reroll. */
export function createGeographicFarm(options: NewFarmOptions, assets: NewFarmAssets, weatherPolicy: StartupWeatherPolicy = 'original'): SimulationState {
  const preliminary = beginTerrainPreview(new Uint8Array(1008), options.seeds, initialTerrainHistory(options.seeds.simulation), 8, 'cold');
  return createNewFarmState({ ...options, river: true, lake: false }, assets, generateGeographicTerrain(preliminary), weatherPolicy);
}
export function restartGeographicFarm(previous: SimulationState, options: RestartFarmOptions, assets: NewFarmAssets, weatherPolicy: StartupWeatherPolicy = 'original'): SimulationState {
  const prior = readNativeSave(writeNativeSave(previous, null)).state;
  if (!prior.setup.terrainHistory) throw new Error('This older save has no retained terrain history. Start a fresh farm instead.');
  const preliminary = beginTerrainPreview(prior.scenario.regionalConditions, prior.random, prior.setup.terrainHistory, prior.weather.soilMoisture, 'restart');
  return restartGeneratedFarm(prior, { ...options, river: false, lake: false }, assets, generateGeographicTerrain(preliminary), weatherPolicy);
}

/** Cold geographic result2. Do not construct a generated playable farm first:
 * that would draw sites, grant land and initialize random market/weather twice.
 * Cold EXE owners supply the globals omitted by the SSM, then one main startup
 * weather/traffic phase follows loaded climate/cash/town finalization. */
export function createGeographicRegion(bytes: Uint8Array, selection: ClimateSelection, seeds: RandomState, assets: NewFarmAssets, weatherPolicy: StartupWeatherPolicy = 'original'): SimulationState {
  const climate = climateForSetup(assets.climate, selection);
  const preliminary = beginTerrainPreview(new Uint8Array(1008), seeds, initialTerrainHistory(seeds.simulation), 8, 'cold');
  const runtime = createSetupRuntime(assets.runtime, createSetupRecords(assets.records));
  const scenario = readScenario(bytes, false, { workerExpenses: runtime.farm.workerExpenses, irrigation: createColdSetupIrrigation(assets.runtime) });
  const finances = readFinancialState(bytes, runtime.finances);
  const crops = scenario.cropFiles.map(file => {
    const crop = assets.crops.find(c => `${c.id}.crp` === file);
    if (!crop) throw new Error(`Missing simulation crop ${file}`);
    return [...crop.rawDefinition];
  });
  const market = createColdMarket(); loadMarketCropPrices(market, crops);
  const cropMarketPrices = crops.map((crop, slot) => {
    const price = crop[34] | crop[35] << 8;
    scenario.cropDefinitions[slot].price = price;
    scenario.seedDefinitions[slot].price = Math.max(5, (crop[38] | crop[39] << 8) >>> 2);
    return price;
  });
  synchronizeSetupIrrigation(scenario.irrigation, scenario.farm.animationTicks);
  finalizeRegionFarm(scenario, finances, assets.townLayouts, climate);
  const random = new FarmRandom(preliminary.random);
  const weather = initializeWeather(climate, scenario.farm.calendar, scenario.farm.precipitationDays, random, scenario.cells, preliminary.terrain.soilMoisture, weatherPolicy);
  const traffic = createTrafficState({ ...assets.traffic, delay: new Binary(bytes).u16(0x2171e) });
  initializeStartingTraffic(traffic, finances.town.activeSite, random);
  return { scenario, finances, crops, cropMarketPrices, market, random: random.snapshot(), weather, traffic: snapshotTraffic(traffic),
    setup: { climateSelection: { ...selection }, terrainHistory: preliminary.terrainHistory, previewRaw: preliminary.raw, sourceArchive: null }, newFarm: null, retainedSetup: null,
    townLayoutBytes: [...assets.townLayouts.bytes],
    // Calendar timestamp DS1f8e is initialized0 and not loaded;13a0 is loaded.
    dayTicks: scenario.farm.animationTicks, equipmentAnimationTick: scenario.farm.animationTicks,
    daysAdvanced: 0, paused: true, originalPause: { ...initialOriginalPause(), depth: bytes[0x21719] }, speed: 1, elapsed: 0, grassTravelCount: 0,
    disasters: createMovingDisasters(), waterDisasters: createWaterDisasters(), animalFrame: createAnimalFrameState(),
    aircraftService: createAircraftServiceState(), aircraftFlight: null, pendingTown: null };
}
