import { worldIndex, type Scenario } from '../formats/scenario';
import type { FinancialState } from '../formats/finance';
import type { CropDefinition } from '../formats/crop';
import { readItemText, type BuyCatalog } from '../formats/buy-window';
import { examineItemName, examineTownTile, type ExamineData } from '../formats/examine';
import { cropHarvestSlot, cropPlantSlot } from '../formats/crop-slots';
import { findBuilding } from './building-storage';
import { findEquipmentAt } from './manual-equipment-move';
import { animalSaleQuote, equipmentSaleQuote } from './asset-sale';
export interface ExamineTile { tile:number;x:number;y:number }
export interface ExamineObject {
  kind:'terrain'|'building'|'equipment'|'animal'|'chemical';
  text:string; fullText:boolean;card:number;tiles:ExamineTile[];
  damage?:number;quality?:number;value?:number;
}
/** Read-only original38b4a dispatch, after field lookup has opened Schedule.
 * No source globals, quote caches or simulation records are modified. */
export function examineObject(world:Scenario,finances:FinancialState,crops:readonly CropDefinition[],catalog:BuyCatalog,
  metadata:ExamineData,itemText:Uint8Array,x:number,y:number):ExamineObject|null {
  if(![x,y].every(n=>Number.isInteger(n)&&n>=0&&n<96))return null;
  const cell=world.cells[worldIndex(x,y)],ground=cell.terrain&2047,tile=(cell.terrain&2048?cell.overlay:cell.terrain)&2047;
  const full=(text:string,card=74):ExamineObject=>({kind:'terrain',text,fullText:true,card,tiles:[]});
  const name=(graphic:number)=>graphic*128+128<=itemText.length?examineItemName(itemText,graphic):metadata.strings.unknown;
  if([73,74,113,114].includes(ground))return full(metadata.strings.wreck,41);
  if(ground>=83&&ground<=86)return full(metadata.strings.water,50);
  if(cell.overlay&0x4000)return full(metadata.strings.town);
  // Homestead coordinates are source2d9f:000c/000e; each inside edge is inclusive.
  const home=finances.homestead;
  if(x>=home.x+1&&x<=home.x+3&&y>=home.y+1&&y<=home.y+3)return full(readItemText(itemText,12),67);
  const building=findBuilding(world,x,y);
  if(building&&!(building.flags&1)){
    const d=world.buildingDefinitions[building.type-64],tiles:ExamineTile[]=[];
    if(building.type!==70&&building.type!==71)for(let dx=0;dx<d.width;dx++)for(let dy=0;dy<d.height;dy++){
      const graphic=building.type===72?((building.bytes[10]|building.bytes[11]<<8)>>>6)+83:building.content(dx*3+dy).graphic;
      tiles.push({tile:graphic||217,x:24+dx*16,y:116+dy*16});
    }
    return {kind:'building',text:name(d.graphic&255),fullText:false,card:d.bytes[11],damage:building.bytes[6]>>>2,tiles};
  }
  const sprites=(graphic:number,width:number,height:number):ExamineTile[]=>{
    const base=catalog.tileBases[graphic];if(base===undefined)return [];
    return Array.from({length:width*height},(_,i)=>({tile:base+i,x:32+i%width*16,y:112+Math.floor(i/width)*16}));
  };
  const equipment=findEquipmentAt(world,x,y);
  if(equipment){
    const d=world.equipmentDefinitions[equipment.type],q=equipmentSaleQuote(equipment,world.equipmentDefinitions);
    return {kind:'equipment',text:name(d.graphic&255),fullText:false,card:d.bytes[11],tiles:sprites(d.graphic&255,d.width,d.height),quality:q.conditionBand,value:q.value<<16>>16};
  }
  const animal=world.animals.find(a=>a.slot&&a.active&&a.x===x&&a.y===y);
  if(animal){
    const d=finances.accounts.assets.animalDefinitions[animal.type-160];if(!d)return full(metadata.strings.unknown);
    const q=animalSaleQuote(animal,finances.accounts.assets.animalDefinitions);
    return {kind:'animal',text:name(d.graphic&255),fullText:false,card:d.bytes[11]+(animal.flags&1?1:0),tiles:sprites(d.graphic&255,1,1),quality:q.conditionBand,value:q.value<<16>>16};
  }
  const chemical=world.chemicals.find(c=>c.slot&&c.active&&c.x===x&&c.y===y);
  if(chemical){
    const d=world.chemicalDefinitions[chemical.type-220];
    return {kind:'chemical',text:name(d.graphic&255),fullText:false,card:d.bytes[11],tiles:sprites(d.graphic&255,1,1),quality:3-(chemical.bytes[9]>>>6),value:d.price<<16>>16};
  }
  if(examineTownTile(ground))return full(metadata.strings.townBuilding);
  if(tile===217)return full(metadata.strings.empty);
  const programmer=catalog.tileBases[125];if(tile>=programmer&&tile<=programmer+8)return full(metadata.strings.programmer);
  // All24 native seed/harvest icons retain their actual CRP identities.
  const cropSlot=Math.max(cropPlantSlot(tile,world.cropFiles.length),cropHarvestSlot(tile));
  if(cropSlot>=0){const crop=crops.find(c=>`${c.id}.crp`===world.cropFiles[cropSlot]);if(crop)return full(crop.description);}
  const graphic=catalog.tileBases.findIndex((base,i)=>tile>=base&&tile<base+metadata.tileCounts[i]);
  return full(graphic>=0&&graphic*128+128<=itemText.length?readItemText(itemText,graphic):metadata.strings.unknown);
}
