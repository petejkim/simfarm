import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readClimateTables, WEATHER_TABLE_OFFSET } from '../src/formats/weather';
import { FarmRandom } from '../src/simulation/random';
import { advanceForecast, applyDailyWeather, initializeWeather, PRECIPITATION_PATTERNS, updateWeeklyWind } from '../src/simulation/weather';
import { updateFieldWater } from '../src/simulation/field-water';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const rng = () => new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });

test('climate triples decode all five years in eight scenarios, including signed temperatures', () => {
  for (let farm = 0; farm < 8; farm++) {
    const bytes = source(`SCEN${farm}.SSM`), tables = readClimateTables(bytes);
    for (let week = 0; week < 240; week++) {
      assert.deepEqual([tables.wind[week], tables.precipitation[week], tables.temperature[week]],
        [0, 1, 2].map(c => bytes.readInt8(WEATHER_TABLE_OFFSET + week * 3 + c)));
    }
  }
  const bytes = source('SCEN0.SSM'); bytes[WEATHER_TABLE_OFFSET + 2] = 251;
  assert.equal(readClimateTables(bytes).temperature[0], -5);
  bytes[WEATHER_TABLE_OFFSET + 1] = 8;
  assert.throws(() => readClimateTables(bytes), /precipitation/);
});

test('forecasts preserve all original rain/snow patterns and consume RNG only on dry days', () => {
  const s = readScenario(source('SCEN0.SSM')), random = rng();
  const w = initializeWeather(s.climate, s.farm.calendar, 0, random, s.cells);
  for (const temperature of [32, 33, 70, 71, 85, 86]) for (let rainDays = 0; rainDays < 8; rainDays++) {
    s.climate.precipitation.fill(rainDays); s.climate.temperature.fill(temperature);
    const before = [...w.nextForecast], expectedRng = new FarmRandom(random.snapshot());
    advanceForecast(w, s.climate, s.farm.calendar, random, s.cells);
    assert.deepEqual(w.forecast, before);
    const expected = PRECIPITATION_PATTERNS[rainDays].map(rain => {
      if (rain) return temperature <= 32 ? 4 : 3;
      const n = expectedRng.nextVisual() & 7;
      const choices = temperature > 85 ? [0, 0, 1, 0, 0, 2, 0, 0]
        : temperature > 70 ? [0, 1, 2, 0, 2, 0, 0, 1] : [0, 2, 1, 2, 0, 1, 1, 1];
      return choices[n];
    });
    assert.deepEqual(w.nextForecast, expected); assert.deepEqual(random.snapshot(), expectedRng.snapshot());
  }
  s.climate.precipitation.fill(0); s.climate.precipitation[0] = 7;
  w.precipitationYear = 4;
  advanceForecast(w, s.climate, { day: 0, week: 3, month: 11, year: 1997, season: 0 }, random, s.cells);
  assert.deepEqual(w.nextForecast, [3, 3, 3, 3, 3, 3, 3]); // Forecast table wraps index 240 to zero.
});

test('wind controls daily drying; rain accumulates, changes grass and saturates weekly moisture', () => {
  const s = readScenario(source('SCEN0.SSM')), random = rng();
  const w = initializeWeather(s.climate, s.farm.calendar, 65535, random, s.cells);
  w.forecast = [0, 1, 2, 3, 4, 0, 0]; w.wind = 15;
  for (let day = 0; day < 5; day++) applyDailyWeather(w, day);
  assert.equal(w.moistureBalance, 5); assert.equal(w.precipitationDays, 1); assert.equal(w.precipitationActive, true);
  w.wind = 14; applyDailyWeather(w, 5);
  assert.equal(w.moistureBalance, 3); assert.equal(w.precipitationActive, false);
  const cell = s.cells[0]; cell.terrain = 0xf800 | 23; cell.attribute = 12;
  const untouched = s.cells[1]; untouched.terrain = 696;
  w.moistureBalance = 32; w.soilMoisture = 11;
  advanceForecast(w, s.climate, s.farm.calendar, random, s.cells);
  assert.equal(w.soilMoisture, 12); assert.equal(w.moistureBalance, 0);
  assert.equal(cell.terrain, 0xf800 | 30); assert.equal(untouched.terrain, 696);
  w.moistureBalance = -17;
  advanceForecast(w, s.climate, s.farm.calendar, random, s.cells);
  assert.equal(w.soilMoisture, 9); // Signed arithmetic shift: -17 >> 3 = -3.
  w.moistureBalance = -80;
  advanceForecast(w, s.climate, s.farm.calendar, random, s.cells);
  assert.equal(w.soilMoisture, 0);
  w.windAnomaly = 60; s.climate.wind.fill(12);
  assert.deepEqual(updateWeeklyWind(w, s.climate, s.farm.calendar), { storm: true, hurricane: true });
  assert.equal(w.wind, 72); assert.equal(w.windAnomaly, 59);
});

test('field water refresh counts original asymmetric borders and flood adjustment', () => {
  const s = readScenario(source('SCEN0.SSM')), f = s.fields[1];
  for (let x = f.x - 1; x <= f.x + f.width + 1; x++) for (let y = f.y - 1; y <= f.y + f.height + 1; y++) {
    s.cells[worldIndex(x, y)].terrain = 696;
  }
  s.cells[worldIndex(f.x + f.width, f.y - 1)].terrain = 0xf800 | 98; // Included extra corner.
  s.cells[worldIndex(f.x - 1, f.y + f.height)].terrain = 98; // Excluded corner.
  s.cells[worldIndex(f.x - 1, f.y)].terrain = 87;
  s.cells[worldIndex(f.x + 1, f.y + f.height)].terrain = 97;
  updateFieldWater(f, s.cells, 8, 4);
  assert.equal(new DataView(f.bytes.buffer).getUint16(24, true), 21);
  assert.equal(f.bytes[51], 1); assert.equal(f.bytes[52], 2);
});
