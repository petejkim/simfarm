import { useCallback,useState } from 'react';
import type { GameSimulation,GameSnapshot } from '../simulation/game';
import { checkNetworkPlacement,type NetworkTool } from '../simulation/network-placement';
import { checkIrrigationPlacement } from '../simulation/irrigation-placement';
import { mapObjectInteraction } from '../simulation/map-interaction';

export type ConstructionTool=NetworkTool|'ditch'|'valve';
const labels:Record<ConstructionTool,string>={'road-150':'Paved road','road-161':'Dirt road',fence:'Fence',gate:'Gate',ditch:'Ditch',valve:'Valve'};
const reasons:Record<string,string>={
  'outside-map':'Choose a tile inside the map.','town-land':'Town land cannot be built on.',
  'blocked-terrain':'Terrain blocks this work.','not-owned':'Buy this land before building a fence.',
  'straight-fence-required':'Place a gate on a straight fence.','straight-ditch-required':'Place a valve on a straight ditch.',
  'insufficient-cash':'There is not enough cash for this work.',
};
const blocked=(s:GameSnapshot)=>Boolean(s.pendingTown||s.finances.defaultDecision||s.aircraftFlight);
/** UI tool/feedback only: source mode4 ->23e22/24196. Simulation owns each purchase. */
export function useConstruction(simulation:GameSimulation|null,snapshot:GameSnapshot|null){
  const [tool,setTool]=useState<ConstructionTool|null>(null),[message,setMessage]=useState('');
  const cancel=useCallback(()=>{setTool(null);setMessage('');},[]);
  function quote(x:number,y:number){
    if(!tool||!snapshot)return null;
    return tool==='ditch'||tool==='valve'
      ?checkIrrigationPlacement(snapshot.scenario,snapshot.finances,tool,x,y,snapshot.weather.soilMoisture)
      :checkNetworkPlacement(snapshot.scenario,snapshot.finances,tool,x,y,snapshot.weather.soilMoisture);
  }
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
    if(irrigation)simulation.dispatch({type:'irrigation',tool,x,y});
    else simulation.dispatch({type:'network',tool,x,y});
    const next=simulation.getSnapshot(),result=irrigation?next.lastIrrigationResult:next.lastNetworkResult;
    if(result)setMessage(result.ok?`${labels[tool]} placed for $${result.price+result.clearingCost}.`:reasons[result.reason]??'Cannot build here.');
    return true;
  }
  return {tool,message,cancel,quote,paint,enabled:Boolean(tool&&snapshot&&!blocked(snapshot)),
    start(next:ConstructionTool){setTool(next);setMessage('');},
    hint:tool?`${labels[tool]}: click or drag to build · Escape stops construction`:'',
  };
}
