import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readScenario } from '../src/formats/scenario';
import { readTrafficDefaults } from '../src/formats/traffic';
import { resetSetupActivity, synchronizeSetupIrrigation, type SetupActivity } from '../src/simulation/restart-activity';
import { createMovingDisasters } from '../src/simulation/moving-disasters';
import { initializeWeather, initializeStartupWeather } from '../src/simulation/weather';
import { FarmRandom } from '../src/simulation/random';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const exe = source('SIMFARM.EXE');
const seeds = { visual: 27, simulation: 9029, bounded: 51 };
const fixture = (id = 0): SetupActivity => {
  const world = readScenario(source(`SCEN${id}.SSM`));
  return { cells: world.cells, irrigation: world.irrigation, traffic: readTrafficDefaults(exe), disasters: createMovingDisasters(),
    weather: initializeWeather(world.climate, world.farm.calendar, 0, new FarmRandom(seeds), world.cells) };
};

test('restart activity and retained forecast phases pin source masks, addresses, clears and ordering', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x40304, '26c606956901'); exact(0x403a4, '2680a72504c7'); exact(0x403ae, '2680a7254c87');
  exact(0x405a3, '26888756f926888755f926888754f9'); exact(0x405b5, '837efe407cd9');
  exact(0x40641, '26a20c248e06d2cd26a200248e06d4cd26a225248e06d6cd26a20f248e06d8cd26a20e24');
  exact(0x405fc, '9a0e16ab090ee807000ee84bf2');
  exact(0x408ee, '26a292408e065ace26a277428e065cce26a28541');
  exact(0x3fa90, '8e065ecd26a1a0138e0660cd26a3d2f7');
  exact(0x1e81b, '8a877f4088877840'); exact(0x1e82c, 'a0854198');
  exact(0x24ef, '9abc0a981b8e06f6c526a078429899');
  for (const address of [0xcd82, 0xcda0, 0xcdca, 0xcd60]) assert.equal(exe.readUInt16LE(0x846f0 + address), 0x2d9f);
  for (const address of [0xcdd2, 0xcd90, 0xce58, 0xce5a, 0xce5c]) assert.equal(exe.readUInt16LE(0x846f0 + address), 0x6190);
});

test('activity reset masks maps, clears the full irrigation wave and retains traffic bytes/clocks and effect state for all farms', () => {
  for (let id = 0; id < 8; id++) {
    const prior = fixture(id);
    for (let high = 0; high < 256; high++) prior.cells[high] = { terrain: high * 256 + 173, overlay: high * 256 + 93, attribute: high };
    prior.irrigation.sources.fill(95); prior.irrigation.sourceCount = 64;
    Object.assign(prior.irrigation, { flow: [{ x: 95, y: 0, strength: 255 }], active: true, phase: 1, delay: 123, lastTick: 65535 });
    prior.traffic.records.forEach((r, i) => r.splice(0, 8, 0, i + 200, 255, 255, 254, 255, 253, 252));
    for (const slot of [0, 15]) prior.traffic.records[slot] = [3, 213, 95, 0, 94, 0, 7, 3];
    prior.traffic.activeCount = 2; prior.traffic.lastTick = 65534; prior.traffic.delay = 65535;
    prior.disasters.enabled = false; prior.disasters.flags = 0x8001; prior.disasters.tornado.lastTick = 65533;
    Object.assign(prior.weather, { windYear: 4, temperatureYear: 3, precipitationYear: 2, moistureBalance: -17, wind: 37, temperatureAnomaly: -3 });
    const before = structuredClone(prior), next = resetSetupActivity(prior);
    prior.cells.forEach((cell, i) => assert.deepEqual(next.cells[i], { ...cell, terrain: cell.terrain & 0xc7ff, overlay: cell.overlay & 0x87ff }));
    assert.deepEqual(next.irrigation, { ...prior.irrigation, sources: new Uint8Array(192), sourceCount: 0, flow: [], active: false, phase: 0 });
    assert.deepEqual(next.traffic, { ...prior.traffic, activeCount: 0, records: prior.traffic.records.map(r => [0, ...r.slice(1)]) });
    assert.deepEqual(next.disasters, { ...prior.disasters, enabled: true });
    assert.deepEqual(next.weather, { ...prior.weather, windYear: 0, temperatureYear: 0, precipitationYear: 0 });
    assert.deepEqual(resetSetupActivity(next), next);
    next.weather.forecast[0] = 4; next.disasters.tornado.x = 95; next.traffic.records[0][1] = 0; next.cells[0].attribute = 0; next.irrigation.sources[191] = 0;
    assert.deepEqual(prior, before);
  }
});

test('later setup synchronizes irrigation timestamp to the chosen farm clock without changing delay or retained members', () => {
  const state = fixture().irrigation;
  Object.assign(state, { phase: 1, active: true, lastTick: 123, delay: 64, flow: [{ x: 1, y: 2, strength: 3 }] });
  for (const tick of [0, 1, 32768, 65535]) {
    const before = structuredClone(state); synchronizeSetupIrrigation(state, tick);
    assert.deepEqual(state, { ...before, lastTick: tick });
  }
  const before = structuredClone(state);
  for (const tick of [-1, 65536, 0.5, NaN]) assert.throws(() => synchronizeSetupIrrigation(state, tick), /tick/);
  assert.deepEqual(state, before);
});

test('startup advances retained weather once, applies old moisture on the new map and preserves unrelated globals', () => {
  const prior = fixture(), weather = prior.weather;
  Object.assign(weather, { forecast: [1, 1, 1, 1, 1, 1, 1], nextForecast: [4, 3, 2, 1, 0, 2, 3], current: 4,
    wind: 27, soilMoisture: 8, moistureBalance: 16, precipitationBonus: 4, precipitationActive: true,
    precipitationDays: 123, windAnomaly: 19, temperatureAnomaly: -7 });
  const saved = structuredClone(prior), reset = resetSetupActivity(prior), before = structuredClone(reset.weather);
  reset.cells[0] = { terrain: 0x8015, overlay: 42, attribute: 8 };
  const climate = { wind: Array(240).fill(5), precipitation: Array(240).fill(7), temperature: Array(240).fill(41) };
  climate.temperature[0] = 120;
  const random = new FarmRandom(seeds);
  initializeStartupWeather(reset.weather, climate, { year: 1993, day: 1, month: 3, week: 0, season: 1 }, random, reset.cells);
  assert.deepEqual(reset.weather, { ...before, forecast: before.nextForecast, nextForecast: Array(7).fill(3),
    soilMoisture: 12, moistureBalance: 0, temperature: 120, displayTemperature: 124 });
  assert.deepEqual(random.snapshot(), { ...seeds, bounded: 161 }); // Only the source bounded draw; seven rainy days need no visual draws.
  assert.deepEqual(reset.cells[0], { terrain: 0x801d, overlay: 42, attribute: 8 });
  assert.deepEqual(prior, saved);
});

test('invalid reset inputs reject without altering any old owner', () => {
  for (const change of [
    (s: SetupActivity) => s.cells.pop(), (s: SetupActivity) => s.cells[3].terrain = 65536,
    (s: SetupActivity) => s.irrigation.sourceCount = 65, (s: SetupActivity) => s.irrigation.flow.push({ x: 0, y: 0, strength: 1 }),
    (s: SetupActivity) => s.traffic.activeCount = 1, (s: SetupActivity) => s.disasters.flags = 33,
    (s: SetupActivity) => s.weather.precipitationYear = 5,
  ]) {
    const prior = fixture(); change(prior); const before = structuredClone(prior);
    assert.throws(() => resetSetupActivity(prior)); assert.deepEqual(prior, before);
  }
});
