import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import { farmSnapshot } from '../support/field-checkpoint';
import { chooseDisaster, setDisastersEnabled, expectDisasterChecked } from '../support/disaster-menu';
import { reveal, acknowledgeFinanceMessages } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { disasterFixture } from '../support/disasters';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar,readPalette } from '../../src/formats/graphics';
import { decodeXmidi,encodeMidi } from '../../src/formats/xmidi';

async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'stationary.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page,suffix:string){await acknowledgeFinanceMessages(page);const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();const path=`artifacts/browser-stationary-${suffix}.json`;await(await pending).saveAs(path);return JSON.parse(readSaveText(path));}
const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url));
async function circles(page:Page){
  const a=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>a.find(a=>a.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
  for(const [x,y,t]of [[22,24,211],[23,24,212],[24,24,213],[25,24,214],[26,24,215],[24,23,210],[24,25,216]]){
    const expected=decodePlanar(asset('ega16til.til').subarray(t*128,(t+1)*128),16,16,palette).rgba;
    expect(await page.locator('#world').evaluate((c:HTMLCanvasElement,p)=>Array.from(c.getContext('2d')!.getImageData(p.x*16,p.y*16,16,16).data),{x,y})).toEqual(Array.from(expected));
  }
}
async function observeAudio(page:Page){await page.addInitScript(()=>{
  const Base=window.AudioContext,record={samples:[] as {length:number;peak:number}[],masters:[] as AnalyserNode[]};Object.assign(window,{stationaryAudio:record});
  window.AudioContext=class extends Base{
    constructor(options?:AudioContextOptions){super(options);const gain=this.createGain.bind(this),make=this.createBufferSource.bind(this);let first=true;
      this.createGain=()=>{const g=gain();if(first){first=false;const a=this.createAnalyser();g.connect(a);record.masters.push(a);}return g;};
      this.createBufferSource=()=>{const s=make(),start=s.start.bind(s);s.start=(...args)=>{const entry={length:s.buffer?.length??0,peak:0},a=this.createAnalyser();s.connect(a);record.samples.push(entry);
        const timer=setInterval(()=>{const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);entry.peak=Math.max(entry.peak,...Array.from(data,Math.abs));},10);s.addEventListener('ended',()=>clearInterval(timer));start(...args);};return s;};}
  };
});}
const audio=(page:Page)=>page.evaluate(()=>(window as unknown as {stationaryAudio:{samples:{length:number;peak:number}[]}}).stationaryAudio.samples);

test('frost controls cancel locusts, play original wind PCM and retain cooling/loss through active save and ending',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await observeAudio(page);await page.goto('/');
  const f=disasterFixture();f.state.weather.temperature=50;f.state.weather.temperatureAnomaly=0;const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));
  await toggleOption(page,'Sound Effects');
  await chooseDisaster(page,'swarm');g.dispatch({type:'disaster-menu',action:'swarm'});
  await chooseDisaster(page,'frost');g.dispatch({type:'disaster-menu',action:'frost'});
  await expectDisasterChecked(page,'swarm',false);await expectDisasterChecked(page,'tornado',false);
  await expectDisasterChecked(page,'frost');const damaged=(await farmSnapshot(page)).scenario.fields[1].bytes;expect(damaged[18]|damaged[19]<<8).toBe(255);
  await expect.poll(async()=>(await audio(page)).some(a=>a.length===12132&&a.peak>0.01)).toBe(true);
  const active=await save(page,'frost-active');expect(active).toEqual(JSON.parse(g.save(4)));const sounds=(await audio(page)).filter(s=>s.length!==2667).map(s=>s.length);
  await load(page,JSON.stringify(active));expect((await audio(page)).filter(s=>s.length!==2667).map(s=>s.length)).toEqual(sounds);
  await setDisastersEnabled(page,false);g.dispatch({type:'set-disasters-enabled',enabled:false});
  for(const day of [1,2]){await reveal(page, '#next-day'); await page.locator('#next-day').click();g.dispatch({type:'advance-day'});expect(g.getSnapshot().weather.temperature).toBe(day===1?28:8);expect(await save(page,`frost-day${day}`)).toEqual(JSON.parse(g.save(4)));}
  for(let day=2;day<12;day++){await reveal(page, '#next-day'); await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}
  await expectDisasterChecked(page,'frost',false);expect(await save(page,'frost-ended')).toEqual(JSON.parse(g.save(4)));expect(errors).toEqual([]);
});

test('saved crop circles retain original tiles and event flags; alien MIDI remains audible without replay on load',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await observeAudio(page);await page.goto('/');
  const f=disasterFixture();f.state.scenario.fields[1].bytes[14]=1;const g=f.load().withAllCrops(browserCrops);
  // The source trigger is debug-only; construct its resulting checkpoint outside the browser.
  g.dispatch({type:'start-disaster',kind:'crop-circles'});const active=JSON.parse(g.save(4));await load(page,JSON.stringify(active));
  await circles(page);expect(await save(page,'circles-active')).toEqual(active);
  await expect(page.locator('#disaster-message-ok')).toHaveCount(0);
  await toggleOption(page,'Music');await reveal(page,'#music');
  const response=page.waitForResponse(r=>r.url().endsWith('/alien.mid'));await page.locator('#music').selectOption('alien');
  const a=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  expect(await(await response).body()).toEqual(Buffer.from(encodeMidi(decodeXmidi(a.find(e=>e.name==='alien.xmi')!.bytes))));
  await expect(page.locator('#audio-status')).toContainText('Playing alien · MIDI');
  await expect.poll(()=>page.evaluate(()=>{const a=(window as unknown as {stationaryAudio:{masters:AnalyserNode[]}}).stationaryAudio.masters[0],data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.max(...Array.from(data,Math.abs));})).toBeGreaterThan(0.001);
  await page.locator('#music').selectOption('ffarm');await expect(page.locator('#audio-status')).toContainText('Playing ffarm');
  await load(page,JSON.stringify(active));await expect(page.locator('#audio-status')).toContainText('Playing ffarm');
  await circles(page);await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});
  const ended=await save(page,'circles-ended');expect(ended.runtime.disasters.flags&64).toBe(0);expect(ended).toEqual(JSON.parse(g.save(4)));await circles(page);
  await toggleOption(page,'Music');await load(page,JSON.stringify(active));
  await expect(page.locator('#audio-status')).toHaveText('Music off');await expect(page.locator('#music')).toHaveValue('ffarm');
  expect(await save(page,'circles-reloaded-muted')).toEqual(active);expect(errors).toEqual([]);
});

test('saved toxic warning remains flag-only and ordinary play has no provisional extra triggers',async({page})=>{
  await observeAudio(page);await page.goto('/');const f=disasterFixture(),g=f.load().withAllCrops(browserCrops);
  const before=JSON.parse(g.save(4));g.dispatch({type:'start-disaster',kind:'toxic-land'});const active=JSON.parse(g.save(4));
  expect(active.scenario).toEqual(before.scenario);expect(active.runtime.random).toEqual(before.runtime.random);
  await load(page,JSON.stringify(active));await expect(page.locator('#disaster-message-ok')).toHaveCount(0);
  await toggleOption(page,'Sound Effects');
  await expect(page.locator('#start-crop-circles,#start-toxic-land,[data-window=disasters]')).toHaveCount(0);
  // Uppercase A is source debug input, not an ordinary gameplay shortcut.
  await reveal(page,'#viewport');await page.keyboard.press('Shift+A');expect(await save(page,'warning')).toEqual(active);
  await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});
  const continued=await save(page,'warning-continued');expect(continued.runtime.disasters.flags&128).toBe(128);expect(continued).toEqual(JSON.parse(g.save(4)));
  expect((await audio(page)).filter(s=>s.length!==2667)).toEqual([]);
  await chooseDisaster(page,'wind');g.dispatch({type:'disaster-menu',action:'wind'});
  await expectDisasterChecked(page,'wind');expect(await save(page,'manual-wind')).toEqual(JSON.parse(g.save(4)));
  await expect.poll(async()=>(await audio(page)).some(a=>a.length===12132&&a.peak>0.01)).toBe(true);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
