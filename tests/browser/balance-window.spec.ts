import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {balanceWindowView} from '../../src/simulation/balance-view';
import {BALANCE_LABELS} from '../../src/formats/balance-window';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {openWindow,reveal} from '../support/workspace';
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'balance.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await pending).path())!));}
async function open(page:Page){const panel=page.getByRole('region',{name:'Farm balance sheet'});if(await panel.isVisible())await panel.focus();else await page.locator('#window-balance').click();await expect(page.getByRole('region',{name:'Farm balance sheet'})).toBeFocused();}
const word=(b:Uint8Array,i:number,n:number)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint16(i,n,true);
function fixture(){const f=shopFixture();f.state.disasters.enabled=false;
  Object.assign(f.state.scenario.farm,{cropIncome:101,contractGains:104,seedExpenses:201,landExpenses:203,contractLosses:204,chemicalExpenses:207,rentalExpenses:209,workerExpenses:987});
  const a=f.state.finances.accounts,l=f.state.finances.annual;Object.assign(a,{equipmentExpenses:202,balancePayments:208,taxExpenses:999,landIncome:103});Object.assign(a.assets,{equipmentIncome:102,livestockIncome:105});Object.assign(l,{ds3e90:205,livestockExpenses:206,priorTaxExpenses:210,otherExpenses:211,reportIncome:123,reportExpenses:456,reportNet:789});return f;}
async function values(page:Page,v:ReturnType<typeof balanceWindowView>){
  for(const [group,rows] of [['asset',v.assets],['revenue',v.revenue],['expense',v.expenses]] as const)for(let i=0;i<rows.length;i++)await expect(page.locator(`#balance-${group}-${i}`)).toHaveText(String(rows[i]));
  for(const [id,n] of [['assets',v.totalAssets],['income',v.income],['expenses',v.totalExpenses],['net',v.net],['tax',v.tax],['loan',v.loan]])await expect(page.locator('#balance-'+id)).toHaveText(String(n));
}

test('Balance Sheet restores source geometry, every actual-text row, signed/full values and movable Close without rewriting caches',async({page})=>{
  const f=fixture();f.state.scenario.farm.cash=0x80000000;f.state.finances.annual.priorTaxExpenses=0xffffffff;f.state.finances.loan.scheduledPayment=0xffffffff;
  for(let i=1;i<=2;i++){const e=f.state.scenario.equipment[i];e.bytes.fill(0);e.flags=0x20;word(e.bytes,0,0);}word(f.state.scenario.equipmentDefinitions[0].bytes,6,20000);
  const game=f.load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));const before=await save(page),edit=await page.locator('#viewport').boundingBox();await open(page);
  const win=page.getByRole('dialog',{name:'Balance Sheet',exact:true}),client=page.getByRole('region',{name:'Farm balance sheet',exact:true});
  // Shared frame around a 384×216 ledger built from rows; no background bitmap.
  expect(await win.boundingBox()).toEqual({x:128,y:96,width:400,height:240});expect(await client.boundingBox()).toEqual({x:136,y:112,width:384,height:216});
  await expect(client.locator('img,canvas')).toHaveCount(0);
  const labels=client.locator('.balance-label'),sources=BALANCE_LABELS.slice(0,-1);
  expect((await labels.allTextContents()).sort()).toEqual(sources.map(l=>l.text).sort());
  // Each label starts at its source position (rows are 8px from source y8).
  for(const l of sources){const box=(await client.locator('.balance-label',{hasText:new RegExp(`^${l.text}$`)}).first().boundingBox())!;
    if(['Machinery','Land','Livestock'].includes(l.text))continue; // repeated in both columns; checked by text set
    expect({x:box.x,y:box.y},l.text).toEqual({x:128+l.x,y:112+l.y});}
  expect(await client.locator('.balance-cell[data-fill=header]').evaluateAll(els=>els.map(e=>getComputedStyle(e).backgroundColor))).toEqual(['rgb(0, 170, 4)','rgb(0, 170, 4)','rgb(0, 170, 4)']);
  expect(await client.getByRole('button',{name:'CLOSE',exact:true}).boundingBox()).toEqual({x:456,y:296,width:48,height:24});
  await values(page,balanceWindowView(game.getSnapshot(),browserCrops));await expect(page.locator('#balance-asset-0')).toHaveText('-2147483648');await expect(page.locator('#balance-asset-1')).toHaveText('-25536');await expect(page.locator('#balance-expense-9')).toHaveText('4294967295');await expect(page.locator('#balance-loan')).toHaveText('-1');
  await page.screenshot({path:'artifacts/browser-balance-window.png'});
  await open(page);await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');expect(await win.boundingBox()).toMatchObject({x:138,y:97});
  await client.getByRole('button',{name:'CLOSE',exact:true}).click();await expect(win).toBeHidden();await open(page);expect(await win.boundingBox()).toMatchObject({x:138,y:97});
  await page.keyboard.press('Escape');await expect(win).toBeHidden();expect(await page.locator('#viewport').boundingBox()).toEqual(edit);expect(await save(page)).toEqual(before);
});

test('Balance Sheet tracks annual collection, town choice, loans and saved continuation using the source report ledgers',async({page})=>{
  const f=fixture();Object.assign(f.state.scenario.farm.calendar,{month:11,week:3,day:6});const game=f.load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));
  await openWindow(page,'bank');await page.locator('#loan-amount').fill('1000');await page.locator('#borrow-loan').click();game.dispatch({type:'borrow',amount:1000});
  for(let day=0;day<4;day++){
    await open(page);await values(page,balanceWindowView(game.getSnapshot(),browserCrops));expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    if(day===2)await load(page,JSON.stringify(await save(page)));
    await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
    if(game.getSnapshot().pendingTown){await reveal(page,'#town-residential');await page.locator('#town-residential').click();game.dispatch({type:'choose-town',choice:'residential'});}
  }
  await openWindow(page,'bank');await page.locator('#repay-loan').click();game.dispatch({type:'repay-loan'});await open(page);
  await values(page,balanceWindowView(game.getSnapshot(),browserCrops));await expect(page.locator('#balance-loan')).toHaveText('0');expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await page.screenshot({path:'artifacts/browser-balance-year-end.png'});
});

test('missing Balance Sheet artwork fails before starting a farm',async({page})=>{
  await page.route('**/assets/balance-window.png',route=>route.abort());await page.goto('/');await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
});
