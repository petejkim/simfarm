import type {GameEvent} from '../simulation/events';
import { useCallback,useState } from 'react';
import type { GameSimulation,GameSnapshot } from '../simulation/game';
import { checkEquipmentPickup,type EquipmentMoveTarget } from '../simulation/manual-equipment-move';
import { checkSupplyPickup,type SupplyMoveTarget } from '../simulation/manual-supply-move';

type Selection={kind:'equipment';target:EquipmentMoveTarget}|{kind:'supply';target:SupplyMoveTarget};
/** Presentation-only pickup/drop state. Source136c6 tests pickup/drop cursor identity;
 * canonical preflights/commands own all movement, storage, pricing and saved state. */
export function useObjectMove(simulation:GameSimulation|null,snapshot:GameSnapshot|null,onEvent:(event:GameEvent)=>void){
  const [active,setActive]=useState(false),[selected,setSelected]=useState<Selection|null>(null);
  const cancel=useCallback(()=>{setSelected(null);setActive(false);},[]);
  const blocked=!snapshot||Boolean(snapshot.pendingTown||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
  function pickup(x:number,y:number){
    if(!snapshot)return null;
    const equipment=checkEquipmentPickup(snapshot.scenario,x,y);
    if(equipment.ok)return {ok:true as const,selection:{kind:'equipment' as const,target:equipment}};
    // Source13706 falls through to supplies only when the equipment finder is empty.
    if(equipment.reason!=='no-equipment')return {...equipment,originalWarning:equipment.reason==='equipment-busy'||equipment.reason==='building-closed'};
    const supply=checkSupplyPickup(snapshot.scenario,snapshot.finances,x,y);
    return supply.ok?{ok:true as const,selection:{kind:'supply' as const,target:supply}}:supply;
  }
  function click(x:number,y:number){
    if(!active||blocked||!simulation)return;
    if(!selected){
      const result=pickup(x,y);if(!result)return;
      if(result.ok){setSelected(result.selection);simulation.dispatch({type:'edit-status',code:7});}
      else {
        if('originalWarning' in result&&result.originalWarning)onEvent({type:'sound',sound:'uhoh'});
        if(result.reason==='equipment-busy')simulation.dispatch({type:'edit-status',code:61}); // SF-173
      }
      return;
    }
    simulation.dispatch(selected.kind==='equipment'?{type:'move-equipment',selected:selected.target,x,y}
      :{type:'move-supply',selected:selected.target,x,y});
    const next=simulation.getSnapshot(),result=selected.kind==='equipment'?next.lastEquipmentMoveResult:next.lastSupplyMoveResult;
    if(!result)return;
    // Original13c90 returns to pickup when the selected machine becomes busy.
    if(result.ok||result.reason==='equipment-busy')setSelected(null);
  }
  return {active,selected,click,
    start(){setSelected(null);setActive(true);},
    cancel,
  };
}
