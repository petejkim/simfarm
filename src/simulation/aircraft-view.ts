import type { Scenario } from '../formats/scenario';
import { terrainTile, worldIndex } from '../formats/scenario';
import { MAX_EQUIPMENT_SLOT, type EquipmentRecord } from '../formats/equipment';
import { findEquipmentAt } from './manual-equipment-move';
import { aircraftChemical, aircraftFuel, aircraftPayload, type AircraftServiceState } from './aircraft';
import { flightPosition, type AircraftFlight } from './aircraft-flight';

/** Shared map interceptor257b0: a parked image consumes the press, even if
 * no equipment is found. Native never opens aircraft controls for another type. */
export function aircraftMapEntry(world:Scenario,x:number,y:number):{slot:number|null}|null {
  if(![x,y].every(n=>Number.isInteger(n)&&n>=0&&n<96))return null;
  if(![71,72,111,112].includes(terrainTile(world.cells[worldIndex(x,y)])))return null;
  const e=findEquipmentAt(world,x,y);
  return {slot:e?.type===8&&e.slot<=MAX_EQUIPMENT_SLOT?e.slot:null};
}
/** Paint306e2: supplies/52+10, damage/52; prices remain readable even when
 * unaffordable. SF-163: show the full payload debit instead of its low word. */
export function aircraftWindowView(world:Scenario,state:AircraftServiceState,e:EquipmentRecord){
  const fuel=aircraftFuel(e),payload=aircraftPayload(e),unitPrice=Math.floor(world.chemicalDefinitions[state.selectedChemical-220].price/10);
  const valid=fuel<=255&&payload<=255;
  return {fuel,payload,damage:e.condition,
    gauges:valid?[10+Math.floor(fuel/52),10+Math.floor(payload/52),Math.floor(e.condition/52)]:null,
    prices:valid?{fuel:255-fuel,load:(255-payload)*unitPrice,repair:e.condition*10}:null};
}

/** Native in-flight readouts (user request; the original showed none). Heading index0..7 runs clockwise from north
 * (moveFlight); fuel/payload/condition are the raw0..255 record values. Landing mirrors finishFlight: ending over
 * any airport region (low nibble5) lands, anywhere else crashes. */
export const FLIGHT_HEADINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export function aircraftFlightView(world:Scenario,f:AircraftFlight){
  const e=world.equipment[f.slot],p=flightPosition(f);
  return {altitude:f.altitude,heading:FLIGHT_HEADINGS[f.heading&7],fuel:aircraftFuel(e),payload:aircraftPayload(e),
    chemical:aircraftChemical(e),damage:e.condition,spraying:f.spraying,
    overAirport:(world.regionalConditions[((p.x>>3)*12+(p.y>>3))*7]&15)===5};
}
