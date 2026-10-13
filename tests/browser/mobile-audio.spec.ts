import {test,expect,type Page} from '@playwright/test';

/** A strict mobile policy: contexts start suspended and resume() only works during user activation. Limitation:
 * Chromium grants activation already on a touch pointerdown, unlike iOS WebKit (touchend), so this cannot tell
 * pointerdown-only unlocking apart; real-device confirmation (2026-10-12) covers that. It still proves a tap
 * unlocks and starts music under a no-autoplay policy without errors. */
async function strictAudioPolicy(page:Page){
  await page.addInitScript(()=>{
    const w=window as unknown as {contexts:AudioContext[];resumeCalls:boolean[]};w.contexts=[];w.resumeCalls=[];
    const resume=AudioContext.prototype.resume;
    AudioContext.prototype.resume=function(this:AudioContext){
      const active=navigator.userActivation.isActive;w.resumeCalls.push(active);
      return active?resume.call(this):Promise.resolve();
    };
    const Base=window.AudioContext;
    window.AudioContext=class extends Base{constructor(options?:AudioContextOptions){super(options);void this.suspend();w.contexts.push(this);}};
  });
}
const running=(page:Page)=>page.evaluate(()=>{
  const contexts=(window as unknown as {contexts:AudioContext[]}).contexts;
  return contexts.length>0&&contexts.every(c=>c.state==='running');
});

test.describe('touch device',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  test('a tap unlocks music and sound effects under a strict mobile autoplay policy',async({page})=>{
    await strictAudioPolicy(page);
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const date=(await page.locator('#farm-date').boundingBox())!;
    await page.touchscreen.tap(date.x+date.width/2,date.y+date.height/2);
    // Unlocking happened from an activation-triggering event (touchend/pointerup), so both contexts now run.
    await expect.poll(()=>running(page)).toBe(true);
    expect(await page.evaluate(()=>(window as unknown as {resumeCalls:boolean[]}).resumeCalls.includes(true))).toBe(true);
    await page.locator('#options-menu-button').tap();await page.getByRole('menuitem',{name:'Settings…',exact:true}).tap();
    await expect(page.locator('#audio-status')).toContainText('Playing amain · MIDI · FM bank 58');
    expect(errors).toEqual([]);
  });
});

test('without AudioWorklet (plain-http LAN address) music renders on the main thread',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as unknown as {worklets:number;analyser?:AnalyserNode};w.worklets=0;
    Object.defineProperty(BaseAudioContext.prototype,'audioWorklet',{configurable:true,get:()=>undefined});
    const Worklet=window.AudioWorkletNode;
    window.AudioWorkletNode=class extends Worklet{constructor(c:BaseAudioContext,n:string,o?:AudioWorkletNodeOptions){super(c,n,o);w.worklets++;}};
    const create=AudioContext.prototype.createScriptProcessor;
    AudioContext.prototype.createScriptProcessor=function(this:AudioContext,...args:Parameters<typeof create>){
      const node=create.apply(this,args),analyser=this.createAnalyser();node.connect(analyser);w.analyser=analyser;return node;
    };
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();await page.getByRole('menuitem',{name:'Settings…',exact:true}).click();
  await expect(page.locator('#audio-status')).toContainText('Playing amain · MIDI · FM bank 58');
  const peak=()=>page.evaluate(()=>{
    const a=(window as unknown as {analyser?:AnalyserNode}).analyser;if(!a)return 0;
    const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs));
  });
  await expect.poll(peak,{timeout:10_000}).toBeGreaterThan(0.001);
  expect(await page.evaluate(()=>(window as unknown as {worklets:number}).worklets)).toBe(0);
  expect(errors).toEqual([]);
});
