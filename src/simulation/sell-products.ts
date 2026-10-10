import type { Scenario } from '../formats/scenario';
import type { FinancialState } from '../formats/finance';
import type { CropDefinition } from '../formats/crop';
import type { BuyCatalog } from '../formats/buy-window';
import { readItemText } from '../formats/buy-window';
import { cropHarvestTile } from '../formats/crop-slots';
import { animalSaleQuote, equipmentSaleQuote } from './asset-sale';
import { checkManualAssetSale } from './manual-asset-sale';
import { storedHarvestValue } from './harvest-sale';
import { shopProduct, type ShopProduct } from './shop-product';

export type SellCategory = 'harvest' | 'equipment' | 'animal';
export interface SellProduct extends ShopProduct {
  kind: SellCategory; slot: number; value: number; quality: number; available: boolean; reason: string | null;
  quantity?: number; loss?: number;
}
/** Source4baee scans active slots in ascending order, excluding rented machinery.
 * This is a read-only view; commands revalidate all state at sale time. */
export function sellProducts(world: Scenario, finances: FinancialState, crops: readonly CropDefinition[], catalog: BuyCatalog,
  itemText: Uint8Array, category: SellCategory, soilMoisture: number): SellProduct[] {
  if(category==='harvest')return world.inventory.filter(i=>i.slot>0&&i.active&&i.type>=168&&i.type<168+world.cropFiles.length).map(i=>{
    const slot=i.type-168, definition=world.harvestDefinitions[slot];
    return {...shopProduct(world,finances,crops,catalog,itemText,192+slot),type:i.type,kind:category,slot:i.slot,
      tile:cropHarvestTile(slot),width:definition.width,height:definition.height,value:storedHarvestValue(i,world),
      quality:3-(i.loss>>>14),quantity:i.quantity,loss:i.loss,available:true,reason:null};
  });
  const records=category==='animal'?world.animals.filter(a=>a.slot>0&&a.active):world.equipment.filter(e=>e.slot>0&&e.active&&!(e.flags&64));
  return records.map(record=>{
    const definition=category==='animal'?finances.accounts.assets.animalDefinitions[record.type-160]:world.equipmentDefinitions[record.type];
    const check=checkManualAssetSale(world,finances,category,record.slot,soilMoisture);
    const quote=category==='animal'?animalSaleQuote(world.animals[record.slot],finances.accounts.assets.animalDefinitions):equipmentSaleQuote(world.equipment[record.slot],world.equipmentDefinitions);
    const graphic=definition.graphic&255, description=graphic*128+128<=itemText.length?readItemText(itemText,graphic):`Item ${record.type}`;
    return {type:record.type,kind:category,slot:record.slot,name:description.split('\n')[0],description,price:definition.price,count:0,
      tile:catalog.tileBases[graphic]??null,width:definition.width,height:definition.height,card:definition.bytes[11]<80?definition.bytes[11]:null,cropId:null,
      value:quote.value<<16>>16,quality:quote.conditionBand,available:check.ok,reason:check.ok?null:check.reason};
  });
}
