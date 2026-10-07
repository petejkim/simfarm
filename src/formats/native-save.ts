import { readScenario, WORLD_OFFSET, type Scenario } from './scenario';
import { FIELD_SCHEDULE_OFFSET, FIELD_SCHEDULE_SIZE } from './field-schedule';
import type { SavedFarmState } from './scenario-state';
import { validateCalendar } from '../simulation/calendar';
import { FarmRandom } from '../simulation/random';
import type { WeatherState } from '../simulation/weather';
import { SIMULATION_SPEEDS, type SimulationState, type PendingTownExpansion } from '../simulation/save-state';
import { readFinancialState } from './finance';
import { decodeFinancialState, encodeFinancialState } from './finance-save';
import { TOWN_LAYOUT_BYTES } from './town';

export const MAX_SAVE_BYTES = 1_000_000;
const FORMAT = 'simfarm-native';
// Offsets/sizes are the existing, source-verified loader layout. Unknown bytes stay in the template.
const tables = {
  fields: [0x45bd, 98, 68], equipment: [0x29f3, 127, 56], animals: [3, 256, 32],
  buildings: [0x5fc7, 127, 70], inventory: [0x8283, 512, 12], chemicals: [0x2005, 127, 20],
  equipmentDefinitions: [0x20994, 12, 18], buildingDefinitions: [0x20a6c, 9, 18],
  seedDefinitions: [0x20e38, 16, 18], cropDefinitions: [0x20b0e, 24, 18],
  harvestDefinitions: [0x20d18, 16, 18], chemicalDefinitions: [0x20f58, 4, 18],
} as const;
const counted = ['fields', 'equipment', 'animals', 'buildings', 'inventory', 'chemicals'] as const;
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
const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
function bytes(value: unknown, length: number, label: string): Uint8Array {
  if (typeof value !== 'string' || value.length !== length * 2 || !/^[\da-f]+$/.test(value)) fail(label);
  return Uint8Array.from({ length }, (_, i) => parseInt(value.slice(i * 2, i * 2 + 2), 16));
}
function encodeScenario(s: Scenario) {
  const world = new Uint8Array(96 * 96 * 5), view = new DataView(world.buffer);
  s.cells.forEach((c, i) => { view.setUint16(i * 5, c.terrain, true); view.setUint16(i * 5 + 2, c.overlay, true); world[i * 5 + 4] = c.attribute; });
  return { source: hex(s.sourceBytes), world: hex(world), schedule: hex(s.schedule.bytes), regions: hex(s.regionalConditions), farm: s.farm, climate: s.climate,
    records: Object.fromEntries(Object.entries(tables).map(([key, [, count, stride]]) => {
      const records = s[key as keyof typeof tables], raw = new Uint8Array(count * stride);
      records.forEach((r, i) => raw.set(r.bytes, i * stride));
      return [key, hex(raw)];
    })) };
}
function decodeFarm(value: unknown): SavedFarmState {
  const f = object(value, 'farm'), calendar = object(f.calendar, 'calendar');
  const result = {} as SavedFarmState;
  for (const key of ['cash', 'seedExpenses', 'rentalExpenses', 'cropIncome', 'contractGains', 'contractLosses',
    'salesAccumulator', 'workerExpenses', 'landExpenses', 'chemicalExpenses'] as const) result[key] = number(f[key], 0, 0xffffffff, key);
  for (const key of ['timerTicks', 'animationTicks', 'dayDelayTicks', 'speed', 'precipitationDays'] as const) result[key] = number(f[key], 0, 65535, key);
  for (const key of ['autoRent', 'autoBuySeeds', 'autoClear', 'paceEquipment'] as const) result[key] = boolean(f[key], key);
  for (const key of ['townRegionX', 'townRegionY'] as const) result[key] = number(f[key], 0, 11, key);
  result.calendar = { day: number(calendar.day, 0, 6, 'day'), week: number(calendar.week, 0, 3, 'week'),
    month: number(calendar.month, 0, 11, 'month'), year: number(calendar.year, 0, 65535, 'year'), season: number(calendar.season, 0, 3, 'season') };
  validateCalendar(result.calendar);
  return result;
}
function decodeScenario(value: unknown, version: number): Scenario {
  const s = object(value, 'scenario'), records = object(s.records, 'records');
  const source = bytes(s.source, 139072, 'source template');
  readScenario(source); // Preserve a valid original template independently of the mutable native state.
  const image = Uint8Array.from(source), view = new DataView(image.buffer);
  if (version >= 2) image.set(bytes(s.schedule, FIELD_SCHEDULE_SIZE, 'field schedule'), FIELD_SCHEDULE_OFFSET);
  image.set(bytes(s.world, 96 * 96 * 5, 'world'), WORLD_OFFSET);
  image.set(bytes(s.regions, 12 * 12 * 7, 'regions'), 0x21273);
  for (const [key, [offset, count, stride]] of Object.entries(tables)) image.set(bytes(records[key], count * stride, key), offset);
  // Rebuild loader counts only in the temporary validation image; original contradictory counts stay in source.
  for (const key of counted) {
    const [offset, count, stride] = tables[key];
    let active = 0;
    for (let i = 0; i < count; i++) active += Number(Boolean(image[offset + i * stride + (key === 'fields' ? 7 : key === 'inventory' ? 10 : 2)] & (key === 'fields' ? 1 : 32)));
    view.setUint16(offset - 2, active, true);
  }
  const climate = object(s.climate, 'climate');
  const wind = numbers(climate.wind, 240, -128, 127, 'wind table');
  const rain = numbers(climate.precipitation, 240, -128, 7, 'precipitation table');
  const temperature = numbers(climate.temperature, 240, -128, 127, 'temperature table');
  for (let i = 0; i < 240; i++) image.set([wind[i] & 255, rain[i] & 255, temperature[i] & 255], 0x206c4 + i * 3);
  const result = readScenario(image, true);
  result.sourceBytes = source;
  result.farm = decodeFarm(s.farm); // Do not repeat DOS startup's lost/overwritten ledgers (SF-014).
  for (const f of result.fields.filter(f => f.active)) {
    if (f.state > 9 || f.step > 16) fail('field work state');
    for (const slot of [f.equipment, f.pendingEquipment]) if (slot && !result.equipment[slot]?.active) fail('field equipment reference');
  }
  for (const def of result.equipmentDefinitions.slice(0, 9)) {
    if (def.type !== def.slot || ![40, 42, 44, 50, 52, 54, 71, 72, 82].includes(def.graphic) ||
      def.width < 1 || def.width > 4 || def.height < 1 || def.height > 4 || def.bytes[10] < 1 || def.bytes[10] > 4) fail('equipment definition');
  }
  // Field passes and attached implements can occupy byte-wrapped border coordinates. Moving heads cannot.
  for (const e of result.equipment.filter(e => e.active)) {
    if (e.type === 7 && e.parent && !result.buildings[e.parent]?.active) fail('harvest truck storage reference');
    if (e.direction > 7 || e.targetX >= 96 || e.targetY >= 96) fail('equipment direction or destination');
    const attached = e.type !== 7 && e.parent !== 0;
    if (!attached && !(e.flags & 8) && (e.x >= 96 || e.y >= 96)) fail('equipment position');
    if (e.fieldSlot && !result.fields[e.fieldSlot]?.active) fail('equipment field reference');
  }
  return result;
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
export function writeNativeSave(state: SimulationState, scenarioId: number): string {
  number(scenarioId, 0, 7, 'scenario ID');
  const { scenario, finances, ...runtime } = state;
  const text = JSON.stringify({ format: FORMAT, version: 6, scenarioId, scenario: encodeScenario(scenario),
    runtime: { ...runtime, finances: encodeFinancialState(finances) } });
  if (text.length > MAX_SAVE_BYTES) fail('file too large');
  return text;
}
export function readNativeSave(text: string): { scenarioId: number; state: SimulationState } {
  if (text.length > MAX_SAVE_BYTES) fail('file too large');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { fail('JSON'); }
  const save = object(parsed, 'document');
  if (save.format !== FORMAT || typeof save.version !== 'number' || ![1, 2, 3, 4, 5, 6].includes(save.version)) fail('unsupported format or version');
  const scenarioId = number(save.scenarioId, 0, 7, 'scenario ID'), s = decodeScenario(save.scenario, save.version), r = object(save.runtime, 'runtime');
  const random = object(r.random, 'random');
  const rng = new FarmRandom({ visual: number(random.visual, 0, 65535, 'visual RNG'),
    simulation: number(random.simulation, 0, 65535, 'simulation RNG'), bounded: number(random.bounded, 0, 65535, 'bounded RNG') });
  if (!Array.isArray(r.crops) || r.crops.length !== 16) fail('crop definitions');
  const speed = number(r.speed, 0.25, 16, 'speed', false);
  if (!SIMULATION_SPEEDS.some(n => n === speed)) fail('speed');
  const state: SimulationState = { scenario: s, crops: r.crops.map(c => numbers(c, 128, 0, 255, 'crop bytes')),
    townLayoutBytes: save.version >= 5 ? numbers(r.townLayoutBytes, TOWN_LAYOUT_BYTES, 0, 255, 'town layout bytes') : null,
    pendingTown: save.version >= 6 ? decodePendingTown(r.pendingTown) : null,
    random: rng.snapshot(), weather: decodeWeather(r.weather), daysAdvanced: number(r.daysAdvanced, 0, Number.MAX_SAFE_INTEGER, 'days advanced'),
    paused: boolean(r.paused, 'paused'), speed, elapsed: number(r.elapsed, 0, 1, 'fractional ticks', false),
    dayTicks: number(r.dayTicks, 0, Math.max(1, s.farm.dayDelayTicks) - 1, 'day ticks'),
    disasterFlags: number(r.disasterFlags, 0, 65535, 'disaster flags'), grassTravelCount: number(r.grassTravelCount, 0, 65535, 'grass wear'),
    equipmentAnimationTick: number(r.equipmentAnimationTick, 0, 65535, 'equipment animation tick'),
    cropMarketPrices: numbers(r.cropMarketPrices, 16, 0, 65535, 'crop prices'),
    finances: save.version >= 3 ? decodeFinancialState(save.version === 3
      ? { ...object(r.finances, 'financial state'), defaultDecision: null } : r.finances) : readFinancialState(s.sourceBytes) };
  if (state.finances.defaultDecision && !state.paused) fail('unpaused terminal default');
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

function decodePendingTown(value: unknown): PendingTownExpansion | null {
  if (value === null) return null;
  const p = object(value, 'pending town'), site = object(p.site, 'pending town site');
  if (p.phase !== 'annual-reset') fail('pending town phase');
  return { phase: 'annual-reset', resumeRunning: boolean(p.resumeRunning, 'pending town run state'),
    site: { regionX: number(site.regionX, 0, 11, 'pending town X'), regionY: number(site.regionY, 0, 11, 'pending town Y') } };
}
