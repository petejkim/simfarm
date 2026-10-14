import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette} from '../src/formats/graphics';
import {EVALUATION_LABELS,readEvaluationArtwork} from '../src/formats/evaluation-window';
import {evaluationRatio,evaluationWindowView} from '../src/simulation/evaluation-view';
import {readScenario} from '../src/formats/scenario';
import {GameSimulation} from './support/game';
import {browserCrops} from './support/crop-catalog';
import {shopFixture} from './support/livestock';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('Evaluation source descriptor, Close control, paint, badges, suggestions and bar renderer are pinned',()=>{
  const ds=0x846f0,d=ds+0x44ac;
  expect(Array.from({length:6},(_,i)=>exe.readUInt16LE(d+i*2))).toEqual([0x1861,0,128,128,352,208]);
  expect(Array.from({length:6},(_,i)=>exe.readUInt16LE(d+40+i*2))).toEqual([0x4f0,0x1c78,0x51e,0x1c78,0x4496,0x6190]);
  expect(Array.from({length:11},(_,i)=>exe.readUInt16LE(ds+0x4496+i*2))).toEqual([0,288,168,48,24,1,8,3,14,0,0]);
  expect(exe.subarray(ds+0x43ee,ds+0x4406).toString()).toBe('EVALUATION\0evaluate.bmp\0');
  for(const [a,b,h] of [[0x1e98c,0x1ef38,'95a192108eac5bae7e30c637ad60dfb226d0488779555cfce6f98536e3bcc3de'],[0x1ef38,0x1f2aa,'f95f9cd1fa31f0ab442a95aea76dc1f7e1615e4361cb4813faf798977ba50cec'],[0xa0c8,0xa114,'c60c7e08f705f4324418fbd401ce73bd8278bce947eadbd1e570f4c1ebb3bed7']] as const)expect(hash(exe.subarray(a,b))).toBe(h);
});

test('Evaluation artwork removes lettering only, matches imported pixels and rejects truncated or wrong-size images',()=>{
  const bytes=asset('evaluate.bmp'),before=Uint8Array.from(bytes),raw=readBitmap(bytes,palette),masked=readEvaluationArtwork(bytes,palette);
  expect(hash(bytes)).toBe('136878cc449017978fc883b656ef788327e28028615defc91cfb6fd62cc224e9');
  expect(masked.width).toBe(352);expect(masked.height).toBe(192);
  for(let y=0;y<192;y++)for(let x=0;x<352;x++){
    const i=(y*352+x)*4,p=Array.from(raw.rgba.subarray(i,i+4)),label=EVALUATION_LABELS.some(l=>x>=l.x&&x<l.x+l.width&&y>=l.y&&y<l.y+l.height);
    expect(Array.from(masked.rgba.subarray(i,i+4))).toEqual(label&&p.slice(0,3).every(n=>n===0)?[...palette[12],255]:p);
  }
  expect(Array.from(bytes)).toEqual(Array.from(before));
  for(let length=0;length<bytes.length;length++)expect(()=>readEvaluationArtwork(bytes.subarray(0,length),palette)).toThrow();
  expect(()=>readEvaluationArtwork(asset('weather.bmp'),palette)).toThrow('Invalid Evaluation artwork');
});

test('Evaluation scans16 future weeks across five-year wrap, retains precipitation-year temperature selection and extends eligibility to24 crops',()=>{
  for(let farm=0;farm<8;farm++){
    const world=readScenario(source(`SCEN${farm}.SSM`)),game=new GameSimulation(world,browserCrops).withAllCrops(browserCrops),s=game.getSnapshot(),before=game.save(farm);
    for(let year=0;year<5;year++)for(let week=0;week<48;week++){
      const calendar={...s.scenario.farm.calendar,month:Math.floor(week/4),week:week%4};
      const snapshot={...s,scenario:{...s.scenario,farm:{...s.scenario.farm,calendar}},weather:{...s.weather,precipitationYear:year,temperatureYear:(year+1)%5}};
      const indices=Array.from({length:16},(_,i)=>(year*48+week+i)%240),t=indices.map(i=>world.climate.temperature[i]);
      const rain=(indices.reduce((sum,i)=>sum+world.climate.precipitation[i],0)&65535)>>>1,heat=t.filter(n=>n>50).reduce((sum,n)=>sum+7*(n-50),0)&65535,cold=t.filter(n=>n<45).reduce((sum,n)=>sum+45-n,0)&65535;
      const expected=s.scenario.cropFiles.flatMap((f,slot)=>{const c=browserCrops.find(c=>`${c.id}.crp`===f)!,b=Buffer.from(c.rawDefinition);return b.readUInt16LE(30)<=heat&&Math.floor(b.readUInt16LE(28)/7)<=cold&&b.readUInt16LE(40)<=rain?[slot]:[];});
      const v=evaluationWindowView(snapshot,browserCrops);expect(v.climate).toEqual({rain,heat,cold});expect(v.suggestions.map(c=>c.slot)).toEqual(expected);
    }
    expect(game.save(farm)).toBe(before);
  }
  const f=shopFixture();f.state.scenario.climate.precipitation.fill(7);f.state.scenario.climate.temperature=f.state.scenario.climate.temperature.map((_,i)=>i%2?60:40);
  const game=f.load().withAllCrops(browserCrops),v=evaluationWindowView(game.getSnapshot(),browserCrops);expect(v.suggestions.map(c=>c.slot)).toEqual(Array.from({length:24},(_,i)=>i));
  f.state.scenario.climate.precipitation.fill(-1);expect(evaluationWindowView(f.load().getSnapshot(),browserCrops).climate.rain).toBe(32760);
});

test('Evaluation preserves word arithmetic, source colors and field aggregation without rewriting annual caches',()=>{
  const f=shopFixture();for(let i=1;i<=8;i++){f.state.scenario.fields[i].bytes[7]|=1;f.state.scenario.fields[i].bytes[54]=1<<(i-1);}
  f.state.finances.statistics.words=[2,0,65535,0,3,0,0,0,0,0,0,4,0,2];
  const game=f.load(),before=game.save(4),v=evaluationWindowView(game.getSnapshot(),browserCrops);
  expect(v.gauges).toEqual([{raw:40,width:40,color:8},{raw:-40,width:80,color:8},{raw:36,width:36,color:8},{raw:10,width:10,color:3},{raw:10,width:10,color:3}]);
  expect(v.problems).toEqual(Array(8).fill(1));expect(game.save(4)).toBe(before);
  const empty=shopFixture().load();expect(evaluationWindowView(empty.getSnapshot(),browserCrops).gauges.slice(3)).toEqual([{raw:0,width:80,color:8},{raw:0,width:80,color:8}]);
  for(let n=0;n<65536;n++){
    const word=(n*80)%65536,signed=word>=32768?word-65536:word;
    expect(evaluationRatio(n,0)).toBe(signed);expect(evaluationRatio(n,2)).toBe(Math.trunc(signed/2));
  }
  expect(evaluationRatio(2048,65535)).toBe(32768); // Original IDIV overflows; native bounds drawing.
});
