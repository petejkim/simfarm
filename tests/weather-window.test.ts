import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette,decodePlanar} from '../src/formats/graphics';
import {readWeatherArtwork,readWeatherScenes,readWeatherVane,WEATHER_LABELS} from '../src/formats/weather-window';
import {weatherWindowView} from '../src/simulation/weather-view';
import {readScenario} from '../src/formats/scenario';
import {GameSimulation} from './support/game';
import {browserCrops} from './support/crop-catalog';
import {shopFixture} from './support/livestock';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('Weather descriptor, callbacks, source data and numeric renderer are pinned',()=>{
  expect(hash(exe)).toBe('8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const ds=0x846f0,d=ds+0x436e;
  expect(Array.from({length:6},(_,i)=>exe.readUInt16LE(d+i*2))).toEqual([0x1061,0,160,128,336,208]);
  expect(Array.from({length:4},(_,i)=>exe.readUInt16LE(d+0x28+i*2))).toEqual([0x5ea,0x1b98,0x61a,0x1b98]);
  expect(exe.subarray(ds+0x3f56,ds+0x3f6a).toString()).toBe('WEATHER\0weather.bmp\0');
  expect(Array.from(exe.subarray(ds+0x406e,ds+0x4073))).toEqual([45,10,23,34,45]);
  expect(exe.subarray(ds+0x3fb6,ds+0x3fde).toString()).toBe('Slow\0\0\0\0Slow\0\0\0\0Average\0Fast\0\0\0\0Fast\0\0\0\0');
  expect(hash(exe.subarray(0x1db80,0x1e1ae))).toBe('f8e83a4d073f6fc504a79cb14680ec7bc78af99a24e59f4f1063ae1dea4e2b21');
  expect(hash(exe.subarray(0x8e8a,0x8f2a))).toBe('2da07c78f17281839c1f0211c2fcf76811b864651f1cd72e116fa3e6e3122351');
  expect(hash(exe.subarray(0x3fc4a,0x3fc61))).toBe('b007cea7658a717b411117366adba872c76ad09ec53da1ea65067306a4d680cc');
  expect(exe.subarray(0x1dc0f,0x1dc17).toString('hex')).toBe('a0dc43c0f805040f'); // signed temperature/32+15
  expect(exe.subarray(0x1dd03,0x1dd08).toString('hex')).toBe('8a87864198'); // missing selected-year offset
  expect(exe.subarray(0x1df79,0x1df85).toString('hex')).toBe('a0dc4324e3c0f8029805b63f');
  expect(exe.subarray(ds+0x43e2,ds+0x43ec).toString()).toBe('click.voc\0');
  expect(exe.subarray(0x502a0,0x502d0).toString()).toBe('Jan\0Feb\0Mar\0Apr\0May\0Jun\0Jul\0Aug\0Sep\0Oct\0Nov\0Dec\0');
});

test('Weather strips and vane match all source pixels; only bitmap lettering is removed from the frame',()=>{
  const before=asset('weather.bmp').slice(),original=readBitmap(before,palette),clean=readWeatherArtwork(before,palette);
  expect(hash(before)).toBe('109c54d3ebe5d7188c9b568051d09556229c8f7a5acc8fe88419b0f6307df569');
  let replacements=0;
  for(let y=0;y<192;y++)for(let x=0;x<336;x++){
    const i=(y*336+x)*4,m=WEATHER_LABELS.find(m=>x>=m.x&&x<m.x+m.width&&y>=m.y&&y<m.y+m.height);
    const black=original.rgba[i]===0&&original.rgba[i+1]===0&&original.rgba[i+2]===0;
    const expected=m&&black?[...palette['fill' in m?m.fill:12],255]:Array.from(original.rgba.subarray(i,i+4));
    if(m&&black)replacements++;
    expect(Array.from(clean.rgba.subarray(i,i+4))).toEqual(expected);
  }
  expect(replacements).toBeGreaterThan(900);expect(Array.from(before)).toEqual(Array.from(asset('weather.bmp')));
  for(const [name,read,raw] of [['weather-window.png',readWeatherArtwork,'weather.bmp'],['weather-sky.png',readWeatherScenes,'wethsky.btl'],['weather-ground.png',readWeatherScenes,'wethgrnd.btl'],['weather-vane.png',readWeatherVane,'wethvane.til']] as const){
    const r=read(asset(raw),palette),png=PNG.sync.read(readFileSync(new URL('../public/assets/'+name,import.meta.url)));
    expect([png.width,png.height]).toEqual([r.width,r.height]);expect(Array.from(png.data)).toEqual(Array.from(r.rgba));
    if(raw==='weather.bmp')continue;
    const count=raw==='wethvane.til'?2:4,width=count===2?32:112,bytes=width*32/2;
    for(let frame=0;frame<count;frame++){
      const offset=count===2?frame*512:22+frame*1794,sourcePixels=decodePlanar(asset(raw).subarray(offset,offset+bytes),width,32,palette).rgba;
      for(let y=0;y<32;y++)expect(Array.from(r.rgba.subarray((y*r.width+frame*width)*4,(y*r.width+(frame+1)*width)*4))).toEqual(Array.from(sourcePixels.subarray(y*width*4,(y+1)*width*4)));
    }
  }
});

test('Weather artwork readers reject truncated, extra and malformed record boundaries',()=>{
  for(const name of ['wethsky.btl','wethgrnd.btl']){
    const b=asset(name);for(let n=0;n<b.length;n++)expect(()=>readWeatherScenes(b.subarray(0,n),palette)).toThrow();
    for(const offset of [0,18,20,1814,3608,5402]){const bad=b.slice();bad[offset]^=1;expect(()=>readWeatherScenes(bad,palette)).toThrow();}
    expect(()=>readWeatherScenes(Uint8Array.from([...b,0]),palette)).toThrow();
  }
  for(let n=0;n<1024;n++)expect(()=>readWeatherVane(asset('wethvane.til').subarray(0,n),palette)).toThrow();
  expect(()=>readWeatherVane(new Uint8Array(1025),palette)).toThrow();
  const b=asset('weather.bmp');for(const n of [0,7,8,b.length-1])expect(()=>readWeatherArtwork(b.subarray(0,n),palette)).toThrow();
  const bad=b.slice();bad[0]=41;expect(()=>readWeatherArtwork(bad,palette)).toThrow();
});

test('Weather view retains all calendar boundary/forecast/year-table arithmetic and never mutates eight original farms',()=>{
  const till=[10,9,8,7,6,5,4,3,2,1,0,12,11,10,9,8,7,6,5,4,3,2,1,11,10,9,8,7,6,5,4,3,2,1,11,10,9,8,7,6,5,4,3,2,1,12,11,10];
  for(let id=0;id<8;id++){
    const game=new GameSimulation(readScenario(source(`SCEN${id}.SSM`)),browserCrops).withAllCrops(browserCrops),before=game.save(id),s=game.getSnapshot();
    for(let year=0;year<5;year++)for(let week=0;week<48;week++){
      const cal={...s.scenario.farm.calendar,month:week>>2,week:week&3,day:week%7},w={...s.weather,precipitationYear:year};
      const v=weatherWindowView(cal,w,s.scenario.climate);
      expect(v.weeksTill).toBe(till[week]);expect(v.countdown).toBe(`${till[week]} ${till[week]===1?'Week':'Weeks'} Till`);
      expect(v.forecast).toEqual([...w.forecast,...w.nextForecast].slice(cal.day,cal.day+5));
      const sum=s.scenario.climate.precipitation.slice(0,48).reduce((sum,n,i)=>sum+(s.scenario.climate.precipitation[year*48+i]>0?n:0),0);
      expect(v.averageRain).toBe((sum&65535)>>>2);
    }
    expect(game.save(id)).toBe(before);
  }
});

test('all signed temperature and unsigned rainfall words preserve source numbers while visuals remain bounded',()=>{
  const {state}=shopFixture(),w=state.weather,cal=state.scenario.farm.calendar,c=state.scenario.climate;
  for(let t=-128;t<=127;t++){
    const v=weatherWindowView(cal,{...w,displayTemperature:t},c);
    expect(v.fahrenheit).toBe(t);expect(v.celsius).toBe(Math.floor((t-32)/2));
    expect(v.temperatureHeight).toBe(Math.max(0,Math.trunc(t/3)));expect(v.evaporationFrame).toBe(15+Math.max(0,Math.floor(t/32)));
    expect(v.evaporation).toBe(t<64?'Slow':t<96?'Average':'Fast');
  }
  for(let n=0;n<=65535;n++){
    const v=weatherWindowView(cal,{...w,precipitationDays:n},c),expected=Math.floor((n>=32768?n-65536:n)/4);
    expect(v.rain).toBe(expected);expect(v.rainHeight).toBe(Math.max(0,Math.min(55,expected)));
  }
  for(let sky=0;sky<5;sky++)expect(weatherWindowView(cal,{...w,current:sky},c).sky).toBe(sky===4?3:sky);
  const climate={...c,precipitation:Array(240).fill(0)};climate.precipitation[0]=1;climate.precipitation[48]=7;
  expect(weatherWindowView(cal,{...w,precipitationYear:1},climate).averageRain).toBe(0); // source bug, not7/4
});
