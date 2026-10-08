import { readNativeSave, writeNativeSave } from '../formats/native-save';
import { climateForSetup } from '../formats/new-farm';
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
import { createStartupCalendar, initializeStartingTown } from './starting-environment';
import { initializeStartingMarket } from './starting-market';
import { initializeStartupWeather } from './weather';
import { initializeStartingTraffic } from './starting-traffic';

export type RestartFarmOptions = Omit<NewFarmOptions, 'seeds'>;

/** Generated chooser outcome of restart402a8 ->4060c ->3f854 -> main2343.
 * One explicitly requested landscape generation; DOS preview/menu rerolls and
 * elapsed interrupts remain outside the native setup UI model. No reseeding.
 * The candidate is detached; caller validates final state/assets before use. */
export function restartGeneratedFarm(previous: SimulationState, options: RestartFarmOptions, assets: NewFarmAssets): SimulationState {
  const prior = readNativeSave(writeNativeSave(previous, null)).state;
  if (!prior.setup.terrainHistory) throw new Error('This older save has no retained terrain history. Start a fresh farm instead.');
  const calendar = createStartupCalendar(options.date), climate = climateForSetup(assets.climate, options.climate);
  if (typeof options.river !== 'boolean' || typeof options.lake !== 'boolean') throw new Error('Invalid terrain water option');
  if (prior.townLayoutBytes && prior.townLayoutBytes.some((b, i) => b !== assets.townLayouts.bytes[i])) throw new Error('Restart uses different town layouts');
  const oldAnimationTicks = prior.scenario.farm.animationTicks;
  const sourceArchive = prior.scenario.sourceBytes ?? prior.setup.sourceArchive;
  const random = new FarmRandom(prior.random), terrainRandom = new TerrainRandom(random, prior.setup.terrainHistory);
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
  const soilMoisture = options.climate.precipitation * 4;
  const world = generateFarmTerrain(regions, { soilMoisture, river: options.river, lake: options.lake }, random, terrainRandom);
  const locations = selectStartingLocations(world, random);
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
    setup: { terrainHistory, sourceArchive: sourceArchive ? Uint8Array.from(sourceArchive) : null },
    newFarm: { provenance: { kind: 'restart', version: 1, options: { ...structuredClone(options), seeds: { ...prior.random } } },
      terrainHistory: [...terrainHistory], raw: runtime.raw, plannerBuffer: [...records.plannerBuffer] },
    retainedSetup: null, crops, cropMarketPrices,
    market: { history, mood: prior.market.mood, rawBC72: prior.market.rawBC72 },
    random: random.snapshot(), weather: activity.weather, traffic: snapshotTraffic(traffic), disasters: activity.disasters,
    finances: { ...runtime.finances, defaultDecision: null },
    townLayoutBytes: [...assets.townLayouts.bytes],
    dayTicks: transferCalendarPhase(oldAnimationTicks, prior.dayTicks, runtime.farm.animationTicks),
    equipmentAnimationTick: runtime.farm.animationTicks,
    // Native session/view policy: replace modal work, start paused, reset day display.
    paused: true, elapsed: 0, daysAdvanced: 0, pendingTown: null, aircraftFlight: null };
}
