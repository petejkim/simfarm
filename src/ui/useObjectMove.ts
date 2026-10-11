import type {GameEvent} from '../simulation/events';
import { useCallback,useState } from 'react';
import type { GameSimulation,GameSnapshot } from '../simulation/game';
import { checkEquipmentPickup,checkEquipmentMove,type EquipmentMoveTarget } from '../simulation/manual-equipment-move';
import { checkSupplyPickup,checkSupplyMove,type SupplyMoveTarget } from '../simulation/manual-supply-move';
import type { MapPreview } from '../render/world-renderer';

type Selection={kind:'equipment';target:EquipmentMoveTarget}|{kind:'supply';target:SupplyMoveTarget};
const reasons:Record<string,string>={
  'outside-map':'Choose a tile inside the map.','no-equipment':'Choose machinery or a supply to move.','no-supply':'Choose machinery, seeds, harvested crops, chemicals, feed or a trough.',
  'equipment-busy':'This machine is in use or already moving.','building-closed':'Open the building with a right-click or View object before selecting its machinery.',
  'use-aircraft-controls':'Use Aircraft controls to fly this plane.','not-owned':'Choose a destination on your land.',
  'inconsistent-equipment':'This machine has inconsistent storage or attachment records.','inconsistent-supply':'This supply has inconsistent inventory or storage records.',
  'target-changed':'The selected object has changed. Cancel and select it again.','equipment-here':'A machine occupies this tile.',
  'blocked-terrain':'Choose clear ground or compatible storage.','incompatible-storage':'This building cannot store that supply.',
  'no-storage-space':'This building has no free storage space.','storage-slot-overflow':'This supply cannot be referenced safely by that storage building.',
};
/** Presentation-only pickup/drop state. Source136c6 tests pickup/drop cursor identity;
 * canonical preflights/commands own all movement, storage, pricing and saved state. */
export function useObjectMove(simulation:GameSimulation|null,snapshot:GameSnapshot|null,onEvent:(event:GameEvent)=>void){
  const [active,setActive]=useState(false),[selected,setSelected]=useState<Selection|null>(null),[message,setMessage]=useState('');
  const cancel=useCallback(()=>{setSelected(null);setMessage('');setActive(false);},[]);
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
  function dropQuote(x:number,y:number){
    if(!snapshot||!selected)return null;
    return selected.kind==='equipment'?checkEquipmentMove(snapshot.scenario,selected.target,x,y)
      :checkSupplyMove(snapshot.scenario,snapshot.finances,selected.target,x,y,snapshot.weather.soilMoisture);
  }
  function click(x:number,y:number){
    if(!active||blocked||!simulation)return;
    if(!selected){
      const result=pickup(x,y);if(!result)return;
      if(result.ok){setSelected(result.selection);setMessage('');simulation.dispatch({type:'edit-status',code:7});}
      else {
        if('originalWarning' in result&&result.originalWarning)onEvent({type:'sound',sound:'uhoh'});
        if(result.reason==='equipment-busy')simulation.dispatch({type:'edit-status',code:61}); // SF-173
        setMessage(reasons[result.reason]??'This object cannot be moved.');
      }
      return;
    }
    simulation.dispatch(selected.kind==='equipment'?{type:'move-equipment',selected:selected.target,x,y}
      :{type:'move-supply',selected:selected.target,x,y});
    const next=simulation.getSnapshot(),result=selected.kind==='equipment'?next.lastEquipmentMoveResult:next.lastSupplyMoveResult;
    if(!result)return;
    if(result.ok){
      setMessage(selected.kind==='equipment'?'Movement ordered. Resume time to let the machinery travel.':
        'deleted' in result&&result.deleted?'Empty feed discarded.':'Supply moved.');setSelected(null);
    }else {
      // Original13c90 returns to pickup when the selected machine becomes busy.
      if(result.reason==='equipment-busy')setSelected(null);
      setMessage(reasons[result.reason]??'This object cannot be moved.');
    }
  }
  function preview(pointer:{x:number;y:number}|null):MapPreview|undefined{
    if(!active||!snapshot||!pointer)return;
    if(selected)return {...pointer,width:selected.kind==='equipment'?selected.target.width:1,height:selected.kind==='equipment'?selected.target.height:1,valid:!blocked&&Boolean(dropQuote(pointer.x,pointer.y)?.ok)};
    const result=pickup(pointer.x,pointer.y);
    if(result?.ok){const target=result.selection.target;return {x:target.x,y:target.y,width:result.selection.kind==='equipment'?result.selection.target.width:1,height:result.selection.kind==='equipment'?result.selection.target.height:1,valid:!blocked};}
    return {...pointer,width:1,height:1,valid:false};
  }
  return {active,selected,message,click,preview,
    start(){setSelected(null);setMessage('');setActive(true);},
    cancel,
    hint:selected?`${selected.kind==='equipment'?'Move machinery':`Move ${selected.target.kind}`}: click a destination · Escape cancels`:'Move object: click machinery or a supply · Escape cancels',
  };
}
