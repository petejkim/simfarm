import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shopFixture} from './support/livestock';
import {worldIndex} from '../src/formats/scenario';
import {checkManualLandSale} from '../src/simulation/manual-land-sale';
import {quoteLand} from '../src/simulation/land';
import {readNativeSave,writeNativeSave} from '../src/formats/native-save';
import {browserCrops} from './support/crop-catalog';
import {GameSimulation} from './support/game';

test('Map ordinary sale source gates protect home, every field cell and other ownership without mutation',()=>{
  const e=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  assert.equal(e.subarray(0x35622,0x35627).toString('hex'),'9a00005719');
  assert.equal(e.subarray(0x1b79f,0x1b7a5).toString('hex'),'26f687254c10');
  assert.equal(e.subarray(0x35640,0x35642).toString('hex'),'6a01');
  const {state}=shopFixture(),w=state.scenario,f=state.finances;
  w.regionalConditions.fill(0);w.regionalConditions[(1*12+1)*7+1]=1;
  f.accounts.homeRegionX=1;f.accounts.homeRegionY=1;
  const check=()=>checkManualLandSale(w,f,1,1,0),before=JSON.stringify(state);
  assert.deepEqual(check(),{ok:false,reason:'home-plot'});assert.equal(JSON.stringify(state),before);
  f.accounts.homeRegionX=0;f.accounts.homeRegionY=0;
  for(let x=8;x<16;x++)for(let y=8;y<16;y++){
    const cell=w.cells[worldIndex(x,y)];cell.overlay|=0x1000;
    const saved=JSON.stringify(state);assert.deepEqual(check(),{ok:false,reason:'field-on-plot'});assert.equal(JSON.stringify(state),saved);cell.overlay&=~0x1000;
  }
  assert.ok(check().ok);
  for(const owner of [0,2,3,255]){w.regionalConditions[92]=owner;assert.deepEqual(check(),{ok:false,reason:'not-owned'});}
  for(const [x,y] of [[-1,0],[12,0],[0,12],[1.5,0],[NaN,0]])assert.deepEqual(checkManualLandSale(w,f,x,y,0),{ok:false,reason:'outside-map'});
}, 15000); //64 complete before/after farm comparisons, matching other exhaustive source sweeps.

test('ordinary buy/sell commands credit taxable land income, retain home and survive exact checkpoint continuation',()=>{
  const {state}=shopFixture();state.scenario.regionalConditions.fill(0);
  state.finances.accounts.homeRegionX=0;state.finances.accounts.homeRegionY=0;
  const game=GameSimulation.load(writeNativeSave(state,4),browserCrops).simulation.withAllCrops(browserCrops);
  const before=game.getSnapshot(),cost=quoteLand(before.scenario,1,1,before.weather.soilMoisture)!.price;
  game.dispatch({type:'buy-land',regionX:1,regionY:1});assert.equal(game.getSnapshot().scenario.farm.cash,100000-cost);
  const bought=game.getSnapshot(),price=quoteLand(bought.scenario,1,1,bought.weather.soilMoisture)!.price;
  assert.equal(price,cost+100); // SF-158: the plot itself increases occupied-land pricing.
  const income=bought.finances.accounts.landIncome,sales=bought.scenario.farm.salesAccumulator,expenses=bought.scenario.farm.landExpenses;
  game.dispatch({type:'sell-land',regionX:1,regionY:1});const after=game.getSnapshot();assert.ok(after.lastLandSaleResult?.ok);
  assert.equal(after.scenario.farm.cash,100000-cost+price);assert.equal(after.scenario.farm.landExpenses,expenses);
  assert.equal(after.finances.accounts.landIncome,(income+price)>>>0);assert.equal(after.scenario.farm.salesAccumulator,(sales+price)>>>0);
  assert.equal(after.scenario.regionalConditions[92],0);
  const text=game.save(4),loaded=GameSimulation.load(text,browserCrops).simulation;
  assert.equal(loaded.getSnapshot().lastLandSaleResult,null);assert.deepEqual(JSON.parse(loaded.save(4)),JSON.parse(text));
  game.dispatch({type:'sell-land',regionX:1,regionY:1});assert.deepEqual(game.getSnapshot().lastLandSaleResult,{ok:false,reason:'not-owned'});assert.equal(game.save(4),text);
  assert.equal(readNativeSave(text).state.finances.accounts.landIncome,(income+price)>>>0);
});
