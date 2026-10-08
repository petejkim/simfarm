import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { TownLayouts } from '../src/formats/town';
import { worldIndex } from '../src/formats/scenario';
import { readNewFarmRuntimeDefaults } from '../src/formats/new-farm-runtime';
import { readNewFarmRecordDefaults, createSetupRecords } from '../src/formats/new-farm-records';
import { readClimatePresets, climateForSetup } from '../src/formats/new-farm';
import { readCrop } from '../src/formats/crop';
import { createSetupRuntime } from '../src/simulation/new-farm-runtime';
import { createStartupCalendar, initializeStartingTown } from '../src/simulation/starting-environment';
import { initializeStartingProperty, selectStartingLocations } from '../src/simulation/starting-property';
import { generateFarmTerrain } from '../src/simulation/terrain-generation';
import { FarmRandom } from '../src/simulation/random';
import { TerrainRandom, initialTerrainHistory } from '../src/simulation/terrain-random';
import { loadStartingCrops, createSetupSchedule } from '../src/simulation/new-farm-records';
import { initializeStartingMarket } from '../src/simulation/starting-market';
import { initializeWeather, PRECIPITATION_PATTERNS } from '../src/simulation/weather';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const exe = source('SIMFARM.EXE'), defaults = readNewFarmRuntimeDefaults(exe), recordDefaults = readNewFarmRecordDefaults(exe);
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(e => e.name === name)!.bytes;
const layouts = new TownLayouts(asset('townly0.cmp')), presets = readClimatePresets(asset);
const catalog = recordDefaults.cropFiles.map(file => readCrop(file.slice(0, -4), source(`CROPS/${file.toUpperCase()}`)));
const random = () => new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
const blank = () => ({ cells: Array.from({ length: 9216 }, () => ({ terrain: 0x7017, overlay: 0x12, attribute: 8 })), regionalConditions: new Uint8Array(1008) });
const runtime = () => createSetupRuntime(defaults, createSetupRecords(recordDefaults));

test('initial district, active-site stores, first-launch date and forecast ordering match source bytes', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x3fab0, '9a7013e6246a026a008e0666cd26ff3630d58e0668cd26ff3692759a2c11e6248e0668cd26a192758e066acd26a3dbfe8e0666cd26a130d58e066ccd26a3dcfe8e06');
  exact(0x5dba, '558becb42acd211ec55e06894f0288770188178847041f33c05dcb');
  exact(0x235c, '8a46d42ae4a34e128b46d2a35412'); exact(0x2381, 'c70652120000c70656120300c70650120100');
  exact(0x24ef, '9abc0a981b8e06f6c526a0784298998e06f8c526a332d526');
  exact(0x2511, '9aa300fd0583c4028bce02c88e06fac526880edc');
  exact(0x337a6, 'a0b667c0e0028e061ecb26a26401');
  assert.equal(defaults.raw.s4d9fFedd, exe[0x806bd]);
  const changed = Buffer.from(exe); changed[0x806bd] = 173;
  assert.equal(readNewFarmRuntimeDefaults(changed).raw.s4d9fFedd, 173);
});

test('first-launch calendar takes only the injected year and weekday and remains distinct from restart defaults', () => {
  for (const year of [0, 1980, 1992, 2026, 2099, 65535]) for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const date = { year, dayOfWeek }, calendar = createStartupCalendar(date);
    assert.deepEqual(calendar, { year, day: dayOfWeek, month: 3, week: 0, season: 1 });
    calendar.year = 77; assert.equal(date.year, year);
  }
  assert.deepEqual(defaults.farm.calendar, { day: 1, season: 1, week: 1, year: 1992, month: 0 });
  for (const year of [-1, 65536, NaN, 1992.5]) assert.throws(() => createStartupCalendar({ year, dayOfWeek: 0 }), /calendar/);
  for (const dayOfWeek of [-1, 7, NaN, 0.5]) assert.throws(() => createStartupCalendar({ year: 1992, dayOfWeek }), /calendar/);
});

test('initial town paints exactly one bounded district and sets its origin/active site without charging the farm', () => {
  for (let regionX = 0; regionX < 12; regionX++) for (let regionY = 0; regionY < 12; regionY++) {
    const world = blank(), state = runtime(), site = { regionX, regionY };
    state.raw.s4d9fFedd = 173; state.finances.town.recreationCoordinates.fill(93);
    const oldFarm = { ...state.farm }, oldTown = structuredClone(state.finances.town);
    assert.deepEqual(initializeStartingTown(world, state, layouts, site), { ok: true, type: 0, site });
    assert.deepEqual(state.farm, { ...oldFarm, townRegionX: regionX, townRegionY: regionY });
    assert.deepEqual(state.finances.town, { ...oldTown, activeSite: site });
    assert.equal(state.raw.s4d9fFedd, 0);
    assert.equal(world.regionalConditions[(regionX * 12 + regionY) * 7], 0xa0);
    assert.equal(world.regionalConditions.filter((n, i) => i % 7 === 1 && n === 2).length, 1);
    assert.equal(world.cells.filter(c => c.overlay & 0x4000).length, 64);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const cell = world.cells[worldIndex(regionX * 8 + x, regionY * 8 + y)], pattern = layouts.tile(0, x, y);
      assert.equal(cell.attribute, 8); assert.equal(cell.overlay, 0x4012);
      if (pattern >= 161 && pattern <= 172) assert.ok((cell.terrain & 0x7ff) >= 161 && (cell.terrain & 0x7ff) <= 171);
      else assert.equal(cell.terrain, 23); // Constructor does not stamp the town buildings yet.
    }
  }
});

test('rejected starting towns preserve the map, accounts and raw trailing byte', () => {
  const world = blank(), state = runtime(); state.raw.s4d9fFedd = 199;
  const beforeWorld = structuredClone(world), beforeState = structuredClone(state);
  for (const coordinate of [-1, 12, NaN, 0.5]) assert.equal(initializeStartingTown(world, state, layouts, { regionX: coordinate, regionY: 0 }).ok, false);
  assert.deepEqual(world, beforeWorld); assert.deepEqual(structuredClone(state), beforeState);
  assert.throws(() => initializeStartingTown({ ...world, cells: [] }, state, layouts, { regionX: 0, regionY: 0 }), /map/);
  assert.deepEqual(structuredClone(state), beforeState);
});

test('all original climate combinations preserve setup moisture and the distinct startup forecast/temperature indices', () => {
  const world = blank(), original = structuredClone(world.cells), calendar = createStartupCalendar({ year: 1992, dayOfWeek: 5 });
  for (let precipitation = 0; precipitation < 4; precipitation++) for (let temperature = 0; temperature < 4; temperature++) {
    for (let wind = 0; wind < 4; wind++) for (const moisture of [0, 4, 8, 12]) {
      const tables = climateForSetup(presets, { precipitation, temperature, wind });
      const rng = random(), expected = random();
      const pattern = PRECIPITATION_PATTERNS[tables.precipitation[13]], forecastTemperature = tables.temperature[13];
      const expectedForecast = pattern.map(rain => {
        if (rain) return forecastTemperature > 32 ? 3 : 4;
        const choice = expected.nextVisual() & 7;
        return forecastTemperature > 85 ? [0, 0, 1, 0, 0, 2, 0, 0][choice]
          : forecastTemperature > 70 ? [0, 1, 2, 0, 2, 0, 0, 1][choice] : [0, 2, 1, 2, 0, 1, 1, 1][choice];
      });
      const display = (tables.temperature[0] + expected.below(5)) << 24 >> 24;
      const weather = initializeWeather(tables, calendar, 0, rng, world.cells, moisture);
      assert.equal(weather.soilMoisture, moisture); assert.equal(weather.temperature, tables.temperature[0]);
      assert.equal(weather.displayTemperature, display); assert.equal(weather.wind, 5);
      assert.deepEqual(weather.forecast, Array(7).fill(0)); assert.deepEqual(weather.nextForecast, expectedForecast);
      assert.deepEqual(rng.snapshot(), expected.snapshot());
    }
  }
  assert.deepEqual(world.cells, original);
  const rng = random(), before = rng.snapshot(), tables = climateForSetup(presets, { precipitation: 0, temperature: 0, wind: 0 });
  for (const moisture of [-129, 128, NaN, 0.5]) assert.throws(() => initializeWeather(tables, calendar, 0, rng, world.cells, moisture), /moisture/);
  assert.deepEqual(rng.snapshot(), before); assert.deepEqual(world.cells, original);
  assert.equal(initializeWeather(tables, calendar, 0, rng, world.cells).soilMoisture, 8);
});

test('generated worlds advance through property, town, date, crops/history, planner and weather without an SSM template', () => {
  for (const soilMoisture of [0, 4, 8, 12]) for (const river of [false, true]) for (const lake of [false, true]) {
    const rng = random(), options = { soilMoisture, river, lake };
    const regionData = new Uint8Array(1008); for (let i = 0; i < 144; i++) regionData[i * 7] = 255;
    const world = generateFarmTerrain(regionData, options, rng, new TerrainRandom(rng, initialTerrainHistory(9029)));
    const selected = selectStartingLocations(world, rng); assert.ok(selected.ok);
    const r = createSetupRecords(recordDefaults), state = createSetupRuntime(defaults, r), { player, town } = selected.locations;
    const property = initializeStartingProperty(world, player);
    state.farm.cash = property.cash; state.finances.homestead = property.homestead;
    state.finances.accounts.homeRegionX = player.regionX; state.finances.accounts.homeRegionY = player.regionY;
    const climate = climateForSetup(presets, { precipitation: soilMoisture / 4, temperature: 2, wind: 1 });
    assert.equal(initializeStartingTown(world, state, layouts, town).ok, true);
    state.farm.calendar = createStartupCalendar({ year: 1992, dayOfWeek: 3 });
    loadStartingCrops(r, recordDefaults.cropFiles, catalog);
    const history = initializeStartingMarket(r.cropDefinitions.slice(0, 16).map(c => c.price), r.marketMood, rng);
    const schedule = createSetupSchedule(r.plannerBuffer), weatherSeed = rng.snapshot();
    const weather = initializeWeather(climate, state.farm.calendar, state.farm.precipitationDays, rng, world.cells, soilMoisture);
    const resumed = new FarmRandom(weatherSeed);
    assert.deepEqual(initializeWeather(climate, state.farm.calendar, 0, resumed, world.cells, soilMoisture), weather);
    assert.deepEqual(resumed.snapshot(), rng.snapshot());
    assert.equal(state.farm.cash, 40000); assert.equal(state.finances.homestead.rank, 0);
    assert.equal(world.regionalConditions.filter((n, i) => i % 7 === 1 && n === 1).length, 9);
    assert.equal(world.regionalConditions.filter((n, i) => i % 7 === 1 && n === 2).length, 1);
    assert.ok(r.fields.every(f => !f.active)); assert.ok(r.equipment.every(e => !e.active));
    assert.ok(schedule.bytes.every(n => n === 0)); assert.equal(history.length, 16); assert.equal(weather.soilMoisture, soilMoisture);
  }
});
