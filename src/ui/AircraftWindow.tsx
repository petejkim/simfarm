import type { GameAssets } from '../assets/game-assets';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkAircraftService, type AircraftServiceAction } from '../simulation/aircraft';
import { aircraftWindowView } from '../simulation/aircraft-view';
import { GameWindow, useWindows } from './GameWindow';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { Sprite, spriteFace } from './chrome/Sprite';
const money=(n:number)=>`$${n.toLocaleString('en-US')}`;
const names:Record<number,string>={221:'Pesticide',222:'Herbicide',223:'Fungicide'};
/** Original AIRPLANE window (airpwndo.bmp) rebuilt from shared chrome: refuel/load/repair picture buttons
 * with price insets; the gauge inset with field-gauge sprites; chemical picture buttons; FLY!/CLOSE. */
export function AircraftWindow({assets,snapshot,selectedSlot,onCommand,onFly}:{
  assets:GameAssets;snapshot:GameSnapshot;selectedSlot:number|null;
  onCommand:(command:GameCommand)=>void;onFly:(slot:number)=>boolean;
}){
  const windows=useWindows(),planes=snapshot.scenario.equipment.filter(e=>e.active&&e.type===8);
  const plane=planes.find(e=>e.slot===selectedSlot)??planes[0];
  const view=plane?aircraftWindowView(snapshot.scenario,snapshot.aircraftService,plane):null;
  const blocked=Boolean(snapshot.pendingTown||snapshot.townEvent.pending||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
  const quote=(action:AircraftServiceAction)=>plane?checkAircraftService(snapshot.scenario,snapshot.finances,snapshot.aircraftService,plane.slot,action):null;
  const service=(action:AircraftServiceAction)=>plane&&onCommand({type:'service-aircraft',slot:plane.slot,action});
  const base=quote({kind:'fuel'});
  const art=assets.aircraftArtwork.src;
  const refill=(kind:'fuel'|'load'|'repair',faceY:number)=>{const q=quote({kind}),price=view?.prices?.[kind],label=`${kind==='fuel'?'Refuel':kind==='load'?'Load chemicals':'Repair'}${price!==undefined?` · ${money(price)}`:''}`;
    return <div className="aircraft-service" key={kind}>
      <BevelButton id={`aircraft-${kind}`} className="aircraft-picture" shadow faceStyle={spriteFace(art,24,faceY)} disabled={blocked||!q?.ok||!q.changed} aria-label={label} title={label} onClick={()=>service({kind})}/>
      <SunkenInset className="aircraft-price-box"><output id={`aircraft-${kind}-price`} aria-label={`${kind} cost`}>{price??'—'}</output></SunkenInset>
    </div>;};
  const chemicalButton=(chemical:221|222|223,faceY:number)=>{const q=quote({kind:'chemical',chemicalType:chemical});
    return <BevelButton key={chemical} data-aircraft-chemical={chemical} className="aircraft-picture" shadow faceStyle={spriteFace(art,200,faceY)} aria-label={names[chemical]} title={names[chemical]}
      pressed={snapshot.aircraftService.selectedChemical===chemical} disabled={blocked||!q?.ok} onClick={()=>service({kind:'chemical',chemicalType:chemical})}/>;};
  return <GameWindow windowKey="aircraft" title="AIRPLANE" framed>
    <section id="aircraft-panel" aria-label="Aircraft service" className="aircraft-window">
      <div className="aircraft-services">{refill('fuel',6)}{refill('load',61)}{refill('repair',116)}</div>
      <SunkenInset className="aircraft-gauges">
        {['Gas','Spray','Damage'].map((label,i)=><div key={label} className="aircraft-gauge-row">
          {view?.gauges?<Sprite className="aircraft-gauge" image={assets.fieldGauges.src} x={view.gauges[i]*48} y={0} width={48} height={24}/>:<span className="aircraft-gauge"/>}
          <span className="aircraft-label">{label}</span>
          {view&&<span className="sale-accessible-detail" role="meter" aria-label={['Fuel','Payload','Damage'][i]} aria-valuemin={0} aria-valuemax={255} aria-valuenow={[view.fuel,view.payload,view.damage][i]}/>}
        </div>)}
      </SunkenInset>
      <div className="aircraft-controls">
        {chemicalButton(221,8)}{chemicalButton(222,48)}{chemicalButton(223,88)}
        <BevelButton id="fly-aircraft" className="aircraft-caption" shadow aria-label="Fly aircraft" disabled={blocked||!plane||Boolean(base&&!base.ok&&base.reason!=='insufficient-cash')}
          onClick={()=>{if(plane)onFly(plane.slot);}}>FLY!</BevelButton>
        <BevelButton className="aircraft-caption" shadow onClick={()=>windows.close('aircraft')}>CLOSE</BevelButton>
      </div>
    </section>
  </GameWindow>;
}
