import { useCallback,useState } from 'react';
import type { GameSimulation,GameSnapshot } from '../simulation/game';
import { checkManualRemoval,type RemovalTarget } from '../simulation/manual-removal';

export type BulldozePrompt = {kind:'busy'} | {kind:'confirm';target:RemovalTarget;click:{x:number;y:number}};
const messages={
  'outside-map':'Choose a tile inside the map.','town-owned':'Town-owned land cannot be cleared.',
  'insufficient-cash':'You need $25 to bulldoze this location.','no-target':'Nothing removable at this tile.',
  'field-busy':'You cannot bulldoze a field while equipment is operating in it.',
  'target-changed':'The selected object has changed. Select it again before removing it.',
};
const blocked=(s:GameSnapshot)=>Boolean(s.pendingTown||s.finances.defaultDecision||s.aircraftFlight);
/** Source mode15 ->2591c. Only presentation drafts live here; canonical
 * removal commands validate current identity, records, money and terrain. */
export function useBulldoze(simulation:GameSimulation|null,snapshot:GameSnapshot|null){
  const [active,setActive]=useState(false),[pending,setPending]=useState<BulldozePrompt|null>(null),[message,setMessage]=useState('');
  const cancel=useCallback(()=>{setActive(false);setPending(null);setMessage('');},[]);
  function remove(target:RemovalTarget,click:{x:number;y:number}){
    if(!simulation||blocked(simulation.getSnapshot()))return;
    simulation.dispatch({type:'remove-object',...click,kind:target.kind,slot:target.slot,tile:target.tile});
    const r=simulation.getSnapshot().lastRemovalResult;
    if(r)setMessage(r.ok?`${({terrain:'Terrain',inventory:'Supply',chemical:'Chemical',building:'Building',field:'Field'})[r.kind]} removed for $25.`:messages[r.reason]);
  }
  function paint(x:number,y:number){
    if(!active||pending||!simulation)return false;
    const current=simulation.getSnapshot();if(blocked(current))return false;
    const q=checkManualRemoval(current.scenario,x,y);
    if(!q.ok){setMessage(messages[q.reason]);if(q.reason==='field-busy')setPending({kind:'busy'});return q.reason!=='field-busy'&&q.reason!=='insufficient-cash';}
    if(q.kind==='building'||q.kind==='field'){setPending({kind:'confirm',target:q,click:{x,y}});setMessage('');return false;}
    remove(q,{x,y});return true;
  }
  return {active,pending,message,cancel,paint,enabled:Boolean(active&&!pending&&snapshot&&!blocked(snapshot)),
    start(){setActive(true);setPending(null);setMessage('');},
    dismiss(){setPending(null);if(pending?.kind==='confirm')setMessage('Removal cancelled.');},
    confirm(){if(pending?.kind==='confirm')remove(pending.target,pending.click);setPending(null);},
    preview(position:{x:number;y:number}|null){
      const q=pending?.kind==='confirm'?pending.target:position&&snapshot?checkManualRemoval(snapshot.scenario,position.x,position.y):null;
      return q&&('ok' in q?q.ok:true)&&'width' in q?{x:q.x,y:q.y,width:q.width,height:q.height,valid:!snapshot||!blocked(snapshot)}:undefined;
    },
  };
}
