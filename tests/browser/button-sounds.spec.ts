import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {decodeVoc} from '../../src/formats/voc';
import {disasterFixture} from '../support/disasters';
import {trafficFixture} from '../support/traffic';
import {speedItem} from '../support/workspace';
import {browserCrops} from '../support/crop-catalog';
import {readSaveText} from '../support/save-file';
async function count(page:Page){return page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'&&e.length===2667).length);}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    if(!localStorage.getItem('simfarm.options.v1'))localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:true}));
    const events:any[]=[];(window as any).__pcm=events;const Base=window.AudioContext;
    const buffers=new WeakMap<AudioBuffer,number>();let nextBuffer=0;
    window.AudioContext=class extends Base{
      constructor(options?:AudioContextOptions){super(options);const create=this.createBufferSource.bind(this),createBuffer=this.createBuffer.bind(this);
        this.createBuffer=(...args)=>{const buffer=createBuffer(...args),id=++nextBuffer,copy=buffer.copyToChannel.bind(buffer);buffers.set(buffer,id);
          events.push({kind:'buffer',length:buffer.length,id});
          buffer.copyToChannel=(...args)=>{events.push({kind:'copy',length:buffer.length,id});copy(...args);};return buffer;};
        this.createBufferSource=()=>{const source=create(),start=source.start.bind(source),stop=source.stop.bind(source);
          source.start=(...args)=>{events.push({kind:'start',length:source.buffer?.length,buffer:source.buffer?buffers.get(source.buffer):undefined,audible:source.buffer?.getChannelData(0).some(x=>x!==0),state:this.state});start(...args);};
          source.stop=(...args)=>{events.push({kind:'stop',length:source.buffer?.length,delay:(args[0]??0)-this.currentTime});stop(...args);};return source;};
      }
    };
  });
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
});

for(const touch of [false,true])test.describe(touch?'touch action feedback':'mouse and keyboard action feedback',()=>{
  if(touch)test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  test('rooster, disaster and Next Day effects replace button clicks; silent actions retain one click',async({page})=>{
    const activate=(button:Locator)=>touch?button.tap():button.click();
    const starts=()=>page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'));
    async function load(text:string){await page.locator('#load-farm-file').setInputFiles({name:'audio.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
    async function save(){
      const ok=page.locator('#finance-message-ok,#disaster-message-ok,#field-message-ok,#building-message-ok');
      while(await ok.isVisible())await activate(ok);
      const pending=page.waitForEvent('download');await activate(page.locator('#file-menu-button'));
      await activate(page.getByRole('menuitem',{name:'Save to File...',exact:true}));return JSON.parse(readSaveText((await(await pending).path())!));
    }
    async function feedback(action:()=>Promise<unknown>,length:number){
      const before=(await starts()).length;await action();
      await expect.poll(async()=>(await starts()).slice(before).map((e:any)=>e.length)).toEqual([length]);
      expect((await starts()).at(-1)).toMatchObject({audible:true,state:'running'});
    }
    await activate(page.locator('#windows-menu-button'));await activate(page.getByRole('menuitemcheckbox',{name:'Farm Expert',exact:true}));
    await activate(page.getByRole('region',{name:'Farm Expert',exact:true}).getByRole('button',{name:'Livestock',exact:true}));
    const rooster=page.getByRole('button',{name:'Play rooster sound',exact:true});
    for(let n=0;n<2;n++)await feedback(()=>activate(rooster),13218); // Cold load and cached repeats.
    for(const [kind,label,sound] of [['wind','Windstorm','wind'],['frost','Frost','wind'],['tornado','Tornado','tornado'],['swarm','Locusts','swarm'],['flood','Flood','flood'],['drought','Drought',null]] as const){
      const fixture=disasterFixture();fixture.state.scenario.farm.messages=false;
      const game=fixture.load().withAllCrops(browserCrops);await load(game.save(4));
      await activate(page.locator('#disasters-menu-button'));
      const choice=page.getByRole('menuitemcheckbox',{name:label,exact:true});
      const length=sound?decodeVoc(readFileSync(`public/assets/raw/${sound}.voc`)).samples.length:2667;
      await feedback(async()=>{if(touch)await choice.tap();else{await choice.focus();await page.keyboard.press('Enter');}},length);
      game.dispatch({type:'disaster-menu',action:kind});expect(game.getSnapshot().lastDisasterResult?.ok).toBe(true);
      expect(await save()).toEqual(JSON.parse(game.save(4)));
    }
    // No field: rejected Locusts still gets ordinary button feedback.
    const rejected=disasterFixture();for(const field of rejected.state.scenario.fields)field.bytes[7]&=~1;
    const invalid=rejected.load().withAllCrops(browserCrops);await load(invalid.save(4));await activate(page.locator('#disasters-menu-button'));
    await feedback(()=>activate(page.getByRole('menuitemcheckbox',{name:'Locusts',exact:true})),2667);
    invalid.dispatch({type:'disaster-menu',action:'swarm'});expect(await save()).toEqual(JSON.parse(invalid.save(4)));
    for(const collision of [false,true,true]){
      const game=trafficFixture(collision).load().withAllCrops(browserCrops);await load(game.save(4));
      const next=await speedItem(page,'#next-day');
      await feedback(()=>activate(next),collision?1467:2667);
      game.dispatch({type:'advance-day'});expect(await save()).toEqual(JSON.parse(game.save(4)));
    }
    await activate(page.locator('#options-menu-button'));await activate(page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true}));
    const muted=disasterFixture();muted.state.scenario.farm.messages=false;
    const game=muted.load().withAllCrops(browserCrops);await load(game.save(4));await activate(page.locator('#disasters-menu-button'));
    const before=(await starts()).length;await activate(page.getByRole('menuitemcheckbox',{name:'Windstorm',exact:true}));
    game.dispatch({type:'disaster-menu',action:'wind'});expect(await save()).toEqual(JSON.parse(game.save(4)));
    expect(await starts()).toHaveLength(before);
  });
});

test('toolbar, menus, dialog controls and keyboard buttons share one original click, respect disabled controls and mute',async({page})=>{
  async function click(selector:string){const before=await count(page);await page.locator(selector).click();await expect.poll(()=>count(page)).toBe(before+1);}
  await click('#file-menu-button');await page.keyboard.press('Escape');await click('#window-bank');
  await expect(page.locator('#repay-loan')).toBeDisabled();const before=await count(page);await page.locator('#repay-loan').dispatchEvent('click');expect(await count(page)).toBe(before);
  await page.getByRole('button',{name:'Close Bank',exact:true}).click();await expect.poll(()=>count(page)).toBe(before+1);
  await page.locator('#window-buy').focus();await page.keyboard.press('Enter');await expect.poll(()=>count(page)).toBe(before+2);
  await page.locator('[data-window=buy]').getByRole('button',{name:'Machinery',exact:true}).click();await expect.poll(()=>count(page)).toBe(before+3);
  await click('#options-menu-button');await page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true}).click();
  const muted=await count(page);await page.locator('#window-bank').click();expect(await count(page)).toBe(muted);
  const samples=await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'&&e.length===2667));
  expect(samples.every((e:any)=>e.audible&&e.state==='running')).toBe(true);
});

test('button feedback does not stop an original gameplay sample',async({page})=>{
  await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Farm Expert',exact:true}).click();
  await page.getByRole('region',{name:'Farm Expert',exact:true}).getByRole('button',{name:'Livestock',exact:true}).click();
  const clicks=await count(page);
  await page.getByRole('button',{name:'Play rooster sound',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__pcm.some((e:any)=>e.kind==='start'&&e.length===13218))).toBe(true);
  expect(await count(page)).toBe(clicks); // The rooster is the button's feedback; no layered click.
  const before=await count(page);await page.locator('#window-bank').click();await expect.poll(()=>count(page)).toBe(before+1);
  expect(await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='stop'&&e.length===13218).length)).toBe(0);
});

test('Button Click Sounds persists independently and leaves gameplay audio enabled',async({page})=>{
  await page.locator('#options-menu-button').click();const option=page.getByRole('menuitemcheckbox',{name:'Button Click Sounds',exact:true});
  await expect(option).toHaveAttribute('aria-checked','true');await option.click();
  const before=await count(page);await page.locator('#window-bank').click();await page.locator('#options-menu-button').click();expect(await count(page)).toBe(before);
  await expect(option).toHaveAttribute('aria-checked','false');await expect(page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true})).toHaveAttribute('aria-checked','true');
  await page.keyboard.press('Escape');await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Farm Expert',exact:true}).click();
  await page.getByRole('region',{name:'Farm Expert',exact:true}).getByRole('button',{name:'Livestock',exact:true}).click();await page.getByRole('button',{name:'Play rooster sound',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__pcm.some((e:any)=>e.kind==='start'&&e.length===13218))).toBe(true);expect(await count(page)).toBe(before);
  await page.reload();await expect(page.locator('#map-status')).toContainText('Scenario 1');await page.locator('#options-menu-button').click();
  await expect(option).toHaveAttribute('aria-checked','false');expect(await count(page)).toBe(0);
  await option.click();await page.locator('#window-bank').click();await expect.poll(()=>count(page)).toBe(1);
});

test('samples requested in rapid succession overlap instead of cutting each other off',async({page})=>{
  // Native enhancement (user request): the original single voice restarted per sample; repeats now layer.
  for(let i=0;i<4;i++)await page.locator('#window-bank').click({delay:0});
  await expect.poll(()=>count(page)).toBe(4);
  expect(await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='stop').length)).toBe(0);
  const events=await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.length===2667));
  expect(events.filter((e:any)=>e.kind==='buffer')).toHaveLength(1);
  expect(events.filter((e:any)=>e.kind==='copy')).toHaveLength(1);
  expect(new Set(events.filter((e:any)=>e.kind==='start').map((e:any)=>e.buffer)).size).toBe(1);
});

test('rapidly repeated gameplay samples load once and every request plays',async({page})=>{
  const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('/rooster.voc'))requests.push(r.url());});
  await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Farm Expert',exact:true}).click();
  await page.getByRole('region',{name:'Farm Expert',exact:true}).getByRole('button',{name:'Livestock',exact:true}).click();
  const rooster=page.getByRole('button',{name:'Play rooster sound',exact:true}),starts=()=>page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'&&e.length===13218).length);
  await rooster.click();await expect.poll(starts).toBe(1);
  for(let i=0;i<5;i++)await rooster.click({delay:0});
  // Each repeat starts at once from the cached decode, layered over the previous one.
  await expect.poll(starts).toBe(6);expect(requests).toHaveLength(1);
  expect(await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='stop'&&e.length===13218).length)).toBe(0);
  // Muting stops voices, but enabling again reuses the same sample and playback buffer.
  await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true}).click();
  await rooster.click();expect(await starts()).toBe(6);
  await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true}).click();
  await rooster.click();await expect.poll(starts).toBe(7);expect(requests).toHaveLength(1);
  const events=await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.length===13218));
  expect(events.filter((e:any)=>e.kind==='buffer')).toHaveLength(1);
  expect(events.filter((e:any)=>e.kind==='copy')).toHaveLength(1);
  expect(new Set(events.filter((e:any)=>e.kind==='start').map((e:any)=>e.buffer)).size).toBe(1);
  expect(events.filter((e:any)=>e.kind==='start').every((e:any)=>e.audible&&e.state==='running')).toBe(true);
});

test('cached PCM preserves selective stopping and voice limits, and disposal releases playback buffers',async({page})=>{
  await page.locator('#window-bank').click();
  const state=await page.evaluate(async()=>{
    const playerPath='/src/audio/pcm-player.ts',decoderPath='/src/formats/voc.ts';
    const {PcmPlayer}=await import(playerPath),{decodeVoc}=await import(decoderPath);
    const bytes=new Uint8Array(await (await fetch('/assets/raw/rooster.voc')).arrayBuffer());
    const first=decodeVoc(bytes),second=decodeVoc(bytes),player=new PcmPlayer();
    await player.enable();player.play(first);player.play(first);player.play(second);
    player.stop(first);
    const selective=!player.isPlaying(first)&&player.isPlaying(second);
    player.stop();
    for(let i=0;i<9;i++)player.play(first);
    const capped=(window as any).__pcm.filter((e:any)=>e.length===13218&&e.kind==='stop').length===4;
    player.dispose();const disposed=!player.playing;
    await player.enable();player.play(first);
    const events=(window as any).__pcm.filter((e:any)=>e.length===13218);
    const exact=events.filter((e:any)=>e.kind==='start').every((e:any)=>e.audible&&e.state==='running');
    player.dispose();return {selective,capped,disposed,exact,events};
  });
  expect(state.selective).toBe(true);expect(state.capped).toBe(true);expect(state.disposed).toBe(true);expect(state.exact).toBe(true);
  expect(state.events.filter((e:any)=>e.kind==='buffer')).toHaveLength(3);
  expect(state.events.filter((e:any)=>e.kind==='copy')).toHaveLength(3);
  const starts=state.events.filter((e:any)=>e.kind==='start');
  expect(starts).toHaveLength(13);expect(starts[0].buffer).toBe(starts[1].buffer);
  expect(starts[2].buffer).not.toBe(starts[0].buffer);
  expect(starts.slice(3,12).every((e:any)=>e.buffer===starts[0].buffer)).toBe(true);
  expect(starts[12].buffer).not.toBe(starts[0].buffer);
});

for(const touch of [false,true])test.describe(touch?'touch Spray confirmation':'mouse Spray confirmation',()=>{
  if(touch)test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  test('successful treatments click once, rejected orders stay silent, and both audio preferences apply',async({page})=>{
    async function load(text:string){await page.locator('#load-farm-file').setInputFiles({name:'spray.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
    async function save(){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
    async function point(x:number,y:number){
      await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-5)*16,Math.max(0,p.y-5)*16),{x,y});
      const r=(await page.locator('#world').boundingBox())!,tile=r.width/96,p={x:r.x+(x+.5)*tile,y:r.y+(y+.5)*tile};
      if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
    }
    async function choose(label:string,audible:boolean){
      const before=await count(page);await page.getByRole('button',{name:'SPRAY',exact:true}).click();
      if(audible)await expect.poll(()=>count(page)).toBe(before+1);
      await page.getByRole('menuitem',{name:label,exact:true}).click();
      if(audible)await expect.poll(()=>count(page)).toBe(before+2);
    }
    const fixture=disasterFixture();fixture.state.disasters.enabled=false;fixture.state.scenario.farm.autoScroll=false;
    for(const [kind,label] of [['fertilizer','Fertilizer'],['pesticide','Pesticide'],['herbicide','Herbicide'],['fungicide','Fungicide']] as const){
      const game=fixture.load().withAllCrops(browserCrops);await load(game.save(4));await choose(label,true);
      const before=await count(page);await point(30,30);expect(await count(page)).toBe(before);
      await point(22,22);game.dispatch({type:'treat-field',fieldSlot:1,treatment:kind});
      expect(game.getSnapshot().lastTreatmentResult?.ok).toBe(true);await expect.poll(()=>count(page)).toBe(before+1);
      await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('');
      await point(22,22);await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('Field is busy.');
      expect(await count(page)).toBe(before+1);expect(await save()).toEqual(JSON.parse(game.save(4)));
      const after=await count(page);await load(game.save(4));expect(await count(page)).toBe(after); // no replay
    }
    await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Button Click Sounds',exact:true}).click();
    for(const masterMuted of [false,true]){
      if(masterMuted){
        // Restore the click option while muting the sound master: either preference must suppress confirmation.
        await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Button Click Sounds',exact:true}).click();
        await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true}).click();
      }
      const game=fixture.load().withAllCrops(browserCrops);await load(game.save(4));await choose('Fertilizer',false);
      const before=await count(page);await point(22,22);game.dispatch({type:'treat-field',fieldSlot:1,treatment:'fertilizer'});
      await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('');expect(await count(page)).toBe(before);
      expect(await save()).toEqual(JSON.parse(game.save(4)));
    }
    const samples=await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'&&e.length===2667));
    expect(samples.every((e:any)=>e.audible&&e.state==='running')).toBe(true);
  });
});
