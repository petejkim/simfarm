import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { disasterFixture } from '../support/disasters';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar,readPalette } from '../../src/formats/graphics';
import { decodeXmidi } from '../../src/formats/xmidi';

async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'stationary.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page,suffix:string){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();const path=`artifacts/browser-stationary-${suffix}.json`;await(await pending).saveAs(path);return JSON.parse(readFileSync(path,'utf8'));}
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
  await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();await reveal(page, '#sound-toggle'); await page.locator('#sound-toggle').click();
  await reveal(page, '#start-swarm'); await page.locator('#start-swarm').click();g.dispatch({type:'start-disaster',kind:'swarm'});
  await reveal(page, '#start-frost'); await page.locator('#start-frost').click();g.dispatch({type:'start-disaster',kind:'frost'});
  await expect(page.locator('#frost-state')).toContainText('Frost active. Paused.');await expect(page.locator('#disaster-state')).toContainText('No tornado or locust swarm active');
  await expect(page.locator('#start-frost')).toBeDisabled();await expect(page.locator('#disaster-notices')).toContainText('damaging 1 sensitive field');
  await expect.poll(async()=>(await audio(page)).some(a=>a.length===12132&&a.peak>0.01)).toBe(true);
  const active=await save(page,'frost-active');expect(active).toEqual(JSON.parse(g.save(4)));const sounds=(await audio(page)).length;
  await load(page,JSON.stringify(active));await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();expect((await audio(page)).length).toBe(sounds);
  await reveal(page, '#disasters-enabled'); await page.locator('#disasters-enabled').uncheck();g.dispatch({type:'set-disasters-enabled',enabled:false});
  for(const day of [1,2]){await reveal(page, '#next-day'); await page.locator('#next-day').click();g.dispatch({type:'advance-day'});expect(g.getSnapshot().weather.temperature).toBe(day===1?28:8);expect(await save(page,`frost-day${day}`)).toEqual(JSON.parse(g.save(4)));}
  for(let day=2;day<12;day++){await reveal(page, '#next-day'); await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}
  await expect(page.locator('#frost-state')).toHaveCount(0);await expect(page.locator('#disaster-notices')).toContainText('The frost has ended');expect(await save(page,'frost-ended')).toEqual(JSON.parse(g.save(4)));expect(errors).toEqual([]);
});

test('crop circles render original seven tiles and request audible alien MIDI without replaying the event on load',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await observeAudio(page);await page.goto('/');
  const f=disasterFixture();f.state.scenario.fields[1].bytes[14]=1;const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));
  await reveal(page, '#play'); await page.locator('#play').click();await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();const response=page.waitForResponse(r=>r.url().endsWith('/alien.music.json'));
  await reveal(page, '#start-crop-circles'); await page.locator('#start-crop-circles').click();g.dispatch({type:'start-disaster',kind:'crop-circles'});
  const a=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  expect(await(await response).json()).toEqual(decodeXmidi(a.find(e=>e.name==='alien.xmi')!.bytes));
  await expect(page.locator('#audio-status')).toContainText('Playing alien · MIDI');
  await expect.poll(()=>page.evaluate(()=>{const a=(window as unknown as {stationaryAudio:{masters:AnalyserNode[]}}).stationaryAudio.masters[0],data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.max(...Array.from(data,Math.abs));})).toBeGreaterThan(0.001);
  await expect(page.locator('#start-crop-circles')).toBeDisabled();await reveal(page, '#locate-circles'); await page.locator('#locate-circles').click();await circles(page);
  const active=await save(page,'circles-active');expect(active).toEqual(JSON.parse(g.save(4)));
  await reveal(page, '#music'); await page.locator('#music').selectOption('ffarm');await expect(page.locator('#audio-status')).toContainText('Playing ffarm');
  await load(page,JSON.stringify(active));await expect(page.locator('#audio-status')).toContainText('Playing ffarm');await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();
  await circles(page);await reveal(page, '#next-day'); await page.locator('#next-day').click();g.dispatch({type:'advance-day'});await expect(page.locator('#start-crop-circles')).toBeEnabled();await circles(page);
  expect(await save(page,'circles-ended')).toEqual(JSON.parse(g.save(4)));
  await reveal(page, '#play'); await page.locator('#play').click();await reveal(page, '#start-crop-circles'); await page.locator('#start-crop-circles').click();g.dispatch({type:'start-disaster',kind:'crop-circles'});
  await expect(page.locator('#audio-status')).toHaveText('Music off');await expect(page.locator('#music')).toHaveValue('ffarm');
  await page.setViewportSize({width:1280,height:844});await reveal(page, '#start-crop-circles'); await page.locator('#start-crop-circles').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({path:'artifacts/browser-stationary-mobile.png',fullPage:true});expect(errors).toEqual([]);
});

test('ineligible crop-circle attempts explain rejection and toxic warnings remain saved without invented damage or sound',async({page})=>{
  await observeAudio(page);await page.goto('/');const f=disasterFixture();f.state.scenario.fields[1].bytes[14]=0;const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));
  await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();await reveal(page, '#sound-toggle'); await page.locator('#sound-toggle').click();
  await reveal(page, '#disasters-enabled'); await page.locator('#disasters-enabled').uncheck();g.dispatch({type:'set-disasters-enabled',enabled:false});
  for(const id of ['start-frost','start-crop-circles','start-toxic-land','start-wind'])await expect(page.locator('#'+id)).toBeDisabled();
  await reveal(page, '#disasters-enabled'); await page.locator('#disasters-enabled').check();g.dispatch({type:'set-disasters-enabled',enabled:true});
  await reveal(page, '#start-crop-circles'); await page.locator('#start-crop-circles').click();g.dispatch({type:'start-disaster',kind:'crop-circles'});await expect(page.locator('#disaster-error')).toContainText('not suitable for crop circles');
  expect(await save(page,'rejected')).toEqual(JSON.parse(g.save(4)));
  await reveal(page, '#start-toxic-land'); await page.locator('#start-toxic-land').click();g.dispatch({type:'start-disaster',kind:'toxic-land'});
  await expect(page.locator('#toxic-warning-state')).toHaveText('Toxic-land warning recorded.');await expect(page.locator('#start-toxic-land')).toBeDisabled();
  const active=await save(page,'warning');expect(active).toEqual(JSON.parse(g.save(4)));expect(await audio(page)).toEqual([]);
  await load(page,JSON.stringify(active));await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();await reveal(page, '#toxic-warning-state'); await expect(page.locator('#toxic-warning-state')).toBeVisible();
  await reveal(page, '#next-day'); await page.locator('#next-day').click();g.dispatch({type:'advance-day'});expect(await save(page,'warning-continued')).toEqual(JSON.parse(g.save(4)));expect(await audio(page)).toEqual([]);
  await reveal(page, '#start-wind'); await page.locator('#start-wind').click();g.dispatch({type:'start-disaster',kind:'wind'});await expect(page.locator('#disaster-state')).toContainText('High winds active');
  await expect(page.locator('#start-wind')).toBeDisabled();expect(await save(page,'manual-wind')).toEqual(JSON.parse(g.save(4)));
  await expect.poll(async()=>(await audio(page)).some(a=>a.length===12132&&a.peak>0.01)).toBe(true);
});
