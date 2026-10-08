import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readClimatePreset, readClimatePresets, readSetupMap, climateForSetup } from '../src/formats/new-farm';
import { readScenario } from '../src/formats/scenario';
import { initializeWeather } from '../src/simulation/weather';
import { FarmRandom } from '../src/simulation/random';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(e => e.name === name)!.bytes;
const ascii = (s: string) => new TextEncoder().encode(s);

test('new-farm categories, argument order and 240 low-byte writes match executable and archive evidence', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x31ee5, '8a824afafec8c0e00588824afa'); exact(0x31f22, '6b36c266120336c066');
  exact(0x337a6, 'a0b667c0e0028e061ecb26a26401');
  exact(0x4a40f, '8a46de8e0676cf8b5ed82688878641'); exact(0x4a436, '8346d804817ed8f0007ca0');
  exact(0x4a441, '8a460a98501e6893ba'); exact(0x4a4ce, '8a460898501e68aaba');
  exact(0x4a529, '8a46de8e067acf8b5ed82688877842');
  assert.equal(e.subarray(0x9016c, 0x901b1).toString('ascii'), 'rain%d.dat\0%d,%d,%d,%d\0wind%d.dat\0%d,%d,%d,%d\0temp%d.dat\0%d,%d,%d,%d\0');
  assert.equal(archive.find(e => e.name === 'scenario.odt')!.offset, 0x1e3830);
  assert.equal(createHash('sha256').update(asset('scenario.odt')).digest('hex'), '96f92b484fd6f531446aa8c203a75823c78055411fcfe627b3993b3b8b0da3b9');
});

test('all 324 setup locations match the independent annotated rain/temp/wind/hotpoint grids', () => {
  const bytes = asset('scenario.odt'), map = readSetupMap(bytes), lines = new TextDecoder().decode(bytes).split('\r\n');
  assert.equal(map.locations.length, 324); assert.equal(map.locations.filter(l => l.selectable).length, 178);
  for (const location of map.locations) {
    const { x, y } = location;
    assert.equal(location.precipitation, lines[51 + y].charCodeAt(x) - 97);
    assert.equal(location.temperature, lines[31 + y].charCodeAt(x) - 97);
    assert.equal(location.wind, lines[71 + y].charCodeAt(x) - 97);
    assert.equal(location.selectable, lines[11 + y][x] === 'b');
  }
  assert.deepEqual(map.trailingBytes, Uint8Array.from(bytes.subarray(1304)));
  map.trailingBytes.fill(0); assert.notEqual(bytes[1304], 0);
  for (const length of [0, 325, 326, 1303]) assert.throws(() => readSetupMap(bytes.subarray(0, length)), /range/);
  for (const [offset, value] of [[0, 96], [326, 101], [652, 255], [978, 99], [324, 10], [1303, 13]]) {
    const bad = Uint8Array.from(bytes); bad[offset] = value;
    assert.throws(() => readSetupMap(bad), /setup map/);
  }
});

test('all twelve climate files retain every week, five-year ordering and the original wind41 outlier', () => {
  const presets = readClimatePresets(asset);
  for (const [channel, prefix] of [['precipitation', 'rain'], ['temperature', 'temp'], ['wind', 'wind']] as const) {
    for (let level = 0; level < 4; level++) {
      const rows = new TextDecoder().decode(asset(`${prefix}${level}.dat`)).trim().split('\r\n');
      assert.equal(rows.length, 60);
      for (let year = 0; year < 5; year++) for (let month = 0; month < 12; month++) {
        assert.deepEqual(presets[channel][level].slice(year * 48 + month * 4, year * 48 + month * 4 + 4),
          rows[year * 12 + month].split(',').map(Number));
      }
    }
  }
  assert.equal(presets.wind[3][29], 41);
});

test('climate scanning preserves signed low-byte arithmetic and rejects incomplete or unsafe inputs', () => {
  const rows = Array(60).fill('-32768,32767,-129,256').join('\r\n');
  assert.deepEqual(readClimatePreset(ascii(rows)), Array.from({ length: 60 }, () => [0, -1, 127, 0]).flat());
  for (const text of [rows.replace('-32768', '-32769'), rows.replace('32767', '32768'), rows.slice(0, -4),
    rows + '\r\n1,2,3,4', rows.replace(',', ';'), rows.replace(',', '\0'), rows.replace('256', 'NaN'), rows + 'é']) {
    assert.throws(() => readClimatePreset(ascii(text)), /climate preset/);
  }
  const rain = (value: number) => (name: string) => name.startsWith('rain') ? ascii(Array(60).fill(`${value},0,0,0`).join('\n')) : asset(name);
  assert.throws(() => readClimatePresets(rain(8)), /precipitation/);
  assert.throws(() => readClimatePresets(rain(264)), /precipitation/); // Truncate before validation.
  assert.equal(readClimatePresets(rain(255)).precipitation[0][0], -1);
});

test('all 64 category combinations select independent tables without altering presets', () => {
  const presets = readClimatePresets(asset), before = structuredClone(presets);
  for (let precipitation = 0; precipitation < 4; precipitation++) for (let temperature = 0; temperature < 4; temperature++) for (let wind = 0; wind < 4; wind++) {
    const climate = climateForSetup(presets, { precipitation, temperature, wind });
    assert.deepEqual(climate, { precipitation: presets.precipitation[precipitation], temperature: presets.temperature[temperature], wind: presets.wind[wind] });
    climate.wind.fill(99); climate.temperature.fill(99); climate.precipitation.fill(99);
  }
  assert.deepEqual(presets, before);
  for (const channel of ['precipitation', 'temperature', 'wind']) for (const invalid of [-1, 4, 0.5, NaN, Infinity]) {
    assert.throws(() => climateForSetup(presets, { precipitation: 0, temperature: 0, wind: 0, [channel]: invalid }), /level/);
  }
});

test('six original farms independently confirm preset selection and identical initial forecasts', () => {
  const presets = readClimatePresets(asset);
  const selections = [[2, 2, 3], [2, 2, 3], [3, 2, 3], [0, 1, 0], [2, 1, 1], [2, 0, 1]];
  for (let farm = 0; farm < selections.length; farm++) {
    const [precipitation, temperature, wind] = selections[farm], scenario = readScenario(source(`SCEN${farm}.SSM`));
    const climate = climateForSetup(presets, { precipitation, temperature, wind });
    assert.deepEqual(climate, scenario.climate);
    const a = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 }), b = new FarmRandom(a.snapshot());
    const cells = structuredClone(scenario.cells);
    assert.deepEqual(initializeWeather(climate, scenario.farm.calendar, 0, a, cells),
      initializeWeather(scenario.climate, scenario.farm.calendar, 0, b, scenario.cells));
    assert.deepEqual(a.snapshot(), b.snapshot()); assert.deepEqual(cells, scenario.cells);
  }
  // These saves have different rainfall; selecting a location must not overwrite a loaded farm.
  for (const farm of [6, 7]) {
    const climate = readScenario(source(`SCEN${farm}.SSM`)).climate;
    assert.ok(presets.precipitation.every(table => JSON.stringify(table) !== JSON.stringify(climate.precipitation)));
  }
});
