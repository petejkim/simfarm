import {expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readScenario} from '../../src/formats/scenario';
import {GameSimulation} from './game';
import {browserCrops} from './crop-catalog';
import {acknowledgeFinanceMessages} from './workspace';

/** Explicit cold fixture for subsystem tests, loaded through the real File picker.
 * Ordinary SSM import retains session state and must be tested separately. */
export async function loadScenarioCheckpoint(page:Page,id:number){
  if(!Number.isInteger(id)||id<0||id>7)throw new Error('Invalid scenario fixture');
  const bytes=readFileSync(new URL(`../../../simfarm-dos/SCEN${id}.SSM`,import.meta.url));
  const simulation=new GameSimulation(readScenario(bytes),browserCrops).withAllCrops(browserCrops);
  await acknowledgeFinanceMessages(page);await page.locator('#file-menu-button').click();
  const picker=page.waitForEvent('filechooser');
  await page.getByRole('menuitem',{name:'Load Game',exact:true}).click();
  await (await picker).setFiles({name:`scenario-${id}.simfarm.json`,mimeType:'application/json',buffer:Buffer.from(simulation.save(id))});
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await expect(page.locator('#map-status')).toHaveText(`Scenario ${id+1} · original terrain`);
}
