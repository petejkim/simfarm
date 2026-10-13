import {test,expect} from '@playwright/test';
import {encodeMidi} from '../../src/formats/xmidi';
test('light worklet uses bank 58, renders MIDI, honors source loop bounds and silences on mute',async({page})=>{
  await page.addInitScript(()=>{
    const Original=AudioWorkletNode;
    const w=window as any;w.adlMessages=[];
    window.AudioWorkletNode=class extends Original{
      constructor(context:BaseAudioContext,name:string,options?:AudioWorkletNodeOptions){
        super(context,name,options);w.adlNode=this;
        const analyser=context.createAnalyser();this.connect(analyser);w.adlAnalyser=analyser;
        const post=this.port.postMessage.bind(this.port);
        this.port.postMessage=((message:any)=>{w.adlMessages.push(message);post(message);}) as typeof post;
      }
    };
  });
  const events=[{tick:0,data:[0xc0,0]},{tick:0,data:[0x90,64,100]},{tick:60,data:[0x80,64,0]}];
  const midi=(loop:boolean)=>Buffer.from(encodeMidi({ticksPerSecond:120,endTick:120,events,sourceMetadata:[],...(loop?{loop:{startTick:0,endTick:90,initialEvents:events,events}}:{})}));
  await page.route('**/amain.mid',route=>route.fulfill({body:midi(false)}));
  await page.route('**/genfarm.mid',route=>route.fulfill({body:midi(true)}));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing genfarm');
  expect(await page.evaluate(()=>(window as any).adlMessages.filter((m:any)=>m.type==='setBank').map((m:any)=>m.bank))).toEqual([58]);
  const bounds=await page.evaluate(async()=>{
    const node=(window as any).adlNode as AudioWorkletNode;
    const query=(type:string,response:string)=>new Promise<number>(resolve=>{
      const handler=(event:MessageEvent)=>{if(event.data.type===response){node.port.removeEventListener('message',handler);resolve(event.data.time);}};
      node.port.addEventListener('message',handler);node.port.postMessage({type});
    });
    return [await query('getLoopStartTime','loopStartTime'),await query('getLoopEndTime','loopEndTime')];
  });
  expect(bounds[0]).toBeCloseTo(0,2);expect(bounds[1]).toBeCloseTo(0.75,2);
  await page.evaluate(()=>{const w=window as any;w.adlNode.connect(w.adlAnalyser);});
  const peak=()=>page.evaluate(()=>{const a=(window as any).adlAnalyser as AnalyserNode;const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs));});
  await expect.poll(peak).toBeGreaterThan(0.001);
  await page.waitForTimeout(1800);await expect.poll(peak).toBeGreaterThan(0.001);
  await page.getByRole('menuitemcheckbox',{name:'Music',exact:true}).click();await expect(page.locator('#audio-status')).toHaveText('Music off');
  await expect.poll(peak).toBeLessThan(0.0001);expect(errors).toEqual([]);
});
