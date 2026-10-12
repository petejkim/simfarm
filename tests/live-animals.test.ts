import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldIndex, readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';
import { livestockFixture } from './support/livestock';

test('animal care and fence notices call original quick history, not modal messages',()=>{
  const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  for(const [offset,code] of [[0x12b11,57],[0x12b70,58],[0x12bce,59],[0x12779,67]])
    assert.equal(exe.subarray(offset,offset+7).toString('hex'),`6a${code.toString(16)}9ab42b751d`);
  assert.equal(exe.subarray(0x12c2f,0x12c34).toString('hex'),'6a38e93eff'); //56 rejoins58's call.
  for(const [water,feed,expected] of [[20,0,[57]],[255,0,[58]],[0,90,[59]],[0,255,[56,59]]] as const){
    const f=livestockFixture();f.state.scenario.inventory[1].bytes[10]&=~32;
    f.state.scenario.cells[worldIndex(12,10)].terrain=15;
    const animal=f.state.scenario.animals[1];animal.bytes[14]=water;animal.bytes[13]=feed;
    const game=f.load();game.dispatch({type:'set-paused',paused:false});game.tick(64);
    assert.deepEqual(game.getSnapshot().editStatuses,expected);
    assert.deepEqual(GameSimulation.load(game.save(4),f.crops).simulation.getSnapshot().editStatuses,[]);
  }
});

test('live clock moves animals after irrigation, consumes original supplies, pauses and resumes exact native state', () => {
  const f = livestockFixture(), game = f.load();
  game.tick(64); assert.equal(game.getSnapshot().scenario.animals[1].x, 10);
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(60); assert.equal(game.getSnapshot().scenario.animals[1].x, 10);
  game.tick(4); const snapshot = game.getSnapshot(); assert.equal(snapshot.scenario.animals[1].x, 11);
  assert.equal(snapshot.scenario.animals[1].y, 10); assert.equal(snapshot.scenario.animals[1].bytes[14], 0);
  assert.equal(snapshot.scenario.inventory[1].quantity, 508); assert.equal(snapshot.animalFrame.lastMoveTick, 16);
  assert.equal(snapshot.scenario.cells[worldIndex(10, 10)].terrain, 15);
  assert.equal(snapshot.scenario.cells[worldIndex(11, 10)].overlay & 0x7ff, 966);
  const saved = game.save(4), restored = GameSimulation.load(saved, f.crops).simulation;
  snapshot.animalFrame.herd.fill(255); snapshot.scenario.animals[1].bytes[14] = 255;
  assert.equal(game.save(4), saved); // React snapshots cannot change canonical records or cache.
  for (const duration of [305, 17, 678, 1049]) { game.tick(4 * duration); restored.tick(4 * duration); }
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  game.dispatch({ type: 'set-paused', paused: true }); const paused = game.save(4); game.tick(40000); assert.equal(game.save(4), paused);
});

test('odd-day needs use the prior signed display temperature before daily weather and animal frame work', () => {
  const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  assert.equal(exe.subarray(0xd0cc, 0xd0d0).toString('hex'), '26a2dc43');
  for (const day of [0, 1, 6]) {
    const f = livestockFixture(); f.state.dayTicks = 999; f.state.scenario.farm.calendar.day = day;
    f.state.scenario.farm.animationTicks = f.state.animalFrame.lastMoveTick = 100;
    f.state.weather.displayTemperature = 31; f.state.weather.temperature = 50;
    const a = f.state.scenario.animals[1]; a.bytes[14] = a.bytes[13] = 0; a.bytes[8] = 100;
    const game = f.load(); game.dispatch({ type: 'advance-day' }); const after = game.getSnapshot().scenario.animals[1];
    assert.equal(after.bytes[13], day === 1 ? 0 : 8); assert.equal(after.bytes[14], day === 1 ? 0 : 2);
    assert.equal(after.conditionByte, day === 1 ? 100 : 95); assert.equal(game.getSnapshot().daysAdvanced, 1);
  }
});

test('v10 strictly persists overlapping herd bytes and both ticks; versions1–9 migrate once to cold frame state', () => {
  const f = livestockFixture(), game = f.load(), saved = JSON.parse(game.save(4)); assert.equal(saved.version, 28);
  for (let version = 1; version <= 9; version++) {
    const old = structuredClone(saved); old.version = version; delete old.runtime.animalFrame;
    const loaded = GameSimulation.load(JSON.stringify(old), f.crops).simulation;
    assert.deepEqual(loaded.getSnapshot().animalFrame, { lastMoveTick: 0, lastCentreTick: 0, herd: new Uint8Array(21) });
    assert.deepEqual(JSON.parse(GameSimulation.load(loaded.save(4), f.crops).simulation.save(4)), JSON.parse(loaded.save(4)));
  }
  for (const mutate of [(r: any) => { delete r.animalFrame; }, (r: any) => { r.animalFrame.herd = '00'; },
    (r: any) => { r.animalFrame.lastCentreTick = 65536; }, (r: any) => { r.animalFrame.lastMoveTick = -1; },
    (r: any) => { delete r.animalFrame.lastMoveTick; }]) {
    const bad = structuredClone(saved); mutate(bad.runtime);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), f.crops), /animal/); assert.equal(game.save(4), JSON.stringify(saved));
  }
  const arbitrary = structuredClone(saved); arbitrary.runtime.animalFrame = { lastMoveTick: 65530, lastCentreTick: 65530, herd: 'ff'.repeat(21) };
  const loaded = GameSimulation.load(JSON.stringify(arbitrary), f.crops).simulation;
  assert.deepEqual(JSON.parse(loaded.save(4)).runtime.animalFrame, arbitrary.runtime.animalFrame);
});

test('all original farms preserve live animal motion and generators across saved continuation; death feedback stays transient', () => {
  const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
  for (let id = 0; id < 8; id++) {
    const world = readScenario(source(`SCEN${id}.SSM`)); world.farm.dayDelayTicks = 999;
    const crops = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
    const game = new GameSimulation(world, crops); game.dispatch({ type: 'set-paused', paused: false }); game.tick(1332);
    const copy = GameSimulation.load(game.save(id), crops).simulation;
    for (const duration of [17, 321, 100]) { game.tick(4 * duration); copy.tick(4 * duration); }
    assert.deepEqual(JSON.parse(game.save(id)), JSON.parse(copy.save(id)));
  }
  const f = livestockFixture(); f.state.scenario.inventory[1].bytes[10] &= ~32;
  f.state.scenario.cells[worldIndex(12, 10)].terrain = 15; f.state.scenario.animals[1].bytes[14] = 255;
  const game = f.load(); game.dispatch({ type: 'set-paused', paused: false }); game.tick(64);
  assert.equal(game.getSnapshot().scenario.animals[1].active, false);
  assert.deepEqual(game.getSnapshot().animalNotices, [{ slot: 1, id: 58, animalType: 161 }]);
  assert.deepEqual(GameSimulation.load(game.save(4), f.crops).simulation.getSnapshot().animalNotices, []);
});
