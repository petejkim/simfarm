import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readScenario} from '../src/formats/scenario';
import {readFarmState} from '../src/formats/scenario-state';
import {readNativeSave} from '../src/formats/native-save';
import {GameSimulation} from './support/game';
import {browserCrops} from './support/crop-catalog';
import {financeMessageFixture} from './support/finance-messages';
import {newFarmAssets,newFarmOptions} from './support/new-farm';
import {consumeSeed} from '../src/simulation/seeds';
import {reserveEquipment} from '../src/simulation/equipment-rental';
import type {GameEvent} from '../src/simulation/events';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const keys=['autoBuySeeds','autoScroll','autoClear','autoGoto','messages','autoRent'] as const;
const make=()=>new GameSimulation(readScenario(source('SCEN1.SSM')),browserCrops);

test('Options callback, edge scrolling, disaster navigation, preference loader and restart instructions match original bytes',()=>{
  const exe=source('SIMFARM.EXE');
  for(const [a,b,h] of [[0x3eaa0,0x3eb88,'473ec9c1d21d0b9e311f52f483d6e85b0acde49fa2dc50e108b309d7d70b5b49'],[0xc6a0,0xc88e,'374ec9a0d17eb934fa10ef6fe5eb0d4b8b1b9a3f6600341d780284efcfba4dec'],[0x3696b,0x369a7,'8f4198129705295f3c0366e4968c3e7e7ebe025abdc661288e36a5ae53514f26'],[0x36c7d,0x36cd3,'1099953899796748c19c43e6168f1c1e3744b2022a1a71f619eb5a45269d9ab9'],[0x4625e,0x463f6,'e2d868c6e3ad0bb1f3b04e34720113793f4a210ada84a69e687cdb5c70823e27'],[0x4067d,0x40773,'e43990964afd225452cb76e9e7866eeea84c6e0bc5ef6031852d0d388d8af579']] as const)
    expect(createHash('sha256').update(exe.subarray(a,b)).digest('hex')).toBe(h);
  expect(exe.subarray(0x846f0+0xa8a2,0x846f0+0xa8a2+12).toString()).toBe('genfarm.xmi\0');
  // Seventeen one-byte reads follow the tax countdown; these are runtime bytes,
  // alternating with menu check bytes. The last AutoScroll read wins.
  const destinations=[0xa760,0xa752,0xa744,0xa728,0xa736,0xa79c,0xa89d,0xa78e,0xa8a1,0xa7aa,0x0189,0xa7b8,0xa89f,0xa7c6,0xa89e,0xa7d4,0xa89c];
  destinations.forEach((address,i)=>expect(exe.readUInt16LE(0x4626c+i*24)).toBe(address));
});

test('original preferences read final sequential bytes, normalize nonzero flags and preserve raw originals',()=>{
  for(let i=0;i<8;i++){
    const b=source(`SCEN${i}.SSM`),s=readScenario(b);
    expect([s.farm.messages,s.farm.autoGoto,s.farm.autoScroll]).toEqual([0x21733,0x21735,0x21739].map(a=>Boolean(b[a])));
  }
  const b=source('SCEN1.SSM');
  for(let n=0;n<256;n++){
    b[0x21716]=n?0:1; b[0x21733]=b[0x21735]=b[0x21739]=n;
    const f=readFarmState(b);expect([f.messages,f.autoGoto,f.autoScroll]).toEqual([!!n,!!n,!!n]);
  }
  for(let size=0x21731;size<=0x2173b;size++)expect(()=>readFarmState(b.subarray(0,size))).toThrow('Binary range');
  expect(readScenario(b).sourceBytes).toEqual(new Uint8Array(b));
});

test('six canonical options save/load exactly without advancing time, changing RNG or replacing source bytes',()=>{
  for(const enabled of [false,true]){
    const game=make(),before=JSON.parse(game.save(1));
    for(const option of keys)game.dispatch({type:'set-option',option,enabled});
    const saved=JSON.parse(game.save(1));for(const key of keys)expect(saved.scenario.farm[key]).toBe(enabled);
    const expected=structuredClone(before);for(const key of keys)expected.scenario.farm[key]=enabled;
    expect(saved).toEqual(expected);expect(JSON.parse(GameSimulation.load(JSON.stringify(saved),browserCrops).simulation.save(1))).toEqual(saved);
  }
  const game=make();expect(()=>game.dispatch({type:'set-option',option:'cash' as 'autoScroll',enabled:true})).toThrow('Invalid farm option');
});

test('v25 validates preferences and migrates v23/v24 originals and generated farms with known source defaults',()=>{
  for(const expanded of [false,true]){
    const base=make(),game=expanded?base.withAllCrops(browserCrops):base;
    const save=JSON.parse(game.save(1));expect(save.version).toBe(28);
    for(const key of ['autoScroll','autoGoto','messages'])for(const value of [undefined,0,1,null,'true']){
      const bad=structuredClone(save);bad.scenario.farm[key]=value;
      expect(()=>GameSimulation.load(JSON.stringify(bad),browserCrops)).toThrow(key);
    }
    save.version=expanded?24:23;for(const key of ['autoScroll','autoGoto','messages'])delete save.scenario.farm[key];
    const farm=GameSimulation.load(JSON.stringify(save),browserCrops).simulation.getSnapshot().scenario.farm;
    expect([farm.autoScroll,farm.autoGoto,farm.messages]).toEqual([true,false,true]);
  }
  const game=GameSimulation.createNew(newFarmOptions,newFarmAssets).withAllCrops(browserCrops),save=JSON.parse(game.save(null));save.version=24;
  for(const key of ['autoScroll','autoGoto','messages'])delete save.scenario.farm[key];
  const farm=GameSimulation.load(JSON.stringify(save),browserCrops).simulation.getSnapshot().scenario.farm;
  expect([farm.autoScroll,farm.autoGoto,farm.messages]).toEqual([true,false,true]);
});

test('AutoBuy and AutoLease commands control actual seed purchases and automatic machine rentals',()=>{
  const game=make();game.dispatch({type:'set-option',option:'autoBuySeeds',enabled:false});game.dispatch({type:'set-option',option:'autoRent',enabled:false});
  let world=readNativeSave(game.save(1)).state.scenario;for(const item of world.inventory)item.bytes[10]=0;for(const d of world.seedDefinitions)d.count=0;
  expect(consumeSeed(world,0,0)).toEqual({ok:false,reason:'no-seeds'});expect(reserveEquipment(world,0,40,40,0)).toBeUndefined();
  game.dispatch({type:'set-option',option:'autoBuySeeds',enabled:true});game.dispatch({type:'set-option',option:'autoRent',enabled:true});
  world=readNativeSave(game.save(1)).state.scenario;for(const item of world.inventory)item.bytes[10]=0;for(const d of world.seedDefinitions)d.count=0;
  const cash=world.farm.cash;expect(consumeSeed(world,0,0).ok).toBe(true);expect(reserveEquipment(world,0,40,40,0)).toBeDefined();
  expect(world.farm.cash).toBeLessThan(cash);expect(world.farm.seedExpenses).toBeGreaterThan(0);expect(world.farm.rentalExpenses).toBeGreaterThan(0);
});

test('Messages suppresses optional forced-sale warnings while mandatory notices and financial outcomes remain intact',()=>{
  for(const [kind,expected] of [['tax-sale',[165]],['loan-sale',[168]],['annual',[159]],['loan-new',[166]]] as const){
    const game=financeMessageFixture(kind),control=GameSimulation.load(game.save(4),browserCrops).simulation,events:GameEvent[]=[];
    game.dispatch({type:'set-option',option:'messages',enabled:false});game.subscribeEvents(e=>events.push(e));game.dispatch({type:'advance-day'});control.dispatch({type:'advance-day'});
    expect(events.filter(e=>e.type==='finance-notice').map(e=>e.id)).toEqual([...expected]);
    control.dispatch({type:'set-option',option:'messages',enabled:false});expect(game.save(4)).toBe(control.save(4));
  }
});

test('AutoGoto requests the source tornado/locust origin once, independently of Messages and without checkpoint replay',()=>{
  for(const kind of ['tornado','swarm'] as const)for(const enabled of [false,true]){
    const game=make(),events:GameEvent[]=[];game.dispatch({type:'set-option',option:'autoGoto',enabled});game.dispatch({type:'set-option',option:'messages',enabled:false});
    game.subscribeEvents(e=>events.push(e));game.dispatch({type:'start-disaster',kind});
    const p=game.getSnapshot().disasters[kind];expect(game.getSnapshot().disasterNotices).toEqual([]);
    expect(events.filter(e=>e.type==='map-focus')).toEqual(enabled?[{type:'map-focus',x:p.x,y:p.y}]:[]);
    const count=events.length;game.dispatch({type:'start-disaster',kind});expect(events.length).toBe(count);
    const saved=game.save(1),copy=GameSimulation.load(saved,browserCrops).simulation;copy.subscribeEvents(e=>events.push(e));copy.getSnapshot();copy.dispatch({type:'set-speed',speed:1});expect(events.length).toBe(count);
  }
});
