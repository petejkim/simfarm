import type { ClimateTables } from '../formats/weather';
import { terrainTile, type WorldCell } from '../formats/scenario';
import type { FarmCalendar } from './calendar';
import type { FarmRandom } from './random';

export interface WeatherState {
  current: number;
  forecast: number[];
  nextForecast: number[];
  wind: number;
  soilMoisture: number;
  moistureBalance: number;
  precipitationActive: boolean;
  precipitationDays: number;
  precipitationBonus: number;
  precipitationYear: number;
  temperatureYear: number;
  windYear: number;
  windAnomaly: number;
  temperatureAnomaly: number;
  temperature: number;
  displayTemperature: number;
}
const signedByte = (value: number) => value << 24 >> 24;

// Stack constants at 0x1e648..0x1e7a0; cold and warm tables have identical precipitation positions.
export const PRECIPITATION_PATTERNS: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0, 0],
  [1, 1, 0, 0, 0, 1, 1], [0, 1, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1],
];

/** Non-precipitation sky selection, 0x1e912..0x1e98d. Consumes one visual RNG call. */
export function chooseSky(temperature: number, random: FarmRandom): number {
  const n = random.nextVisual() & 7;
  if (temperature > 85) return n === 2 ? 1 : n === 5 ? 2 : 0;
  if (temperature > 70) return n === 1 || n === 7 ? 1 : n === 2 || n === 4 ? 2 : 0;
  return n === 0 || n === 4 ? 0 : n === 1 || n === 3 ? 2 : 1;
}

/** Weekly forecast + accumulated soil change, 0x1e63c..0x1e910. Caller supplies post-rollover calendar. */
export function advanceForecast(weather: WeatherState, tables: ClimateTables, calendar: FarmCalendar, random: FarmRandom, cells: WorldCell[]): void {
  if (weather.moistureBalance >= 8 || weather.moistureBalance <= -8) {
    const increase = weather.moistureBalance >= 8;
    let moisture = signedByte(weather.soilMoisture + (weather.moistureBalance >> 3) + (increase ? weather.precipitationBonus : 0));
    moisture = increase ? Math.min(12, moisture) : Math.max(0, moisture);
    weather.soilMoisture = moisture;
    weather.moistureBalance = 0;
    // Both 0x16bd4 and 0x16c78 redraw grass 15..30 from the same attribute/moisture formula.
    for (const cell of cells) {
      const tile = terrainTile(cell);
      if (tile >= 15 && tile < 31) cell.terrain = ((cell.terrain & 0xf800) | ((15 + moisture + (cell.attribute >> 2)) & 65535));
    }
  }
  weather.forecast = [...weather.nextForecast];
  const index = (weather.precipitationYear * 48 + calendar.month * 4 + calendar.week + 1) % 240;
  const count = Math.max(0, tables.precipitation[index]), temperature = tables.temperature[index];
  if (!PRECIPITATION_PATTERNS[count]) throw new Error('Invalid climate precipitation count');
  weather.nextForecast = PRECIPITATION_PATTERNS[count].map(rain => rain ? (temperature > 32 ? 3 : 4) : chooseSky(temperature, random));
}

/** Daily precipitation/evaporation, 0x1e580..0x1e63b. Wind, not temperature, selects evaporation rate. */
export function applyDailyWeather(weather: WeatherState, day: number): void {
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('Invalid weather day');
  weather.current = weather.forecast[day];
  const code = weather.current;
  if (code < 0 || code > 4) return;
  weather.precipitationActive = code >= 3;
  const loss = weather.wind >= 15 ? [6, 3, 2] : [2, 1, 1];
  weather.moistureBalance = (weather.moistureBalance + (code >= 3 ? 8 : -loss[code])) << 16 >> 16;
  if (code >= 3) weather.precipitationDays = (weather.precipitationDays + 1) & 65535;
}

/** Wind update at 0x1e1ae; returns event transitions for the future disaster dispatcher. */
export function updateWeeklyWind(weather: WeatherState, tables: ClimateTables, calendar: FarmCalendar): { storm: boolean; tornado: boolean } {
  weather.wind = signedByte(tables.wind[weather.windYear * 48 + calendar.month * 4 + calendar.week] + weather.windAnomaly);
  if (weather.windAnomaly > 0) weather.windAnomaly--;
  return { storm: weather.wind >= 35, tornado: weather.wind > 70 };
}

/** Fresh-process defaults plus startup 0x24ef..0x2532. SSM files do not save these runtime globals. */
export function initializeWeather(tables: ClimateTables, calendar: FarmCalendar, precipitationDays: number, random: FarmRandom, cells: WorldCell[]): WeatherState {
  const weather: WeatherState = {
    current: 0, forecast: [3, 3, 3, 0, 0, 0, 0], nextForecast: [0, 0, 0, 0, 0, 0, 0], wind: 5,
    soilMoisture: 8, moistureBalance: 0, precipitationActive: false, precipitationDays, precipitationBonus: 0,
    precipitationYear: 0, temperatureYear: 0, windYear: 0, windAnomaly: 0, temperatureAnomaly: 0,
    temperature: tables.temperature[0], displayTemperature: 0,
  };
  advanceForecast(weather, tables, calendar, random, cells);
  weather.displayTemperature = signedByte(weather.temperature + random.below(5));
  return weather;
}
