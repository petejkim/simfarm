import {test,expect,type Page} from '@playwright/test';
async function count(page:Page){return page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'&&e.length===2667).length);}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    if(!localStorage.getItem('simfarm.options.v1'))localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:true}));
    const events:any[]=[];(window as any).__pcm=events;const Base=window.AudioContext;
    window.AudioContext=class extends Base{
      constructor(options?:AudioContextOptions){super(options);const create=this.createBufferSource.bind(this);
        this.createBufferSource=()=>{const source=create(),start=source.start.bind(source),stop=source.stop.bind(source);
          source.start=(...args)=>{events.push({kind:'start',length:source.buffer?.length,audible:source.buffer?.getChannelData(0).some(x=>x!==0),state:this.state});start(...args);};
          source.stop=(...args)=>{events.push({kind:'stop',length:source.buffer?.length,delay:(args[0]??0)-this.currentTime});stop(...args);};return source;};
      }
    };
  });
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
});

test('toolbar, menus, dialog controls and keyboard buttons share one original click, respect disabled controls and mute',async({page})=>{
  async function click(selector:string){const before=await count(page);await page.locator(selector).click();await expect.poll(()=>count(page)).toBe(before+1);}
  await click('#file-menu-button');await page.keyboard.press('Escape');await click('#window-bank');
  await expect(page.locator('#repay-loan')).toBeDisabled();const before=await count(page);await page.locator('#repay-loan').dispatchEvent('click');expect(await count(page)).toBe(before);
  await page.getByRole('button',{name:'Close Bank',exact:true}).click();await expect.poll(()=>count(page)).toBe(before+1);
  await page.locator('#window-buy').focus();await page.keyboard.press('Space');await expect.poll(()=>count(page)).toBe(before+2);
  await page.locator('[data-window=buy]').getByRole('button',{name:'Machinery',exact:true}).click();await expect.poll(()=>count(page)).toBe(before+3);
  await click('#options-menu-button');await page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true}).click();
  const muted=await count(page);await page.locator('#window-bank').click();expect(await count(page)).toBe(muted);
  const samples=await page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'&&e.length===2667));
  expect(samples.every((e:any)=>e.audible&&e.state==='running')).toBe(true);
});

test('button feedback does not stop an original gameplay sample',async({page})=>{
  await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Farm Expert',exact:true}).click();
  await page.getByRole('region',{name:'Farm Expert',exact:true}).getByRole('button',{name:'Livestock',exact:true}).click();
  await page.getByRole('button',{name:'Play rooster sound',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__pcm.some((e:any)=>e.kind==='start'&&e.length===13218))).toBe(true);
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
});
