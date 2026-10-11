import {test,expect,type Page} from '@playwright/test';
async function count(page:Page){return page.evaluate(()=>(window as any).__pcm.filter((e:any)=>e.kind==='start'&&e.length===2667).length);}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:true}));
    const events:any[]=[];(window as any).__pcm=events;const Base=window.AudioContext;
    window.AudioContext=class extends Base{
      constructor(options?:AudioContextOptions){super(options);const create=this.createBufferSource.bind(this);
        this.createBufferSource=()=>{const source=create(),start=source.start.bind(source),stop=source.stop.bind(source);
          source.start=(...args)=>{events.push({kind:'start',length:source.buffer?.length,audible:source.buffer?.getChannelData(0).some(x=>x!==0),state:this.state});start(...args);};
          source.stop=(...args)=>{events.push({kind:'stop',length:source.buffer?.length});stop(...args);};return source;};
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
