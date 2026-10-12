import type { Page } from '@playwright/test';
import {readSaveText} from './save-file';
import { GameSimulation } from './game';
import { browserCrops } from './crop-catalog';

/** Observe real saved simulation records; no debug UI or browser-side state injection. */
export async function farmSnapshot(page:Page){
  const notice=page.locator('#finance-message-ok,#disaster-message-ok,#field-message-ok,#building-message-ok');
  while(await notice.isVisible())await notice.click();
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Save',exact:true}).click();
  const text=readSaveText((await (await pending).path())!);
  return GameSimulation.load(text,browserCrops).simulation.getSnapshot();
}
export async function selectedFieldSnapshot(page:Page){
  const slot=Number(await page.locator('#planner-field').inputValue()),snapshot=await farmSnapshot(page);
  return {field:snapshot.scenario.fields[slot],estimate:snapshot.fieldHarvestEstimates[slot]};
}
export async function fieldDescription(page:Page){
  const selector=page.locator('#planner-field'),slot=await selector.count()?Number(await selector.inputValue()):0;
  const snapshot=await farmSnapshot(page),field=snapshot.scenario.fields[slot];
  return slot?`Field ${field.number} · ${field.status} · ${field.width} × ${field.height} tiles at ${field.x}, ${field.y}`
    :`${snapshot.scenario.fields.filter(f=>f.active).length} fields in this farm.`;
}
