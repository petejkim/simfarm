import {test,expect} from 'bun:test';
import {disasterFixture} from './support/disasters';
import {GameSimulation} from './support/game';
import {beginWindDisaster} from '../src/simulation/wind-disaster';

export function windCadenceFixture(){
  const f=disasterFixture();f.state.paused=true;f.state.scenario.farm.messages=false;
  f.state.scenario.fields[1].bytes[2]=0; // Active fallow field: no crop nutrient use.
  f.state.disasters.flags=8;f.state.disasters.enabled=false;f.state.disasters.windReferenceTick=0;
  f.state.weather.wind=40;f.state.scenario.farm.animationTicks=f.state.scenario.farm.timerTicks=0;f.state.dayTicks=0;
  return f;
}

test('wind waits a full native day, survives pause/checkpoint, and damages at most once per day',()=>{
  const f=windCadenceFixture(),game=f.load();game.dispatch({type:'set-paused',paused:false});
  game.tick(3900);expect(game.getSnapshot().scenario.fields[1].bytes[29]).toBe(200);
  game.tick(100);expect(game.getSnapshot().scenario.fields[1].bytes[29]).toBe(200); // Odd-day soil recovery+1, wind-1.
  const baselineFixture=windCadenceFixture();baselineFixture.state.disasters.flags=0;baselineFixture.state.paused=false;
  const baseline=baselineFixture.load();baseline.tick(4000);expect(baseline.getSnapshot().scenario.fields[1].bytes[29]).toBe(201);
  expect(game.getSnapshot().disasters.windReferenceTick).toBe(65);
  game.dispatch({type:'set-paused',paused:true});const checkpoint=game.save(4);game.tick(10000);expect(game.save(4)).toBe(checkpoint);
  const copy=GameSimulation.load(checkpoint,f.crops).simulation;
  for(const g of [game,copy]){g.dispatch({type:'advance-day'});expect(g.getSnapshot().scenario.fields[1].bytes[29]).toBe(199);expect(g.getSnapshot().disasters.windReferenceTick).toBe(130);}
  expect(game.save(4)).toBe(copy.save(4));
});

test('accepted wind start resets a stale clock, rejected start retains it',()=>{
  const f=windCadenceFixture(),d=f.state.disasters;d.enabled=true;d.flags=0;d.windReferenceTick=3;
  expect(beginWindDisaster(f.state.scenario,f.state.crops,f.state.market,f.state.weather,d,500)).toBe(true);expect(d.windReferenceTick).toBe(500);
  expect(beginWindDisaster(f.state.scenario,f.state.crops,f.state.market,f.state.weather,d,600)).toBe(false);expect(d.windReferenceTick).toBe(500);
});
