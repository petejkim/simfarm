import { useCallback,useState } from 'react';
import type { GameSimulation,GameSnapshot } from '../simulation/game';
import type { NetworkTool } from '../simulation/network-placement';
import { mapObjectInteraction } from '../simulation/map-interaction';

export type ConstructionTool=NetworkTool|'ditch'|'valve'|'trees'|'hay'|'trough';
const blocked=(s:GameSnapshot)=>Boolean(s.pendingTown||s.finances.defaultDecision||s.aircraftFlight);
/** UI tool state only: source mode4 ->23e22/24196. Simulation owns each purchase. */
export function useConstruction(simulation:GameSimulation|null,snapshot:GameSnapshot|null){
  const [tool,setTool]=useState<ConstructionTool|null>(null);
  const cancel=useCallback(()=>{setTool(null);},[]);
  function paint(x:number,y:number,initial:boolean){
    if(!tool||!simulation)return false;
    const current=simulation.getSnapshot();if(blocked(current))return false;
    // Source20ab8 calls255ca once before the held construction loop. Valves
    // consume that initial press; gates toggle then allow the tool to continue.
    if(initial){
      const action=mapObjectInteraction(current.scenario,x,y);
      if(action?.type==='toggle-valve'){
        simulation.dispatch(action);return false;
      }
      if(action?.type==='network')simulation.dispatch(action);
    }
    const irrigation=tool==='ditch'||tool==='valve';
    if(tool==='trees')simulation.dispatch({type:'plant-tree',x,y});
    else if(tool==='hay'||tool==='trough')simulation.dispatch({type:'buy-livestock',productType:tool==='hay'?300:299,x,y});
    else if(irrigation)simulation.dispatch({type:'irrigation',tool,x,y});
    else simulation.dispatch({type:'network',tool,x,y});
    return true;
  }
  return {tool,cancel,paint,enabled:Boolean(tool&&snapshot&&!blocked(snapshot)),
    start(next:ConstructionTool){setTool(next);},
  };
}
