import { terrainTile,worldIndex,type Scenario } from '../formats/scenario';
import { findBuilding } from './building-storage';

export type MapObjectInteraction =
  | {type:'toggle-valve';x:number;y:number}
  | {type:'network';tool:'open-gate'|'close-gate';x:number;y:number}
  | {type:'toggle-building-interior';slot:number;x:number;y:number};

/** Secondary-button path20dfc calls255ca, then building lookup/toggle20e2c/20e65.
 * This projection covers farm fixtures; town-window/aircraft routing is separate. */
export function mapObjectInteraction(world:Scenario,x:number,y:number):MapObjectInteraction|null {
  if(![x,y].every(n=>Number.isInteger(n)&&n>=0&&n<96))return null;
  const tile=terrainTile(world.cells[worldIndex(x,y)]);
  if(tile>=122&&tile<=125)return {type:'toggle-valve',x,y};
  if(tile>=188&&tile<=191)return {type:'network',tool:tile&1?'close-gate':'open-gate',x,y};
  const building=findBuilding(world,x,y);
  return building&&building.type!==70&&building.type!==71
    ?{type:'toggle-building-interior',slot:building.slot,x,y}:null;
}
