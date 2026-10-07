import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { GameSimulation } from './support/game';
import { removeField } from '../src/simulation/field-removal';
import { queueClearingEffect } from '../src/simulation/clearing-effects';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function fixture(field = false) {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0);
  const { state } = readNativeSave(new GameSimulation(scenario, crops).save(4));
  state.scenario.farm.animationTicks = state.equipmentAnimationTick = state.finances.clearing.lastTick = 65530;
  state.scenario.farm.dayDelayTicks = 256;
  const x = field ? state.scenario.fields[1].x : 95, y = field ? state.scenario.fields[1].y : 95;
  if (field) assert.equal(removeField(state.scenario, 1, state.finances.clearing, state.weather.soilMoisture), true);
  else queueClearingEffect(state.scenario, state.finances.clearing, x, y, state.weather.soilMoisture);
  const game = GameSimulation.load(writeNativeSave(state, 4), crops).simulation;
  const tile = () => terrainTile(game.getSnapshot().scenario.cells[worldIndex(x, y)]);
  return { state, game, crops, tile, x, y };
}
const ticks = (game: GameSimulation, count: number) => game.tick(count * 1000 / 256);

test('live clearing uses the original animation word and wrapped sixteen-tick threshold; paused farms preserve pending work', () => {
  const exe = source('SIMFARM.EXE');
  assert.equal(exe.subarray(0x625d, 0x6265).toString('hex'), 'ff069e13ff06a013');
  assert.equal(exe.readUInt16LE(0x846f0 + 0xc62c), 0x6190);
  assert.equal(exe.subarray(0xa42e, 0xa439).toString('hex'), '26a1a0132b06a81e3d1000');
  const { game, tile, x, y } = fixture(), before = game.save(4), cell = game.getSnapshot().scenario.cells[worldIndex(x, y)];
  ticks(game, 1000); assert.equal(game.save(4), before);
  game.dispatch({ type: 'set-paused', paused: false }); ticks(game, 15);
  assert.equal(tile(), 664); assert.equal(game.getSnapshot().finances.clearing.lastTick, 65530);
  ticks(game, 1); assert.equal(tile(), 666); assert.equal(game.getSnapshot().finances.clearing.lastTick, 10);
  for (const expected of [668, 670, 672]) { ticks(game, 16); assert.equal(tile(), expected); }
  ticks(game, 16);
  const after = game.getSnapshot(), restored = after.scenario.cells[worldIndex(x, y)];
  const expected = cell.terrain & 0x3000 ? 55 : 15 + after.weather.soilMoisture + (cell.attribute >>> 2);
  assert.equal(restored.terrain, ((cell.terrain & 0xf800) | expected) & 65535);
  assert.equal(restored.overlay, cell.overlay); assert.equal(restored.attribute, cell.attribute);
  assert.equal(after.finances.clearing.count, 0); assert.equal(after.finances.clearing.x[1], 255);
  assert.equal(after.daysAdvanced, 0); assert.equal(after.scenario.farm.animationTicks, 74);
});

test('a removed original field retires with the source changing-count budget and exact mid-animation save continuation', () => {
  const { game, crops, state } = fixture(true);
  assert.equal(game.getSnapshot().finances.clearing.count, 64); assert.equal(game.getSnapshot().scenario.fields[1].active, false);
  game.dispatch({ type: 'set-paused', paused: false }); ticks(game, 47);
  const copy = GameSimulation.load(game.save(4), crops).simulation;
  assert.deepEqual(JSON.parse(copy.save(4)), JSON.parse(game.save(4)));
  ticks(game, 33); for (let t = 0; t < 33; t++) ticks(copy, 1);
  assert.equal(game.getSnapshot().finances.clearing.count, 31);
  assert.deepEqual(JSON.parse(copy.save(4)), JSON.parse(game.save(4)));
  for (const expected of [15, 7, 3, 1, 0]) { ticks(game, 16); ticks(copy, 16); assert.equal(game.getSnapshot().finances.clearing.count, expected); }
  assert.deepEqual(JSON.parse(copy.save(4)), JSON.parse(game.save(4)));
  assert.deepEqual(game.getSnapshot().scenario.fields[1].bytes, state.scenario.fields[1].bytes);
  assert.ok(game.getSnapshot().finances.clearing.x.every(n => n === 255));
});

test('clearing retirement runs before the same tick changes weekly soil moisture', () => {
  const { state, crops, x, y } = fixture();
  Object.assign(state.scenario.farm.calendar, { day: 6, week: 0, month: 0 });
  state.dayTicks = 255; state.scenario.farm.animationTicks = 9; state.equipmentAnimationTick = 9;
  Object.assign(state.weather, { soilMoisture: 0, moistureBalance: 16, precipitationBonus: 0 });
  const cell = state.scenario.cells[worldIndex(x, y)]; cell.terrain = 672; cell.attribute = 80;
  const game = GameSimulation.load(writeNativeSave(state, 4), crops).simulation;
  game.dispatch({ type: 'advance-day' });
  // 15 + old moisture 0 + attribute/4 = 35, outside the subsequent 15..30 grass repaint.
  assert.equal(game.getSnapshot().scenario.cells[worldIndex(x, y)].terrain, 35);
  assert.equal(game.getSnapshot().weather.soilMoisture, 2);
  assert.equal(game.getSnapshot().finances.clearing.count, 0); assert.equal(game.getSnapshot().daysAdvanced, 1);
});

test('saved terminal and town modal decisions freeze clearing as well as the rest of the farm', () => {
  const { state, crops } = fixture();
  state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
  const stopped = GameSimulation.load(writeNativeSave(state, 4), crops).simulation, text = stopped.save(4);
  stopped.tick(10000); stopped.dispatch({ type: 'advance-day' }); assert.equal(stopped.save(4), text);
  state.finances.defaultDecision = null;
  Object.assign(state.scenario.farm.calendar, { day: 0, week: 0, month: 0 });
  state.scenario.farm.salesAccumulator = 0;
  state.pendingTown = { phase: 'annual-reset', resumeRunning: false, site: { ...state.finances.town.activeSite } };
  const pending = GameSimulation.load(writeNativeSave(state, 4), crops).simulation, paused = pending.save(4);
  pending.tick(10000); pending.dispatch({ type: 'advance-day' }); assert.equal(pending.save(4), paused);
});
