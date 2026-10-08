import { beginTerrainPreview, copyLocatedTerrainPreview, type TerrainPreviewState } from './terrain-preview';
import { readNativeSave, writeNativeSave } from '../formats/native-save';
import { climateForSetup, type ClimateSelection } from '../formats/new-farm';
import type { SetupRecords } from '../formats/new-farm-records';
import { createTrafficState, snapshotTraffic } from '../formats/traffic';
import type { NewFarmAssets } from './create-farm';
import type { NewFarmOptions } from './new-farm-state';
import type { SimulationState } from './save-state';
import { resetSetupRuntime } from './new-farm-runtime';
import { createSetupSchedule, loadStartingCrops, resetSetupRecords } from './new-farm-records';
import { resetSetupActivity, synchronizeSetupIrrigation } from './restart-activity';
import { transferCalendarPhase } from './calendar-clock';
import { generateFarmTerrain } from './terrain-generation';
import { FarmRandom } from './random';
import { TerrainRandom } from './terrain-random';
import { initializeStartingProperty, selectStartingLocations } from './starting-property';
import { createStartupCalendar, initializeStartingTown, finalizeRegionFarm } from './starting-environment';
import { initializeStartingMarket } from './starting-market';
import { initializeStartupWeather } from './weather';
import { initializeStartingTraffic } from './starting-traffic';
import { loadOriginalFarmState } from './original-load';

export type RestartFarmOptions = Omit<NewFarmOptions, 'seeds'>;

/** Common partial resets before either chooser outcome; intermediate state is
 * detached and intentionally not a playable/native-checkpoint boundary. */
function prepareRestart(previous: SimulationState, assets: NewFarmAssets) {
  const prior = readNativeSave(writeNativeSave(previous, null)).state;
  if (prior.townLayoutBytes && prior.townLayoutBytes.some((b, i) => b !== assets.townLayouts.bytes[i])) throw new Error('Restart uses different town layouts');
  const oldAnimationTicks = prior.scenario.farm.animationTicks;
  const activity = resetSetupActivity({ cells: prior.scenario.cells, irrigation: prior.scenario.irrigation,
    weather: prior.weather, disasters: prior.disasters, traffic: prior.traffic });
  const records: SetupRecords = { ...prior.scenario,
    animalDefinitions: prior.finances.accounts.assets.animalDefinitions, otherDefinitions: prior.finances.accounts.otherDefinitions,
    plannerBuffer: new Uint8Array(3072), marketMood: prior.market.mood };
  // Every scratch word is overwritten by4093b; no old unknown byte is assumed0.
  resetSetupRecords(records);
  const runtime = { farm: prior.scenario.farm, finances: prior.finances,
    raw: structuredClone((prior.newFarm ?? prior.retainedSetup)?.raw ?? assets.runtime.raw) };
  // Every raw member is reset here except Fedd, overwritten by town setup below.
  resetSetupRuntime(runtime, activity.weather);
  const regions = Uint8Array.from(prior.scenario.regionalConditions);
  for (let i = 0; i < 144; i++) { regions[i * 7] = 255; regions[i * 7 + 1] = 0; }
  prior.scenario.cells = activity.cells; prior.scenario.irrigation = activity.irrigation;
  prior.scenario.regionalConditions = regions;
  prior.weather = activity.weather; prior.traffic = activity.traffic; prior.disasters = activity.disasters;
  prior.dayTicks = transferCalendarPhase(oldAnimationTicks, prior.dayTicks, runtime.farm.animationTicks);
  return { prior, activity, records, runtime, regions };
}

/** Generated chooser outcome of restart402a8 ->4060c ->3f854 -> main2343.
 * Accept a located preview when supplied, otherwise generate one selected map.
 * Elapsed DOS interrupts remain outside the native setup model. No reseeding. */
export function restartGeneratedFarm(previous: SimulationState, options: RestartFarmOptions, assets: NewFarmAssets, accepted?: TerrainPreviewState): SimulationState {
  const preview = accepted ? copyLocatedTerrainPreview(accepted) : null;
  const { prior, activity, records, runtime, regions } = prepareRestart(previous, assets);
  if (!prior.setup.terrainHistory) throw new Error('This older save has no retained terrain history. Start a fresh farm instead.');
  const calendar = createStartupCalendar(options.date), climate = climateForSetup(assets.climate, options.climate);
  if (typeof options.river !== 'boolean' || typeof options.lake !== 'boolean') throw new Error('Invalid terrain water option');
  const sourceArchive = prior.scenario.sourceBytes ?? prior.setup.sourceArchive;
  const random = new FarmRandom(preview?.random ?? prior.random), terrainRandom = new TerrainRandom(random, preview?.terrainHistory ?? prior.setup.terrainHistory);
  const soilMoisture = preview?.terrain.soilMoisture ?? options.climate.precipitation * 4;
  const world = preview?.world ?? generateFarmTerrain(regions, { soilMoisture, river: options.river, lake: options.lake }, random, terrainRandom);
  const locations = preview ? { ok: true as const, locations: preview.locations } : selectStartingLocations(world, random);
  if (!locations.ok) throw new Error('No starting property fits this terrain. Change the water settings or start a fresh farm.');
  const { player, town } = locations.locations, property = initializeStartingProperty(world, player);
  runtime.farm.cash = property.cash; runtime.finances.homestead = property.homestead;
  runtime.finances.accounts.homeRegionX = player.regionX; runtime.finances.accounts.homeRegionY = player.regionY;
  synchronizeSetupIrrigation(activity.irrigation, runtime.farm.animationTicks);
  if (!initializeStartingTown(world, runtime, assets.townLayouts, town).ok) throw new Error('Invalid restart town');
  runtime.farm.calendar = calendar;
  const crops = loadStartingCrops(records, assets.records.cropFiles, assets.crops);
  const cropMarketPrices = records.cropDefinitions.slice(0, 16).map(d => d.price);
  const history = initializeStartingMarket(cropMarketPrices, prior.market.mood, random);
  activity.weather.soilMoisture = soilMoisture;
  initializeStartupWeather(activity.weather, climate, calendar, random, world.cells);
  const traffic = createTrafficState(activity.traffic); initializeStartingTraffic(traffic, town, random);
  const terrainHistory = terrainRandom.snapshot();
  return { ...prior,
    scenario: { ...prior.scenario, ...world, origin: 'generated', sourceBytes: null, version: null, climate,
      cropFiles: [...assets.records.cropFiles], schedule: createSetupSchedule(records.plannerBuffer), irrigation: activity.irrigation },
    setup: { terrainHistory, previewRaw: preview ? { ...preview.raw } : prior.setup.previewRaw, sourceArchive: sourceArchive ? Uint8Array.from(sourceArchive) : null },
    newFarm: { provenance: { kind: 'restart', version: 1, options: { ...structuredClone(options), seeds: { ...prior.random } } },
      terrainHistory: [...terrainHistory], raw: runtime.raw, plannerBuffer: [...records.plannerBuffer] },
    retainedSetup: null, crops, cropMarketPrices,
    market: { history, mood: prior.market.mood, rawBC72: prior.market.rawBC72 },
    random: random.snapshot(), weather: activity.weather, traffic: snapshotTraffic(traffic), disasters: activity.disasters,
    finances: { ...runtime.finances, defaultDecision: null },
    townLayoutBytes: [...assets.townLayouts.bytes],
    dayTicks: prior.dayTicks,
    equipmentAnimationTick: runtime.farm.animationTicks,
    // Native session/view policy: replace modal work, start paused, reset day display.
    paused: true, elapsed: 0, daysAdvanced: 0, pendingTown: null, aircraftFlight: null };
}

/** Loaded chooser result2: reset -> SSM transfers -> climate/cash/town -> main
 * weather/traffic. Skip new date, property, default crops and random history.
 * Preliminary generation is discarded by SSM loading but advances its streams. */
export function restartRegionFarm(previous: SimulationState, bytes: Uint8Array,
  selection: ClimateSelection, assets: NewFarmAssets): SimulationState {
  const climate = climateForSetup(assets.climate, selection);
  const { prior } = prepareRestart(previous, assets);
  if (!prior.setup.terrainHistory) throw new Error('This older save has no retained terrain history. Start a fresh farm instead.');
  const preview = beginTerrainPreview(prior.scenario.regionalConditions, prior.random, prior.setup.terrainHistory, prior.weather.soilMoisture, 'restart');
  prior.random = preview.random;
  prior.setup.terrainHistory = preview.terrainHistory; prior.setup.previewRaw = preview.raw;
  const state = loadOriginalFarmState(prior, bytes, assets.crops);
  synchronizeSetupIrrigation(state.scenario.irrigation, state.scenario.farm.animationTicks);
  finalizeRegionFarm(state.scenario, state.finances, assets.townLayouts, climate);
  const random = new FarmRandom(state.random);
  initializeStartupWeather(state.weather, climate, state.scenario.farm.calendar, random, state.scenario.cells);
  const traffic = createTrafficState(state.traffic);
  initializeStartingTraffic(traffic, state.finances.town.activeSite, random);
  return { ...state, random: random.snapshot(), traffic: snapshotTraffic(traffic),
    townLayoutBytes: [...assets.townLayouts.bytes], equipmentAnimationTick: state.scenario.farm.animationTicks,
    daysAdvanced: 0 };
}
