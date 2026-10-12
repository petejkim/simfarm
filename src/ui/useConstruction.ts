import { useCallback,useState } from 'react';
import type { GameSimulation,GameSnapshot } from '../simulation/game';
import type { NetworkTool } from '../simulation/network-placement';
import { mapObjectInteraction } from '../simulation/map-interaction';

export type ConstructionTool=NetworkTool|'ditch'|'valve'|'trees'|'hay'|'trough';
const labels:Record<ConstructionTool,string>={'road-150':'Paved road','road-161':'Dirt road',fence:'Fence',gate:'Gate',ditch:'Ditch',valve:'Valve',trees:'Trees',hay:'Hay',trough:'Trough'};
const reasons:Record<string,string>={
  'outside-map':'Choose a tile inside the map.','town-land':'Town land cannot be built on.',
  'blocked-terrain':'Terrain blocks this work.','not-owned':'Buy this land before placing this item.',
  'straight-fence-required':'Place a gate on a straight fence.','straight-ditch-required':'Place a valve on a straight ditch.',
  'occupied':'This tile is occupied.','no-inventory-slots':'There is no room for another supply item.',
  'insufficient-cash':'There is not enough cash for this work.',
};
const blocked=(s:GameSnapshot)=>Boolean(s.pendingTown||s.finances.defaultDecision||s.aircraftFlight);
/** UI tool/feedback only: source mode4 ->23e22/24196. Simulation owns each purchase. */
export function useConstruction(simulation:GameSimulation|null,snapshot:GameSnapshot|null){
  const [tool,setTool]=useState<ConstructionTool|null>(null),[message,setMessage]=useState('');
  const cancel=useCallback(()=>{setTool(null);setMessage('');},[]);
  function paint(x:number,y:number,initial:boolean){
    if(!tool||!simulation)return false;
    const current=simulation.getSnapshot();if(blocked(current))return false;
    // Source20ab8 calls255ca once before the held construction loop. Valves
    // consume that initial press; gates toggle then allow the tool to continue.
    if(initial){
      const action=mapObjectInteraction(current.scenario,x,y);
      if(action?.type==='toggle-valve'){
        simulation.dispatch(action);const r=simulation.getSnapshot().lastIrrigationResult;
        setMessage(r?.ok?(r.tile&1?'Valve closed.':'Valve opened.'):'Cannot operate this valve.');return false;
      }
      if(action?.type==='network')simulation.dispatch(action);
    }
    const irrigation=tool==='ditch'||tool==='valve';
    if(tool==='trees')simulation.dispatch({type:'plant-tree',x,y});
    else if(tool==='hay'||tool==='trough')simulation.dispatch({type:'buy-livestock',productType:tool==='hay'?300:299,x,y});
    else if(irrigation)simulation.dispatch({type:'irrigation',tool,x,y});
    else simulation.dispatch({type:'network',tool,x,y});
    const next=simulation.getSnapshot(),result=tool==='trees'?next.lastTreeResult:tool==='hay'||tool==='trough'?next.lastLivestockResult:irrigation?next.lastIrrigationResult:next.lastNetworkResult;
    if(result)setMessage(result.ok?`${labels[tool]} placed for $${result.price+result.clearingCost}.`:reasons[result.reason]??'Cannot build here.');
    return true;
  }
  return {tool,message,cancel,paint,enabled:Boolean(tool&&snapshot&&!blocked(snapshot)),
    start(next:ConstructionTool){setTool(next);setMessage('');},
    hint:tool?`${labels[tool]}: click or drag to build · Escape stops construction`:'',
  };
}
