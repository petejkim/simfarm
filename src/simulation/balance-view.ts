import type {GameSnapshot} from './game';
import type {CropDefinition} from '../formats/crop';
import {animalFullQuote,equipmentSaleQuote} from './asset-sale';
import {fieldHarvestValue} from './harvest-value';

/** Read-only0x41690..0x41eeb. Original paint writes valuation/report caches;
 * native reads canonical records and leaves those saved ledgers untouched. */
export function balanceWindowView(s:GameSnapshot,crops:readonly CropDefinition[]){
  const {scenario:w,finances:f,farmReport:r}=s,a=f.accounts,annual=f.annual;
  let machinery=0,futures=0,livestock=0;
  for(const e of w.equipment.slice(1))if(e.active&&!(e.flags&0x40))machinery=(machinery+(equipmentSaleQuote(e,w.equipmentDefinitions).value<<16>>16))>>>0;
  // Balance caller04170b overwrites the helper's high word with CWD.
  machinery=machinery<<16>>16;
  for(const field of w.fields.slice(1))if(field.active&&(field.bytes[48]|field.bytes[49]<<8)){
    const crop=crops.find(c=>`${c.id}.crp`===w.cropFiles[field.cropSlot]);if(!crop)throw new Error('Missing Balance Sheet crop');
    futures=(futures+(fieldHarvestValue(field,crop.rawDefinition,w.cropDefinitions[field.cropSlot].price)<<16>>16))>>>0;
  }
  for(const animal of w.animals.slice(1))if(animal.active)livestock=(livestock+animalFullQuote(animal,a.assets.animalDefinitions).value)>>>0;
  const land=s.taxAssessment.landValue,totalAssets=(w.farm.cash+machinery+land+futures+livestock)>>>0;
  const assets=[w.farm.cash|0,machinery,land,futures,livestock];
  const revenue=[w.farm.cropIncome,a.assets.equipmentIncome,a.landIncome,w.farm.contractGains,a.assets.livestockIncome];
  // Taxes intentionally displays prior-year tax DS3e40, not current DS3eb4.
  const expenses=[w.farm.seedExpenses,a.equipmentExpenses,w.farm.landExpenses,w.farm.contractLosses,annual.ds3e90,annual.livestockExpenses,w.farm.chemicalExpenses,a.balancePayments,w.farm.rentalExpenses,annual.priorTaxExpenses,annual.otherExpenses].map(n=>n|0);
  expenses[9]=annual.priorTaxExpenses; // DSaaBE uses unsigned formatting for this row.
  return {assets,revenue,expenses,totalAssets,income:r.income|0,totalExpenses:r.expenses|0,net:r.net|0,tax:s.taxAssessment.total|0,loan:f.loan.scheduledPayment|0};
}
