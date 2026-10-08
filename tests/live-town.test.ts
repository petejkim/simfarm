import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { TownLayouts } from '../src/formats/town';
import { GameSimulation as NativeGame } from '../src/simulation/game';
import { GameSimulation, originalTownLayouts } from './support/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const site = { regionX: 3, regionY: 0 }, index = (site.regionX * 12 + site.regionY) * 7;
function fixture(day = 6, revenue = 100, district = 6) {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0);
  Object.assign(scenario.farm.calendar, { day, week: 0, month: 1 });
  scenario.regionalConditions[index] = district;
  const save = JSON.parse(new GameSimulation(scenario, crops).save(4));
  Object.assign(save.runtime.finances.town, { activeSite: site, townRevenue: revenue, developmentSpent: 65530 });
  const game = GameSimulation.load(JSON.stringify(save), crops).simulation;
  return { game, crops, save };
}

test('live town grows only at weekly boundaries, wraps spending, caps levels and checkpoints exact terrain/RNG continuation', () => {
  const { game, crops } = fixture(5), before = game.getSnapshot();
  game.dispatch({ type: 'advance-day' });
  assert.deepEqual(game.getSnapshot().finances.town, before.finances.town);
  assert.equal(game.getSnapshot().scenario.regionalConditions[index], 6);
  game.dispatch({ type: 'advance-day' });
  const after = game.getSnapshot();
  assert.equal(after.scenario.regionalConditions[index], 0x16);
  assert.equal(after.finances.town.townRevenue, 75); assert.equal(after.finances.town.developmentSpent, 19);
  assert.notDeepEqual(after.scenario.cells.slice(worldIndex(24, 0), worldIndex(32, 0)), before.scenario.cells.slice(worldIndex(24, 0), worldIndex(32, 0)));
  const restored = GameSimulation.load(game.save(4), crops).simulation;
  for (let day = 0; day < 21; day++) {
    game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' });
  }
  assert.equal(game.getSnapshot().scenario.regionalConditions[index], 0x46);
  assert.equal(game.getSnapshot().finances.town.townRevenue, 0);
  assert.equal(restored.save(4), game.save(4));
  const capped = fixture(6, 100, 0xd6).game;
  capped.dispatch({ type: 'advance-day' });
  assert.equal(capped.getSnapshot().scenario.regionalConditions[index], 0xd6);
  assert.equal(capped.getSnapshot().finances.town.townRevenue, 100);
});

test('live town declines on signed negative receipts and scheduled loan receipts fund the next week, not the current week', () => {
  const declining = fixture(6, 0xfffffff6, 0x26).game;
  declining.dispatch({ type: 'advance-day' });
  assert.equal(declining.getSnapshot().scenario.regionalConditions[index], 0x16);
  assert.equal(declining.getSnapshot().finances.town.townRevenue, 0);
  assert.equal(declining.getSnapshot().finances.town.developmentSpent, 65530);
  const { save, crops } = fixture(6, 0);
  save.scenario.farm.calendar.week = 3;
  Object.assign(save.runtime.finances.loan, { principal: 1000, scheduledPayment: 100 });
  const game = GameSimulation.load(JSON.stringify(save), crops).simulation;
  game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.farm.calendar.month, 2);
  assert.equal(game.getSnapshot().finances.loan.principal, 900);
  assert.equal(game.getSnapshot().finances.town.townRevenue, 25);
  assert.equal(game.getSnapshot().scenario.regionalConditions[index], 6);
  for (let day = 0; day < 7; day++) game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().finances.town.townRevenue, 0);
  assert.equal(game.getSnapshot().scenario.regionalConditions[index], 0x16);
});

test('current town checkpoints require matching layout bytes and valid active district; legacy versions adopt the provided original layouts once', () => {
  const { game, crops, save } = fixture(), text = game.save(4);
  assert.equal(save.version, 19);
  assert.deepEqual(save.runtime.townLayoutBytes, [...originalTownLayouts.bytes]);
  const changed = new TownLayouts(originalTownLayouts.bytes); changed.bytes[0] ^= 1;
  assert.throws(() => NativeGame.load(text, crops, changed), /different town layouts/);
  for (const bytes of [null, [], [...originalTownLayouts.bytes, 0], Array(1920).fill(256), Array(1920).fill(0.5)]) {
    const bad = structuredClone(save); bad.runtime.townLayoutBytes = bytes;
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /town layout bytes/);
  }
  const bad = structuredClone(save), regions = Buffer.from(bad.scenario.regions, 'hex');
  regions[index] = 15; bad.scenario.regions = regions.toString('hex');
  assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /active town district type/);
  for (const version of [1, 2, 3, 4]) {
    const old = structuredClone(save); old.version = version; delete old.runtime.townLayoutBytes;
    const loaded = GameSimulation.load(JSON.stringify(old), crops).simulation;
    assert.deepEqual(JSON.parse(loaded.save(4)).runtime.townLayoutBytes, [...originalTownLayouts.bytes]);
  }
  const own = new TownLayouts(originalTownLayouts.bytes), native = new NativeGame(game.getSnapshot().scenario, crops, own);
  const independent = native.save(4); own.bytes.fill(0);
  assert.equal(native.save(4), independent);
});
