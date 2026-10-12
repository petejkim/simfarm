import type { Page } from '@playwright/test';
import {readSaveText} from './save-file';
import { GameSimulation } from './game';
import { browserCrops } from './crop-catalog';

/** Observe real saved simulation records; no debug UI or browser-side state injection. */
export async function farmSnapshot(page:Page){
  const notice=page.locator('#finance-message-ok,#disaster-message-ok,#field-message-ok,#building-message-ok');
  while(await notice.isVisible())await notice.click();
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();
  const text=readSaveText((await (await pending).path())!);
  return GameSimulation.load(text,browserCrops).simulation.getSnapshot();
}
type Snapshot=Awaited<ReturnType<typeof farmSnapshot>>;
/** Selected field slot, read from the Schedule window's name ("Field N schedule"); 0 when none is selected. */
export async function selectedFieldSlot(page:Page,snapshot:Snapshot){
  const label=await page.locator('#field-planner').getAttribute('aria-label').catch(()=>null);
  const number=Number(label?.match(/^Field (\d+) schedule$/)?.[1]??NaN);
  return snapshot.scenario.fields.find(f=>f.active&&f.number===number)?.slot??0;
}
export async function selectedFieldSnapshot(page:Page){
  const snapshot=await farmSnapshot(page),slot=await selectedFieldSlot(page,snapshot);
  return {field:snapshot.scenario.fields[slot],estimate:snapshot.fieldHarvestEstimates[slot]};
}
export async function fieldDescription(page:Page){
  const snapshot=await farmSnapshot(page),slot=await selectedFieldSlot(page,snapshot),field=snapshot.scenario.fields[slot];
  return slot?`Field ${field.number} · ${field.status} · ${field.width} × ${field.height} tiles at ${field.x}, ${field.y}`
    :`${snapshot.scenario.fields.filter(f=>f.active).length} fields in this farm.`;
}
