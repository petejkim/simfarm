import { useEffect, useRef, useState, type Ref } from 'react';
import { WindowContents } from './GameWindow';
import type { GameAssets } from '../assets/game-assets';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import type { FieldRecord } from '../formats/field';
import { describeScheduleEntry } from '../formats/field-schedule';
import { SCHEDULE_ACTIONS } from '../formats/schedule-window';
import { scheduleCropHint, scheduleFieldView } from '../simulation/schedule-view';
import type { FieldPlanEdit } from '../simulation/field-plan-edit';
import { cropBadgeTile, cropPlantTile } from '../formats/crop-slots';
import { ConditionBadge } from './ConditionBadge';
import { GameWindow, useWindows } from './GameWindow';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { Sprite, spriteFace } from './chrome/Sprite';
import { TileSprite } from './chrome/TileSprite';

const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
interface Props { assets:GameAssets; snapshot:GameSnapshot; tiles:HTMLImageElement; field?:FieldRecord;
  inspection:{month:number}|null; focusRef:Ref<HTMLElement>; onCommand:(command:GameCommand)=>void }
export function ScheduleWindow(props: Parameters<typeof ScheduleWindowBody>[0]) {
  return <WindowContents windowKey="schedule"><ScheduleWindowBody {...props} /></WindowContents>;
}
function ScheduleWindowBody(props:Props){
  return <GameWindow windowKey="schedule" title="Schedule" framed>
    <ScheduleEditor key={`${props.field?.slot}-${props.snapshot.scenario.farm.calendar.year}`} {...props}/>
  </GameWindow>;
}
function ScheduleEditor({assets,snapshot,tiles,field,inspection,focusRef,onCommand}:Props){
  const windows=useWindows(),scenario=snapshot.scenario,calendar=scenario.farm.calendar,now=calendar.month*4+calendar.week;
  const [month,setMonth]=useState(calendar.month),[action,setAction]=useState<FieldPlanEdit>({kind:'plant',cropSlot:0});
  // View object38c52..38c5a assigns the current month on every field entry,
  // even when the same field is reopened. Merely raising the window does not.
  const previousInspection=useRef(inspection);
  useEffect(()=>{
    if(previousInspection.current!==inspection&&inspection)setMonth(inspection.month);
    previousInspection.current=inspection;
  },[inspection]);
  // CUT selects an erase gesture; the original leaves the previous tool badge in place.
  const [badge,setBadge]=useState<FieldPlanEdit>({kind:'plant',cropSlot:0});
  function chooseAction(next:FieldPlanEdit){setAction(next);if(next.kind!=='clear')setBadge(next);}
  const [overlay,setOverlay]=useState<'water'|'temperature'|null>(null);
  const crop=(slot:number)=>assets.catalog.crops.find(c=>`${c.id}.crp`===scenario.cropFiles[slot])!;
  const view=field?scheduleFieldView(scenario,field,crop(field.cropSlot),month):null;
  const weeks=Array.from({length:12},(_,i)=>month*4+i);
  const blocked=Boolean(snapshot.pendingTown||snapshot.townEvent.pending||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
  const date=(row:number)=>`${months[Math.floor(row%48/4)]} ${(row%4)*7+1}–${(row%4+1)*7}, ${(calendar.year+Math.floor(row/48))&65535}`;
  function description(row:number){
    if(!field)return 'No field selected';
    const entry=describeScheduleEntry(scenario.schedule.get(row,field.slot-1),scenario.cropFiles.length);
    switch(entry.kind){
      case 'plant':return `Plant ${crop(entry.cropSlot).name}`;
      case 'crop-stage':return `${crop(entry.cropSlot).name} growing`;
      case 'harvest':case 'alternate-harvest':return 'Harvest';
      case 'fallow':return 'Fallow';case 'contract':return 'Price contract';case 'plow':return 'Plow';
      case 'unknown':return 'Unrecognized entry';
      default:return SCHEDULE_ACTIONS.find(a=>a.kind===entry.kind)!.label;
    }
  }
  const tool=action.kind==='plant'?`Plant ${crop(action.cropSlot).name}`:action.kind==='clear'?'Clear remaining plan':SCHEDULE_ACTIONS.find(a=>a.kind===action.kind)!.label;
  const art=assets.scheduleArtwork.src;
  // Schedule 2d2b2 draws tiles 849..1047 from the masked atlas (848 itself from the farm atlas).
  // Plain render helpers (not components): defining components here would remount every tile on each render.
  const tile=(code:number,key?:number)=><TileSprite key={key} tile={code} atlas={tiles.src} masked={assets.maskedTiles.src} maskStart={849}/>;
  const badgeOf=(parts:number[])=><span className="schedule-badge">{parts.map((t,i)=>tile(t,i))}</span>;
  const toolBadge=badge.kind==='plant'?[0,1,2,3].map(i=>cropBadgeTile(badge.cropSlot,i))
    :(()=>{const a=SCHEDULE_ACTIONS.find(x=>x.kind===badge.kind);return a?[0,1,2,3].map(i=>539+a.badge*4+i):[];})();
  const weatherButton=(kind:'water'|'temperature')=><BevelButton className={`schedule-weather schedule-weather-${kind}`}
    title={kind==='water'?'Water requirements and rainfall':'Heat requirements and temperature'} aria-label={kind==='water'?'Water overlay':'Temperature overlay'} pressed={overlay===kind}
    faceStyle={spriteFace(art,kind==='water'?83:239,16)} onClick={()=>setOverlay(overlay===kind?null:kind)}/>;
  const gauges=[{label:'Disease',x:24},{label:'Pests',x:80},{label:'Weeds',x:136},{label:'Water',x:216},{label:'Soil',x:272}];
  // The 56×32 dial rim comes from the window bitmap (source x-8, 168); field-gauge frames cover only its
  // inner 48×24, at offset 8,8. With no field the bitmap dial (and its resting needle) shows alone.
  const gauge=(i:number)=><span className="schedule-gauge">
    <Sprite image={art} x={gauges[i].x-8} y={168} width={56} height={32}/>
    {view&&<Sprite className="schedule-gauge-frame" image={assets.fieldGauges.src} x={view.gauges[i]*48} y={0} width={48} height={24}/>}
  </span>;
  const labelled=(i:number)=><span key={i} className="schedule-gauge-cell">{gauge(i)}<span className="schedule-label">{gauges[i].label}</span></span>;
  return <section id="field-planner" ref={focusRef} tabIndex={-1} aria-label={field?`Field ${field.number} schedule`:'Field schedule'}>
    <div className="schedule-window">
      <span className="schedule-crop-name sale-accessible-detail">{field?crop(field.cropSlot).name:''}</span>
      <span className="sale-accessible-detail" id="schedule-tool">{tool}</span>
      <div className="schedule-top">
        <div className="schedule-badge-column"><SunkenInset className="schedule-badge-box">{field&&badgeOf([0,1,2,3].map(i=>cropBadgeTile(field.cropSlot,i)))}</SunkenInset><span className="schedule-label">Crop</span></div>
        {weatherButton('water')}
        <SunkenInset className="schedule-crops">
          {scenario.cropFiles.map((_,slot)=>{return <button key={slot} type="button" data-plan-crop={slot}
            className="schedule-icon" aria-label={`Plant ${crop(slot).name}`} title={`Plant ${crop(slot).name}`}
            aria-pressed={action.kind==='plant'&&action.cropSlot===slot} onClick={()=>chooseAction({kind:'plant',cropSlot:slot})}>
            {tile(cropPlantTile(slot))}
            {overlay&&<span className="schedule-weather-number" style={{marginTop:2+slot%2*6}}>{scheduleCropHint(crop(slot),overlay)}</span>}
          </button>;})}
        </SunkenInset>
        {weatherButton('temperature')}
        <div className="schedule-badge-column"><SunkenInset className="schedule-badge-box">{badgeOf(toolBadge)}</SunkenInset><span className="schedule-label">Tool</span></div>
      </div>
      <div className="schedule-months">{[0,1,2].map(i=><SunkenInset key={i} className="schedule-month">{months[(month+i)%12].slice(0,3)}</SunkenInset>)}</div>
      <div className="schedule-middle">
        <SunkenInset className="schedule-actions">
          {SCHEDULE_ACTIONS.map(a=><button key={a.kind} type="button" data-plan-action={a.kind} className="schedule-icon"
            aria-label={a.label} title={a.label} aria-pressed={action.kind===a.kind} onClick={()=>chooseAction({kind:a.kind})}>{tile(a.tile)}</button>)}
        </SunkenInset>
        <div className="schedule-center">
          <div className="schedule-strip">
            <Sprite className="schedule-ruler" image={art} x={72} y={62} width={192} height={9}/>
            <div className="plan-calendar" aria-label="Twelve-week field plan">
              {weeks.map((row,i)=><button key={row} type="button" data-plan-week={row} className="schedule-icon" disabled={!field||blocked}
                aria-label={`${date(row)}: ${description(row)}`} title={`${date(row)}: ${description(row)}`} aria-current={row===now?'date':undefined}
                onClick={()=>{if(field)onCommand({type:'edit-field-plan',fieldSlot:field.slot,week:row,action});}}>
                {field&&tile(scenario.schedule.get(row,field.slot-1))}
                {field&&row===now&&<span className="schedule-now" aria-hidden="true"/>}
                {overlay&&<span className="schedule-weather-number" style={{marginTop:2+i%2*6}}>{scenario.climate[overlay==='water'?'precipitation':'temperature'][row]}</span>}
              </button>)}
            </div>
            <div className="schedule-scroll">
              <BevelButton className="schedule-scroll-button" aria-label="Previous month" faceStyle={spriteFace(art,75,91)} disabled={month===0} onClick={()=>setMonth(month-1)}/>
              <span className="schedule-track" style={spriteFace(art,88,88)}>
                <span className="schedule-thumb" style={{marginLeft:Math.floor(month/6)*16}}>{tile(194)}</span>
                <input id="schedule-month" type="range" min={0} max={57} value={month} aria-label="First displayed month" aria-valuetext={`${months[month%12]} ${(calendar.year+Math.floor(month/12))&65535}`} onChange={e=>setMonth(Number(e.target.value))}/>
              </span>
              <BevelButton className="schedule-scroll-button" aria-label="Next month" faceStyle={spriteFace(art,251,91)} disabled={month===57} onClick={()=>setMonth(month+1)}/>
            </div>
          </div>
          <SunkenInset className="schedule-season-box">{view&&<span className="schedule-season">{view.season} {view.year}</span>}</SunkenInset>
        </div>
        <div className="schedule-buttons">
          <BevelButton className="schedule-caption" onClick={()=>setMonth(calendar.month)}>TODAY</BevelButton>
          <BevelButton className="schedule-caption" aria-label="Clear remaining plan" title="Choose CUT, then the first week to clear" pressed={action.kind==='clear'} onClick={()=>chooseAction({kind:'clear'})}>CUT</BevelButton>
          {/* Native RESET (user request): returns this field's future plan to its crop's default plan in one press. */}
          <BevelButton id="schedule-reset" className="schedule-caption" aria-label="Reset plan" title="Reset the rest of this field's plan to its crop's normal growth, with no orders added"
            disabled={!field||blocked} onClick={()=>{if(field)onCommand({type:'reset-field-plan',fieldSlot:field.slot});}}>RESET</BevelButton>
          <BevelButton className="schedule-caption schedule-close" onClick={()=>windows.close('schedule')}>CLOSE</BevelButton>
        </div>
      </div>
      <div className="schedule-panels">
        <SunkenInset className="schedule-panel schedule-panel-field">
          <div className="schedule-readout-row"><span className="schedule-label">CurrentValue</span><SunkenInset className="schedule-readout"><output id="schedule-value">{view?.value??''}</output></SunkenInset></div>
          <div className="schedule-readout-row"><span className="schedule-label">Maturity</span><SunkenInset className="schedule-readout schedule-maturity">
            {view&&<span role="meter" aria-label="Crop maturity" aria-valuemin={0} aria-valuemax={80} aria-valuenow={view.maturityPixels} className="schedule-maturity-bar"><span style={{width:view.maturityPixels}}/></span>}
          </SunkenInset></div>
          <div className="schedule-gauges">{[0,1,2].map(labelled)}</div>
        </SunkenInset>
        <SunkenInset className="schedule-panel schedule-panel-crop">
          <div className="schedule-quality-row"><span className="schedule-quality-labels"><span className="schedule-label">Crop</span><span className="schedule-label">Quality</span></span>
            <SunkenInset className="schedule-badge-box">{view&&<ConditionBadge className="schedule-quality" quality={view.quality} artwork={assets.sellCondition} label={`Crop quality: ${['Bad','Poor','Fair','High'][view.quality]}`}/>}</SunkenInset></div>
          <div className="schedule-gauges">{[3,4].map(labelled)}</div>
        </SunkenInset>
      </div>
    </div>
  </section>;
}
