import type { GameAssets } from '../assets/game-assets';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { aircraftChemical, checkAircraftService, type AircraftServiceAction } from '../simulation/aircraft';
import { aircraftWindowView } from '../simulation/aircraft-view';
import { AIRCRAFT_CONTROLS } from '../formats/aircraft-window';
import { GameWindow, useWindows } from './GameWindow';
const money=(n:number)=>`$${n.toLocaleString('en-US')}`;
const names:Record<number,string>={221:'Pesticide',222:'Herbicide',223:'Fungicide'};
const messages={
  'insufficient-cash':'There is not enough cash.', 'not-aircraft':'Choose an aircraft.',
  'not-parked':'The aircraft must be parked at its airport for service.',
  'invalid-service':'Choose an available service.', 'invalid-supplies':'This aircraft has invalid fuel or payload quantities.',
};
export function AircraftWindow({assets,snapshot,selectedSlot,onSelect,onCommand,onLocate,onFly}:{
  assets:GameAssets;snapshot:GameSnapshot;selectedSlot:number|null;onSelect:(slot:number)=>void;
  onCommand:(command:GameCommand)=>void;onLocate:(x:number,y:number)=>void;onFly:(slot:number)=>boolean;
}){
  const windows=useWindows(),planes=snapshot.scenario.equipment.filter(e=>e.active&&e.type===8);
  const plane=planes.find(e=>e.slot===selectedSlot)??planes[0];
  const view=plane?aircraftWindowView(snapshot.scenario,snapshot.aircraftService,plane):null;
  const blocked=Boolean(snapshot.pendingTown||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
  const quote=(action:AircraftServiceAction)=>plane?checkAircraftService(snapshot.scenario,snapshot.finances,snapshot.aircraftService,plane.slot,action):null;
  const service=(action:AircraftServiceAction)=>plane&&onCommand({type:'service-aircraft',slot:plane.slot,action});
  const base=quote({kind:'fuel'}),result=snapshot.lastAircraftServiceResult;
  const failures=[...new Set((['fuel','load','repair'] as const).map(kind=>quote({kind})).flatMap(q=>q&&!q.ok?[messages[q.reason]]:[]))];
  return <GameWindow windowKey="aircraft" title="AIRPLANE">
    <section id="aircraft-panel" aria-label="Aircraft service">
      <div className="aircraft-window">
        <img src={assets.aircraftArtwork.src} width={256} height={176} alt="" draggable={false}/>
        {['Gas','Spray','Damage'].map((label,i)=><span key={label} className="aircraft-label" style={{top:41+i*48}}>{label}</span>)}
        {view?.gauges?.map((frame,i)=><span key={i} className="aircraft-gauge" role="meter" aria-label={['Fuel','Payload','Damage'][i]} aria-valuemin={0} aria-valuemax={255}
          aria-valuenow={[view.fuel,view.payload,view.damage][i]} style={{top:16+i*48,backgroundImage:`url("${assets.fieldGauges.src}")`,backgroundPosition:`-${frame*48}px 0`}}/>)}
        {AIRCRAFT_CONTROLS.map(c=>{
          const style={left:c.x,top:c.y,width:c.width,height:c.height};
          const kind=c.id===1?'fuel':c.id===7?'load':c.id===8?'repair':null;
          if(kind){const q=quote({kind}),price=view?.prices?.[kind],label=kind==='fuel'?'Refuel':kind==='load'?'Load chemicals':'Repair';
            return <button key={c.id} id={`aircraft-${kind}`} style={style} disabled={blocked||!q?.ok||!q.changed} aria-label={`${label}${price!==undefined?` · ${money(price)}`:''}`} title={`${label}${price!==undefined?` · ${money(price)}`:''}`} onClick={()=>service({kind})}/>;
          }
          const chemical=c.id===2?221:c.id===4?222:c.id===3?223:null;
          if(chemical){const q=quote({kind:'chemical',chemicalType:chemical});return <button key={c.id} data-aircraft-chemical={chemical} style={style} aria-label={names[chemical]} title={names[chemical]}
            aria-pressed={snapshot.aircraftService.selectedChemical===chemical} disabled={blocked||!q?.ok} onClick={()=>service({kind:'chemical',chemicalType:chemical})}/>;}
          return c.id===5?<button key={c.id} id="fly-aircraft" className="aircraft-caption" style={style} aria-label="Fly aircraft" disabled={blocked||!plane||Boolean(base&&!base.ok&&base.reason!=='insufficient-cash')}
            onClick={()=>{if(plane)onFly(plane.slot);}}>FLY!</button>
            :<button key={c.id} className="aircraft-caption" style={style} onClick={()=>windows.show(null)}>CLOSE</button>;
        })}
        {(['fuel','load','repair'] as const).map((kind,i)=><output key={kind} id={`aircraft-${kind}-price`} aria-label={`${kind} cost`} style={{top:44+i*55}}>{view?.prices?.[kind]??'—'}</output>)}
      </div>
      <div className="aircraft-feedback">
        {plane?<>
          {planes.length>1&&<label>Aircraft <select id="aircraft-selection" value={plane.slot} onChange={e=>onSelect(Number(e.target.value))}>
            {planes.map(e=><option key={e.slot} value={e.slot}>{e.slot} · {e.x}, {e.y}</option>)}
          </select></label>}
          <span id="aircraft-status" className="sale-accessible-detail">Fuel: {view!.fuel} / 255 · Payload: {view!.payload} / 255{view!.payload?` (${names[aircraftChemical(plane)]??'Unknown chemical'})`:''} · Wear: {Math.floor(plane.condition*100/255)}%</span>
          <button id="locate-aircraft" onClick={()=>{onLocate(plane.x,plane.y);windows.show(null);}}>Show on map</button>
          {failures.map(message=><p key={message} role="status">{message}</p>)}
          {result&&<p id="aircraft-service-result" role="status">{result.ok?result.changed?result.refund?`Payload sold for ${money(result.refund)}. Loading chemical changed.`:`Service completed for ${money(result.price)}.`:'No service was needed.':messages[result.reason]}</p>}
        </>:<p>Buy a Crop Duster from Buy → Machinery at an available airport.</p>}
        {snapshot.lastFlightStartResult&&!snapshot.lastFlightStartResult.ok&&<p id="flight-start-error" role="status">{snapshot.lastFlightStartResult.reason==='invalid-viewport'?'The map is too small to start a flight.':snapshot.lastFlightStartResult.reason==='not-parked'?'The aircraft must be parked before takeoff.':'The aircraft or its airport parking is inconsistent.'}</p>}
      </div>
    </section>
  </GameWindow>;
}
