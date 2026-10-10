import {readFileSync} from 'node:fs';
import {readScenario} from '../../src/formats/scenario';
import {GameSimulation} from './game';
import {browserCrops} from './crop-catalog';

export function financeMessageFixture(kind:'annual'|'estimate'|'tax-warning'|'tax-paid'|'tax-sale'|'loan-new'|'loan-warning'|'loan-paid'|'loan-sale'|'both'|'default'){
  const s=readScenario(readFileSync(new URL('../../../simfarm-dos/SCEN4.SSM',import.meta.url)));s.schedule.bytes.fill(0);
  Object.assign(s.farm.calendar,{day:6,week:3,month:0});s.farm.cash=0;
  const save=JSON.parse(new GameSimulation(s,browserCrops).withAllCrops(browserCrops).save(4));
  const f=save.runtime.finances;
  if(kind==='annual')save.scenario.farm.calendar.month=11;
  if(kind==='estimate')save.scenario.farm.calendar.month=5;
  if(kind==='loan-new'){save.scenario.farm.calendar.month=1;f.loan.principal=1000;f.loan.scheduledPayment=100;}
  if(kind.startsWith('tax-'))Object.assign(f.debt,{unpaidTaxes:kind==='tax-sale'?1:100,taxCountdown:kind==='tax-sale'?1:2});
  if(kind.startsWith('loan-')&&kind!=='loan-new')Object.assign(f.debt,{balanceDue:kind==='loan-sale'?1:100,balanceCountdown:kind==='loan-sale'?1:2});
  if(kind==='both'){Object.assign(f.debt,{balanceDue:100,balanceCountdown:2,unpaidTaxes:100,taxCountdown:2});save.scenario.farm.cash=1000;}
  if(kind.endsWith('-paid'))save.scenario.farm.cash=1000;
  if(kind==='default')Object.assign(f.debt,{balanceDue:0xffffffff,balanceCountdown:1});
  return GameSimulation.load(JSON.stringify(save),browserCrops).simulation;
}
