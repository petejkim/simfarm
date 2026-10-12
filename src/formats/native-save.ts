import { validateTownEventMap } from '../simulation/town-event-map';
import { coldTownEvent } from '../simulation/town-event-lifecycle';
import { decodeTownEventCheckpoint, encodeTownEventCheckpoint } from './town-event-save';
import { allCropFiles } from './crop-slots';
import type { SessionSetup } from '../simulation/session-setup';
import { unknownOriginalPause, type OriginalPauseState } from '../simulation/original-pause';
import { validateMarketState, type MarketState } from '../simulation/market';
import type { NewFarmState } from '../simulation/new-farm-state';
import { coldTrafficDefaults, createTrafficState, type TrafficDefaults } from './traffic';
import { createMovingDisasters, validateMovingDisasters, type MovingDisasterState } from '../simulation/moving-disasters';
import { createWaterDisasters, validateWaterDisasters, type WaterDisasterState } from '../simulation/water-disasters';
import { readScenario, type Scenario } from './scenario';
import { FieldSchedule, FIELD_SCHEDULE_SIZE } from './field-schedule';
import type { SavedFarmState } from './scenario-state';
import { advanceCalendarDay, validateCalendar } from '../simulation/calendar';
import { FarmRandom } from '../simulation/random';
import type { WeatherState } from '../simulation/weather';
import { SIMULATION_SPEEDS, type SimulationState, type PendingTownExpansion } from '../simulation/save-state';
import { readFinancialState } from './finance';
import { readAnnualStatistics } from './annual-statistics';
import { readHomestead } from './homestead';
import { decodeFinancialState, encodeFinancialState } from './finance-save';
import { TOWN_LAYOUT_BYTES } from './town';
import { MAX_IRRIGATION_FLOW, validateIrrigation, type IrrigationState } from './irrigation';
import { createAircraftServiceState } from '../simulation/aircraft';
import { FLIGHT_CONTROLS, MAX_FLIGHT_INPUTS, validFlightAircraft, type AircraftFlight } from '../simulation/aircraft-flight';
import { createAnimalFrameState } from '../simulation/animal-world';

import { SCENARIO_TABLES as tables, decodeScenarioRecords, type ScenarioTableBytes } from './scenario-records';

export const MAX_SAVE_BYTES = 1_000_000;
const FORMAT = 'simfarm-native';
function fail(label: string): never { throw new Error(`Invalid native save: ${label}`); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label);
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number, label: string, integer = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) fail(label);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(label);
  return value;
}
function numbers(value: unknown, length: number, min: number, max: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length) fail(label);
  return value.map(n => number(n, min, max, label));
}
function decodeOriginalPause(value: unknown): OriginalPauseState {
  const p = object(value, 'original pause'), checks = p.speedChecks;
  if (!Array.isArray(checks) || checks.length !== 5) fail('original speed checks');
  return { depth: p.depth === null ? null : number(p.depth, 0, 255, 'original pause depth'),
    speedChecks: checks.map(value => value === null ? null : number(value, 0, 255, 'original speed checks')) as OriginalPauseState['speedChecks'] };
}
const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
function bytes(value: unknown, length: number, label: string): Uint8Array {
  if (typeof value !== 'string' || value.length !== length * 2 || !/^[\da-f]+$/.test(value)) fail(label);
  return Uint8Array.from({ length }, (_, i) => parseInt(value.slice(i * 2, i * 2 + 2), 16));
}
function encodeScenario(s: Scenario) {
  const world = new Uint8Array(96 * 96 * 5), view = new DataView(world.buffer);
  s.cells.forEach((c, i) => { view.setUint16(i * 5, c.terrain, true); view.setUint16(i * 5 + 2, c.overlay, true); world[i * 5 + 4] = c.attribute; });
  return { origin: s.origin, source: s.sourceBytes === null ? null : hex(s.sourceBytes), cropFiles: s.cropFiles, world: hex(world), schedule: hex(s.schedule.bytes), regions: hex(s.regionalConditions), farm: s.farm, climate: s.climate,
    irrigation: { ...s.irrigation, sources: hex(s.irrigation.sources) },
    records: Object.fromEntries(Object.entries(tables).map(([key, [, , stride]]) => {
      const records = s[key as keyof typeof tables], raw = new Uint8Array(records.length * stride);
      records.forEach((r, i) => raw.set(r.bytes, i * stride));
      return [key, hex(raw)];
    })) };
}
function decodeFarm(value: unknown, version: number, original: SavedFarmState | null): SavedFarmState {
  const f = object(value, 'farm'), calendar = object(f.calendar, 'calendar');
  const result = {} as SavedFarmState;
  for (const key of ['cash', 'seedExpenses', 'rentalExpenses', 'cropIncome', 'contractGains', 'contractLosses',
    'salesAccumulator', 'workerExpenses', 'landExpenses', 'chemicalExpenses'] as const) result[key] = number(f[key], 0, 0xffffffff, key);
  for (const key of ['timerTicks', 'animationTicks', 'dayDelayTicks', 'speed', 'precipitationDays'] as const) result[key] = number(f[key], 0, 65535, key);
  for (const key of ['autoRent', 'autoBuySeeds', 'autoClear', 'paceEquipment'] as const) result[key] = boolean(f[key], key);
  // Older checkpoints had no editable preferences; recover their original save bytes
  // or the verified generated-farm defaults without discarding unknown source bytes.
  for (const key of ['autoScroll', 'autoGoto', 'messages'] as const) result[key] = version >= 25 ? boolean(f[key], key) : original?.[key] ?? (key !== 'autoGoto');
  result.equipmentPacingByte = version >= 22 && f.equipmentPacingByte !== null ? number(f.equipmentPacingByte, 0, 255, 'equipment pacing byte') : null;
  if (result.equipmentPacingByte !== null && result.paceEquipment !== (result.equipmentPacingByte !== 0)) fail('inconsistent equipment pacing gate');
  for (const key of ['townRegionX', 'townRegionY'] as const) result[key] = number(f[key], 0, 11, key);
  result.calendar = { day: number(calendar.day, 0, 6, 'day'), week: number(calendar.week, 0, 3, 'week'),
    month: number(calendar.month, 0, 11, 'month'), year: number(calendar.year, 0, 65535, 'year'), season: number(calendar.season, 0, 3, 'season') };
  validateCalendar(result.calendar);
  return result;
}
function decodeScenario(value: unknown, version: number): Scenario {
  const s = object(value, 'scenario'), records = object(s.records, 'records');
  const origin = version >= 15 ? s.origin : 'original';
  if (origin !== 'original' && origin !== 'generated') fail('farm origin');
  if (origin === 'generated' && s.source !== null) fail('generated source template');
  const source = origin === 'original' ? bytes(s.source, 139072, 'source template') : null;
  const irrigation = version >= 9 ? decodeIrrigation(s.irrigation) : undefined;
  const original = source ? readScenario(source, false, version >= 18 && irrigation ? { workerExpenses: 0, irrigation } : undefined) : null;
  let cropFiles = original?.cropFiles;
  if (version >= 15) {
    if (!Array.isArray(s.cropFiles) || !(version >= 25 ? [16, 24] : [version === 24 ? 24 : 16]).includes(s.cropFiles.length) || s.cropFiles.some(n => typeof n !== 'string' || !/^[a-z0-9_]{1,8}\.crp$/.test(n))) fail('crop filenames');
    cropFiles = [...s.cropFiles];
    if (original && cropFiles.slice(0, 16).some((file, i) => file !== original.cropFiles[i])) fail('original crop filenames');
  }
  if (!cropFiles) fail('crop filenames');
  if (cropFiles.length === 24) { try { allCropFiles(cropFiles); } catch { fail('expanded crop catalog'); } }
  const cropCount = cropFiles.length;
  const raw = {} as ScenarioTableBytes;
  for (const [key, [, originalCount, stride]] of Object.entries(tables)) {
    const count = key === 'cropDefinitions' ? cropCount + 8 : key === 'seedDefinitions' || key === 'harvestDefinitions' ? cropCount : originalCount;
    raw[key as keyof ScenarioTableBytes] = bytes(records[key], count * stride, key);
  }
  const world = bytes(s.world, 96 * 96 * 5, 'world'), view = new DataView(world.buffer);
  const climate = object(s.climate, 'climate');
  return { ...decodeScenarioRecords(raw, cropCount), origin, sourceBytes: source, version: original?.version ?? null, cropFiles,
    schedule: version >= 2 ? new FieldSchedule(bytes(s.schedule, FIELD_SCHEDULE_SIZE, 'field schedule')) : original!.schedule,
    cells: Array.from({ length: 96 * 96 }, (_, i) => ({ terrain: view.getUint16(i * 5, true), overlay: view.getUint16(i * 5 + 2, true), attribute: world[i * 5 + 4] })),
    regionalConditions: bytes(s.regions, 12 * 12 * 7, 'regions'),
    climate: { wind: numbers(climate.wind, 240, -128, 127, 'wind table'),
      precipitation: numbers(climate.precipitation, 240, -128, 7, 'precipitation table'),
      temperature: numbers(climate.temperature, 240, -128, 127, 'temperature table') },
    irrigation: irrigation ?? original!.irrigation,
    farm: decodeFarm(s.farm, version, original?.farm ?? null) }; // No repeat of DOS startup's lost/overwritten ledgers (SF-014).
}

function decodeWeather(value: unknown): WeatherState {
  const w = object(value, 'weather'), result = {} as WeatherState;
  for (const key of ['current'] as const) result[key] = number(w[key], 0, 4, key);
  for (const key of ['forecast', 'nextForecast'] as const) result[key] = numbers(w[key], 7, 0, 4, key);
  for (const key of ['wind', 'soilMoisture', 'displayTemperature'] as const) result[key] = number(w[key], -128, 127, key);
  for (const key of ['moistureBalance', 'precipitationBonus', 'windAnomaly', 'temperatureAnomaly', 'temperature'] as const) result[key] = number(w[key], -32768, 32767, key);
  for (const key of ['precipitationYear', 'temperatureYear', 'windYear'] as const) result[key] = number(w[key], 0, 4, key);
  result.precipitationDays = number(w.precipitationDays, 0, 65535, 'precipitationDays');
  result.precipitationActive = boolean(w.precipitationActive, 'precipitationActive');
  return result;
}
function decodeDisasters(runtime: Record<string, unknown>, version: number): MovingDisasterState {
  const flags = number(runtime.disasterFlags, 0, 65535, 'disaster flags');
  if (version < 13) {
    // Legacy flags had no moving effect/clocks. Do not invent an active disaster.
    return { ...createMovingDisasters(), flags: flags & ~33 };
  }
  const r = object(runtime.disasters, 'disasters');
  const effect = (value: unknown) => {
    const e = object(value, 'disaster effect');
    return { frame: number(e.frame, 0, 3, 'disaster frame'), x: number(e.x, 0, 100, 'disaster X'),
      y: number(e.y, 0, 100, 'disaster Y'), dx: number(e.dx, -1, 1, 'disaster direction X'),
      dy: number(e.dy, -1, 1, 'disaster direction Y'), lastTick: number(e.lastTick, 0, 65535, 'disaster last tick'),
      startedTick: number(e.startedTick, 0, 65535, 'disaster start tick') };
  };
  const d: MovingDisasterState = { enabled: boolean(r.enabled, 'disasters enabled'),
    flags: number(r.flags, 0, 65535, 'disaster flags'), frameDelay: number(r.frameDelay, 0, 65535, 'disaster delay'),
    lastStartTick: number(r.lastStartTick, 0, 65535, 'last disaster start'),
    windReferenceTick: number(r.windReferenceTick, 0, 65535, 'wind reference tick'),
    tornado: effect(r.tornado), swarm: { ...effect(r.swarm), fieldSlot: number(object(r.swarm, 'swarm').fieldSlot, 0, 97, 'swarm field') } };
  if (d.flags !== flags) fail('inconsistent disaster flags');
  validateMovingDisasters(d); return d;
}
function decodeIrrigation(value: unknown): IrrigationState {
  const s = object(value, 'irrigation');
  if (!Array.isArray(s.flow) || s.flow.length > MAX_IRRIGATION_FLOW) fail('irrigation flow');
  const state: IrrigationState = {
    sources: bytes(s.sources, 192, 'irrigation sources'), sourceCount: number(s.sourceCount, 0, 64, 'irrigation source count'),
    phase: number(s.phase, 0, 1, 'irrigation phase') as 0 | 1, active: boolean(s.active, 'irrigation active'),
    delay: number(s.delay, 0, 65535, 'irrigation delay'), lastTick: number(s.lastTick, 0, 65535, 'irrigation last tick'),
    flow: s.flow.map(value => { const p = object(value, 'irrigation packet');
      return { x: number(p.x, 0, 95, 'irrigation X'), y: number(p.y, 0, 95, 'irrigation Y'), strength: number(p.strength, 0, 255, 'irrigation strength') }; }),
  };
  validateIrrigation(state); return state;
}
function decodeWaterDisasters(value: unknown): WaterDisasterState {
  const w = object(value, 'water disasters');
  const state = { counter: number(w.counter, -128, 127, 'flood counter'), scanning: boolean(w.scanning, 'flood scanning'),
    scanX: number(w.scanX, 0, 94, 'flood scan X'), scanY: number(w.scanY, 0, 93, 'flood scan Y'),
    rawFF6C: number(w.rawFF6C, 0, 65535, 'flood raw FF6C'), rawFF6E: number(w.rawFF6E, 0, 65535, 'flood raw FF6E') };
  validateWaterDisasters(state); return state;
}
/** A modal event checkpoints the already-advanced public date, retaining the
 * original weekly date solely to resume the correct source call boundary. */
function validateTownEventContinuation(state: SimulationState): void {
  const { pending, continuation: c } = encodeTownEventCheckpoint(state.townEvent);
  if (!pending && !c) return;
  if (!pending || !c || !state.paused || state.elapsed !== 0 || (c.phase !== 'debug' && state.dayTicks !== 0) ||
    state.pendingTown || state.finances.defaultDecision || state.aircraftFlight || !state.finances.town.recreationCount)
    fail('town event continuation');
  if(c.phase==='debug'){
    const current=state.scenario.farm.calendar;
    if(Object.keys(c.before).some(key=>c.before[key as keyof typeof current]!==current[key as keyof typeof current]))fail('debug event continuation date');
    return;
  }
  const isResult = pending.kind === 'fair-result' || pending.kind === 'rodeo-result';
  if (c.phase !== (isResult ? 'weekly-water' : 'weekly-rollover')) fail('town event continuation phase');
  const next = advanceCalendarDay(c.before).calendar, current = state.scenario.farm.calendar;
  if (Object.keys(next).some(key => next[key as keyof typeof next] !== current[key as keyof typeof next])) fail('town event continuation date');
  if (!isResult && (c.before.week !== 3 || c.before.month !== (pending.kind === 'rodeo-entry' ? 5 : 8))) fail('town event entry date');
}

export function writeNativeSave(state: SimulationState, scenarioId: number | null): string {
  if (state.scenario.origin === 'generated') {
    if (scenarioId !== null || state.scenario.sourceBytes !== null || state.scenario.version !== null || !state.newFarm || state.retainedSetup !== null) fail('generated provenance');
  } else {
    if (scenarioId !== null) number(scenarioId, 0, 7, 'scenario ID');
    if (state.scenario.origin !== 'original' || !state.scenario.sourceBytes || state.newFarm !== null) fail('original provenance');
  }
  validateTownEventContinuation(state);
  if (state.townEvent.mode) validateTownEventMap(state.scenario, state.finances.town, state.townEvent);
  const { scenario, finances, ...runtime } = state;
  const text = JSON.stringify({ format: FORMAT, version: 28, scenarioId, scenario: encodeScenario(scenario),
    runtime: { ...runtime, townEvent: encodeTownEventCheckpoint(state.townEvent), setup: { ...state.setup, sourceArchive: state.setup.sourceArchive ? hex(state.setup.sourceArchive) : null }, disasterFlags: state.disasters.flags, animalFrame: { ...state.animalFrame, herd: hex(state.animalFrame.herd) }, finances: encodeFinancialState(finances) } });
  if (text.length > MAX_SAVE_BYTES) fail('file too large');
  return text;
}
export function readNativeSave(text: string): { scenarioId: number | null; state: SimulationState } {
  if (text.length > MAX_SAVE_BYTES) fail('file too large');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { fail('JSON'); }
  const save = object(parsed, 'document');
  if (save.format !== FORMAT || typeof save.version !== 'number' || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].includes(save.version)) fail('unsupported format or version');
  const s = decodeScenario(save.scenario, save.version), r = object(save.runtime, 'runtime');
  const scenarioId = s.origin === 'generated' || (save.version >= 18 && save.scenarioId === null) ? null : number(save.scenarioId, 0, 7, 'scenario ID');
  if (s.origin === 'generated' && save.scenarioId !== null) fail('generated scenario ID');
  const newFarm = save.version >= 15 ? decodeNewFarm(r.newFarm, save.version) : null;
  if ((s.origin === 'generated') !== (newFarm !== null)) fail('farm startup provenance');
  const random = object(r.random, 'random');
  const rng = new FarmRandom({ visual: number(random.visual, 0, 65535, 'visual RNG'),
    simulation: number(random.simulation, 0, 65535, 'simulation RNG'), bounded: number(random.bounded, 0, 65535, 'bounded RNG') });
  if (!Array.isArray(r.crops) || r.crops.length !== s.cropFiles.length) fail('crop definitions');
  const speed = number(r.speed, 0.25, 16, 'speed', false);
  if (!SIMULATION_SPEEDS.some(n => n === speed)) fail('speed');
  const animalFrame = createAnimalFrameState();
  if (save.version >= 10) {
    const a = object(r.animalFrame, 'animal frame');
    animalFrame.lastCentreTick = number(a.lastCentreTick, 0, 65535, 'animal centre tick');
    animalFrame.lastMoveTick = number(a.lastMoveTick, 0, 65535, 'animal move tick');
    animalFrame.herd = bytes(a.herd, 21, 'animal herd cache');
  }
  const cropMarketPrices = numbers(r.cropMarketPrices, s.cropFiles.length, 0, 65535, 'crop prices');
  const market = save.version >= 16 ? decodeMarket(r.market, s.cropFiles.length) : save.version === 15 && newFarm
    ? decodeLegacyGeneratedMarket(r.newFarm)
    : { history: cropMarketPrices.map(price => [...Array(29).fill(null), price]), mood: 0, rawBC72: 0 };
  const retainedSetup = save.version >= 18 ? decodeNewFarm(r.retainedSetup, save.version) : null;
  if (s.origin === 'generated' && retainedSetup !== null) fail('duplicate setup state');
  const setup = save.version >= 19 ? decodeSessionSetup(r.setup, save.version) : { terrainHistory: (newFarm ?? retainedSetup)?.terrainHistory ? [...(newFarm ?? retainedSetup)!.terrainHistory] as SessionSetup['terrainHistory'] : null, sourceArchive: null, previewRaw: null, climateSelection: null };
  if (s.origin === 'generated' && setup.terrainHistory === null) fail('missing generated terrain history');
  const state: SimulationState = { scenario: s, setup, newFarm, retainedSetup, crops: r.crops.map(c => numbers(c, 128, 0, 255, 'crop bytes')),
    originalPause: save.version >= 23 ? decodeOriginalPause(r.originalPause) : unknownOriginalPause(),
    townLayoutBytes: save.version >= 5 ? numbers(r.townLayoutBytes, TOWN_LAYOUT_BYTES, 0, 255, 'town layout bytes') : null,
    townEvent: save.version >= 26 ? decodeTownEventCheckpoint(save.version === 26 ? { ...object(r.townEvent, 'town event'), continuation: null } : r.townEvent) : coldTownEvent(),
    pendingTown: save.version >= 6 ? decodePendingTown(r.pendingTown) : null,
    random: rng.snapshot(), weather: decodeWeather(r.weather), daysAdvanced: number(r.daysAdvanced, 0, Number.MAX_SAFE_INTEGER, 'days advanced'),
    paused: boolean(r.paused, 'paused'), speed, elapsed: number(r.elapsed, 0, 1, 'fractional ticks', false),
    dayTicks: number(r.dayTicks, 0, save.version >= 18 ? 65535 : Math.max(1, s.farm.dayDelayTicks) - 1, 'day ticks'),
    disasters: decodeDisasters(r, save.version), grassTravelCount: number(r.grassTravelCount, 0, 65535, 'grass wear'),
    waterDisasters: save.version >= 14 ? decodeWaterDisasters(r.waterDisasters) : createWaterDisasters(),
    equipmentAnimationTick: number(r.equipmentAnimationTick, 0, 65535, 'equipment animation tick'),
    animalFrame,
    aircraftService: save.version >= 11 ? { selectedChemical: number(object(r.aircraftService, 'aircraft service').selectedChemical, 221, 223, 'aircraft chemical') }
      : createAircraftServiceState(),
    aircraftFlight: save.version >= 12 ? decodeFlight(r.aircraftFlight, s) : null,
    cropMarketPrices, market,
    traffic: save.version >= 17 ? decodeTraffic(r.traffic) : newFarm
      ? decodeTraffic(object(r.newFarm, 'new farm state').traffic) : coldTrafficDefaults(),
    finances: save.version >= 3 ? decodeFinancialState({ ...object(r.finances, 'financial state'),
      ...(save.version === 3 ? { defaultDecision: null } : {}),
      ...(save.version < 8 ? { homestead: readHomestead(originalSource(s)) } : {}),
      ...(save.version < 7 ? { statistics: readAnnualStatistics(originalSource(s)) } : {}) }) : readFinancialState(originalSource(s)) };
  validateTownEventContinuation(state);
  if (state.townEvent.mode) validateTownEventMap(state.scenario, state.finances.town, state.townEvent);
  if (state.finances.defaultDecision && !state.paused) fail('unpaused terminal default');
  if (state.aircraftFlight && (state.finances.defaultDecision || state.pendingTown)) fail('flight during modal decision');
  const town = state.finances.town.activeSite, townIndex = (town.regionX * 12 + town.regionY) * 7;
  // A reserved, unbuilt plot still contains its original regional byte. The
  // chooser replaces it before weekly development can use it as a district.
  if (!state.pendingTown && s.regionalConditions[townIndex + 1] === 2 && (s.regionalConditions[townIndex] & 15) === 15) fail('active town district type');
  if (state.pendingTown) {
    const { site } = state.pendingTown, c = s.farm.calendar;
    if (!state.paused || state.finances.defaultDecision || state.elapsed !== 0 || state.dayTicks !== 0 ||
      c.day !== 0 || c.week !== 0 || c.month !== 0 || s.farm.salesAccumulator !== 0 ||
      site.regionX !== town.regionX || site.regionY !== town.regionY || s.regionalConditions[townIndex + 1] !== 2) fail('pending town continuation');
  }
  if (state.elapsed >= 1) fail('fractional ticks');
  if (state.cropMarketPrices.some((price, i) => price !== s.cropDefinitions[i].price)) fail('inconsistent crop prices');
  return { scenarioId, state };
}

function decodeFlight(value: unknown, world: Scenario): AircraftFlight | null {
  if (value === null) return null;
  const f = object(value, 'aircraft flight');
  const columns = number(f.columns, 8, 80, 'flight columns'), rows = number(f.rows, 8, 80, 'flight rows');
  if (f.active !== true || !Array.isArray(f.inputs) || f.inputs.length > MAX_FLIGHT_INPUTS ||
    !f.inputs.every(input => FLIGHT_CONTROLS.includes(input))) fail('flight controls');
  const result: AircraftFlight = {
    slot: number(f.slot, 1, 126, 'flight slot'), columns, rows,
    cameraX: number(f.cameraX, 0, 96 - columns, 'flight camera X'), cameraY: number(f.cameraY, 0, 96 - rows, 'flight camera Y'),
    offsetX: number(f.offsetX, 3 - (columns >> 1), (columns >> 1) - 3, 'flight offset X'),
    offsetY: number(f.offsetY, 3 - (rows >> 1), (rows >> 1) - 3, 'flight offset Y'),
    heading: number(f.heading, 0, 7, 'flight heading'), altitude: number(f.altitude, 1, 100, 'flight altitude'),
    spraying: boolean(f.spraying, 'flight spraying'), sprayFrame: number(f.sprayFrame, 0, 3, 'flight spray frame'),
    lastFrameTick: number(f.lastFrameTick, 0, 65535, 'flight frame tick'),
    lastWearTick: number(f.lastWearTick, 0, 65535, 'flight wear tick'),
    lastFuelTick: number(f.lastFuelTick, 0, 65535, 'flight fuel tick'),
    lastSprayTick: number(f.lastSprayTick, 0, 65535, 'flight spray tick'),
    turbulence: boolean(f.turbulence, 'flight turbulence'), turbulenceTick: number(f.turbulenceTick, 0, 65535, 'flight turbulence tick'),
    spin: number(f.spin, 0, 65535, 'flight spin'), inputs: [...f.inputs], active: true,
    resumePaused: boolean(f.resumePaused, 'flight return pause'),
  };
  if (!validFlightAircraft(world, result.slot)) fail('flight aircraft/home');
  const tick = world.farm.animationTicks;
  if (((tick - result.lastFrameTick) & 65535) > 1 || ((tick - result.lastFuelTick) & 65535) > 33 ||
    ((tick - result.lastWearTick) & 65535) > 33) fail('flight clock');
  return result;
}

function decodePendingTown(value: unknown): PendingTownExpansion | null {
  if (value === null) return null;
  const p = object(value, 'pending town'), site = object(p.site, 'pending town site');
  if (p.phase !== 'annual-reset') fail('pending town phase');
  if (p.resumeTickTail !== undefined && p.resumeTickTail !== true) fail('pending town tick tail');
  return { ...(p.resumeTickTail === true ? { resumeTickTail: true as const } : {}), phase: 'annual-reset', resumeRunning: boolean(p.resumeRunning, 'pending town run state'),
    site: { regionX: number(site.regionX, 0, 11, 'pending town X'), regionY: number(site.regionY, 0, 11, 'pending town Y') } };
}

/** Only legacy original saves may obtain missing runtime fields from an SSM. */
function originalSource(s: Scenario): Uint8Array {
  if (s.origin !== 'original' || !s.sourceBytes) fail('missing legacy source');
  return s.sourceBytes;
}
function decodeNewFarm(value: unknown, version: number): NewFarmState | null {
  if (value === null) return null;
  const n = object(value, 'new farm state'), p = object(n.provenance, 'setup provenance');
  if ((p.kind !== 'cold-start' && !(version >= 19 && p.kind === 'restart')) || p.version !== 1) fail('setup version');
  const o = object(p.options, 'setup options'), c = object(o.climate, 'setup climate'), d = object(o.date, 'setup date'), rng = object(o.seeds, 'setup seeds');
  const raw = object(n.raw, 'setup raw');
  return { provenance: { kind: p.kind as 'cold-start' | 'restart', version: 1, options: {
    climate: { precipitation: number(c.precipitation, 0, 3, 'setup rain'), temperature: number(c.temperature, 0, 3, 'setup temperature'), wind: number(c.wind, 0, 3, 'setup wind') },
    river: boolean(o.river, 'setup river'), lake: boolean(o.lake, 'setup lake'),
    date: { year: number(d.year, 0, 65535, 'setup year'), dayOfWeek: number(d.dayOfWeek, 0, 6, 'setup weekday') },
    seeds: { visual: number(rng.visual, 0, 65535, 'setup visual seed'), simulation: number(rng.simulation, 0, 65535, 'setup simulation seed'), bounded: number(rng.bounded, 0, 65535, 'setup bounded seed') },
  } }, raw: { ds3e4c: number(raw.ds3e4c, 0, 0xffffffff, 'raw3e4c'), ds3eb8: number(raw.ds3eb8, 0, 0xffffffff, 'raw3eb8'),
    ds4468: numbers(raw.ds4468, 19, 0, 65535, 'raw4468'), ds64c5: number(raw.ds64c5, 0, 255, 'raw64c5'), s4d9fFedd: number(raw.s4d9fFedd, 0, 255, 'rawFedd') },
    terrainHistory: numbers(n.terrainHistory, 5, 0, 65535, 'terrain history') as NewFarmState['terrainHistory'],
    plannerBuffer: numbers(n.plannerBuffer, 3072, 0, 255, 'planner scratch') };
}

function decodeTraffic(value: unknown): TrafficDefaults {
  const t = object(value, 'traffic');
  if (!Array.isArray(t.records) || t.records.length !== 16) fail('traffic records');
  const traffic = { records: t.records.map(r => numbers(r, 8, 0, 255, 'traffic bytes')),
    activeCount: number(t.activeCount, 0, 16, 'traffic count'), delay: number(t.delay, 0, 65535, 'traffic delay'), lastTick: number(t.lastTick, 0, 65535, 'traffic tick') };
  createTrafficState(traffic); return traffic;
}

/** Missing legacy samples remain explicitly unknown; only the latest word feeds
 * price arithmetic. V15 generated histories/mode move intact, without RNG. */
function decodeLegacyGeneratedMarket(value: unknown): MarketState {
  const n = object(value, 'legacy generated market');
  if (!Array.isArray(n.marketHistory) || n.marketHistory.length !== 16) fail('market history');
  return { history: n.marketHistory.map(row => numbers(row, 30, 0, 65535, 'market history')),
    mood: number(n.marketMood, 0, 255, 'market mood'), rawBC72: 0 };
}
function decodeMarket(value: unknown, cropCount = 16): MarketState {
  const m = object(value, 'market');
  if (!Array.isArray(m.history) || m.history.length !== cropCount) fail('market history');
  const market = { history: m.history.map(row => {
    if (!Array.isArray(row) || row.length !== 30) fail('market history');
    return row.map((price, i) => price === null && i < 29 ? null : number(price, 0, 65535, 'market price'));
  }), mood: number(m.mood, 0, 255, 'market mood'), rawBC72: number(m.rawBC72, 0, 255, 'market raw BC72') };
  validateMarketState(market); return market;
}


function decodeSessionSetup(value: unknown, version: number): SessionSetup {
  const s = object(value, 'session setup');
  const sourceArchive = s.sourceArchive === null ? null : bytes(s.sourceArchive, 139072, 'archived source');
  if (sourceArchive && sourceArchive[0] !== 0x18) fail('archived source version');
  const raw = version >= 20 && s.previewRaw !== null ? object(s.previewRaw, 'preview raw') : null;
  const previewRaw = raw ? { ds1521: number(raw.ds1521, 0, 255, 'preview DS1521'), ds23db: number(raw.ds23db, 0, 255, 'preview DS23db') } : null;
  const selected = version >= 21 && s.climateSelection !== null ? object(s.climateSelection, 'setup climate selection') : null;
  const climateSelection = selected ? {
    precipitation: number(selected.precipitation, 0, 3, 'setup precipitation selection'),
    temperature: number(selected.temperature, 0, 3, 'setup temperature selection'),
    wind: number(selected.wind, 0, 3, 'setup wind selection'),
  } : null;
  return { climateSelection, previewRaw, terrainHistory: s.terrainHistory === null ? null : numbers(s.terrainHistory, 5, 0, 65535, 'session terrain history') as SessionSetup['terrainHistory'], sourceArchive };
}
