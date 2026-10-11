import {test,expect} from '@playwright/test';
test('native audio repeats the body without a gap, keeps overlapping voices and stops on mute',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as unknown as {midiStarts:{start:number;stops:number[]}[]};w.midiStarts=[];
    const original=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){
      const node=original.call(this),start=node.start.bind(node),stop=node.stop.bind(node);
      const record={start:0,stops:[] as number[]};
      node.start=(when=0)=>{record.start=when;w.midiStarts.push(record);start(when);};
      node.stop=(when=0)=>{record.stops.push(when);stop(when);};
      return node;
    };
  });
  await page.route('**/amain.music.json',route=>route.fulfill({json:{events:[],endTick:1}}));
  const body=[{tick:0,data:[0x90,64,100],voice:0},{tick:36,data:[0x80,64,0],voice:0}];
  await page.route('**/genfarm.music.json',route=>route.fulfill({json:{ticksPerSecond:120,endTick:36,events:body,sourceMetadata:[],loop:{startTick:0,endTick:24,initialEvents:body,events:body}}}));
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing genfarm');
  const notes=()=>page.evaluate(()=>(window as unknown as {midiStarts:{start:number;stops:number[]}[]}).midiStarts);
  await expect.poll(async()=> (await notes()).filter(n=>n.stops.length).length).toBeGreaterThanOrEqual(4);
  const before=await notes();
  for(let i=1;i<4;i++)expect(before[i].start-before[i-1].start).toBeCloseTo(0.2,5);
  for(const note of before.slice(0,4))expect(note.stops[0]-note.start).toBeCloseTo(0.48,5);
  await page.getByRole('menuitemcheckbox',{name:'Music',exact:true}).click();await expect(page.locator('#audio-status')).toHaveText('Music off');
  const stopped=(await notes()).length;await page.waitForTimeout(400);expect((await notes()).length).toBe(stopped);
});
