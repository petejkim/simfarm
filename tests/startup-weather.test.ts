import { test, expect } from 'bun:test';
import { initializeWeather, initializeStartupWeather, PRECIPITATION_PATTERNS, chooseSky } from '../src/simulation/weather';
import { FarmRandom } from '../src/simulation/random';
import { CustomFarmSetup } from '../src/simulation/custom-farm-setup';
import { GameSimulation } from '../src/simulation/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { newFarmAssets as assets, newFarmOptions as options } from './support/new-farm';

test('native startup uses both calendar weeks, rain/snow boundary and current day without advancing soil or history', () => {
  for (const month of [0, 3, 11]) for (const day of [0, 6]) for (const temperature of [32, 33]) {
    const calendar = {month,week:3,day,year:1993,season:1}, index=month*4+3;
    const tables={wind:Array(240).fill(2),temperature:Array(240).fill(-10),precipitation:Array(240).fill(7)};
    tables.wind[index]=8;tables.temperature[index]=temperature;tables.temperature[index+1]=temperature+1;
    tables.precipitation[index]=1;tables.precipitation[index+1]=2;
    const random=new FarmRandom(options.seeds), expected=new FarmRandom(options.seeds);
    const cells=[{terrain:23,overlay:0,attribute:0}];
    const w=initializeWeather(tables,calendar,17,random,cells,8,'selected-climate');
    const forecast=(i:number)=>PRECIPITATION_PATTERNS[tables.precipitation[i]].map(rain=>rain?(tables.temperature[i]>32?3:4):chooseSky(tables.temperature[i],expected));
    expect(w.forecast).toEqual(forecast(index));expect(w.nextForecast).toEqual(forecast(index+1));
    expect(w.displayTemperature).toBe(temperature+expected.below(5));expect(random.snapshot()).toEqual(expected.snapshot());
    expect(w.temperature).toBe(temperature);expect(w.wind).toBe(8);expect(w.current).toBe(w.forecast[day]);
    expect(w.precipitationActive).toBe(w.current>=3);expect(w.precipitationDays).toBe(17);
    Object.assign(w,{moistureBalance:32,precipitationBonus:4,windAnomaly:60,temperatureAnomaly:22,windYear:4,temperatureYear:3,precipitationYear:2});
    initializeStartupWeather(w,tables,calendar,random,cells,'selected-climate');
    expect([w.moistureBalance,w.precipitationBonus,w.windAnomaly,w.temperatureAnomaly,w.windYear,w.temperatureYear,w.precipitationYear]).toEqual(Array(7).fill(0));
    expect(w.soilMoisture).toBe(8);expect(cells[0].terrain).toBe(23);expect(w.precipitationDays).toBe(17);
  }
});

test('accepted restart clears prior weather effects before touching preview soil; native save/load continues exactly',()=>{
  const prior=CustomFarmSetup.fresh(options,assets).accept();
  Object.assign(prior.weather,{wind:75,windAnomaly:60,temperatureAnomaly:22,moistureBalance:32,precipitationBonus:4,nextForecast:Array(7).fill(3)});
  prior.disasters.flags=31;Object.assign(prior.waterDisasters,{scanning:true,scanX:10,scanY:10,rawFF6C:123});
  const before=writeNativeSave(prior,null);
  const selected={...options,climate:{precipitation:0,temperature:0,wind:0}};
  const draft=CustomFarmSetup.restart(prior,selected,assets), preview=draft.getSnapshot().preview;
  const state=draft.accept('selected-climate');
  expect(writeNativeSave(prior,null)).toBe(before);
  expect(state.weather.soilMoisture).toBe(preview.terrain.soilMoisture);
  expect(state.disasters.flags&31).toBe(0);expect(state.waterDisasters.scanning).toBe(false);expect(state.waterDisasters.rawFF6C).toBe(123);
  const i=state.scenario.farm.calendar.month*4+state.scenario.farm.calendar.week;
  expect(state.weather.temperature).toBe(assets.climate.temperature[0][i]);expect(state.weather.wind).toBe(assets.climate.wind[0][i]);
  const a=GameSimulation.load(writeNativeSave(state,null),assets.crops,assets.townLayouts).simulation;
  const b=GameSimulation.load(a.save(null),assets.crops,assets.townLayouts).simulation;
  expect(b.save(null)).toBe(a.save(null));
  for(let n=0;n<8;n++){a.dispatch({type:'advance-day'});b.dispatch({type:'advance-day'});expect(b.save(null)).toBe(a.save(null));}
  const loaded=readNativeSave(before).state;expect(loaded.weather.windAnomaly).toBe(60);expect(loaded.weather.nextForecast).toEqual(Array(7).fill(3));
});
