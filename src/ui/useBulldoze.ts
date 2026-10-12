import { useCallback,useState } from 'react';
import type { GameSimulation,GameSnapshot } from '../simulation/game';
import { checkManualRemoval,type RemovalTarget } from '../simulation/manual-removal';

export type BulldozePrompt = {kind:'busy'} | {kind:'confirm';target:RemovalTarget;click:{x:number;y:number}};
const blocked=(s:GameSnapshot)=>Boolean(s.pendingTown||s.finances.defaultDecision||s.aircraftFlight);
/** Source mode15 ->2591c. Only presentation drafts live here; canonical
 * removal commands validate current identity, records, money and terrain. */
export function useBulldoze(simulation:GameSimulation|null,snapshot:GameSnapshot|null){
  const [active,setActive]=useState(false),[pending,setPending]=useState<BulldozePrompt|null>(null);
  const cancel=useCallback(()=>{setActive(false);setPending(null);},[]);
  function remove(target:RemovalTarget,click:{x:number;y:number}){
    if(!simulation||blocked(simulation.getSnapshot()))return;
    simulation.dispatch({type:'remove-object',...click,kind:target.kind,slot:target.slot,tile:target.tile});
  }
  function paint(x:number,y:number){
    if(!active||pending||!simulation)return false;
    const current=simulation.getSnapshot();if(blocked(current))return false;
    const q=checkManualRemoval(current.scenario,x,y);
    if(!q.ok){if(q.reason==='insufficient-cash')simulation.dispatch({type:'edit-status',code:42});if(q.reason==='field-busy')setPending({kind:'busy'});return q.reason!=='field-busy'&&q.reason!=='insufficient-cash';}
    if(q.kind==='building'||q.kind==='field'){setPending({kind:'confirm',target:q,click:{x,y}});return false;}
    remove(q,{x,y});return true;
  }
  return {active,pending,cancel,paint,enabled:Boolean(active&&!pending&&snapshot&&!blocked(snapshot)),
    start(){setActive(true);setPending(null);},
    dismiss(){setPending(null);},
    confirm(){if(pending?.kind==='confirm')remove(pending.target,pending.click);setPending(null);},
    preview(position:{x:number;y:number}|null){
      // Source2161d..21646 fixes the hover footprint at one tile; the
      // clicked object's full extent belongs to removal/confirmation only.
      return position&&!pending&&snapshot&&!blocked(snapshot)?{...position,width:1,height:1}:undefined;
    },
  };
}
