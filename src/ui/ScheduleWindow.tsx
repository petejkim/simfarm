import { useEffect, useRef, useState, type Ref } from 'react';
import type { GameAssets } from '../assets/game-assets';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import type { FieldRecord } from '../formats/field';
import { describeScheduleEntry } from '../formats/field-schedule';
import { SCHEDULE_ACTIONS } from '../formats/schedule-window';
import { scheduleCropHint, scheduleFieldView } from '../simulation/schedule-view';
import type { FieldPlanEdit } from '../simulation/field-plan-edit';
import { drawSchedulePreview } from '../render/schedule-preview';
import { GameWindow, useWindows } from './GameWindow';

const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const failures:Record<string,string>={
  'invalid-field':'This field is unavailable.', 'invalid-week':'Choose a week in the five-year plan.',
  'invalid-action':'Choose a planning action.', 'invalid-crop':'This crop cannot be scheduled.',
  'future-week-required':'Choose a future week.', 'contract-current-week':'Choose the current week to lock the crop price.',
  'not-growing':'A growing crop is needed to lock a price.', 'already-contracted':'This crop already has a price contract.',
  'protected-order':'That week already has planting, harvest or a contract. Choose another week.',
  'fixed-harvest-week':'This crop has a fixed annual harvest week.',
};
interface Props { assets:GameAssets; snapshot:GameSnapshot; tiles:CanvasImageSource; field?:FieldRecord;
  focusRef:Ref<HTMLElement>; onSelect:(slot:number|null)=>void; onNewField:()=>void; onCommand:(command:GameCommand)=>void }
export function ScheduleWindow(props:Props){
  return <GameWindow windowKey="schedule" title="Schedule">
    <ScheduleEditor key={`${props.field?.slot}-${props.snapshot.scenario.farm.calendar.year}`} {...props}/>
  </GameWindow>;
}
function ScheduleEditor({assets,snapshot,tiles,field,focusRef,onSelect,onNewField,onCommand}:Props){
  const windows=useWindows(),scenario=snapshot.scenario,calendar=scenario.farm.calendar,now=calendar.month*4+calendar.week;
  const [month,setMonth]=useState(calendar.month),[cropPage,setCropPage]=useState(0),[action,setAction]=useState<FieldPlanEdit>({kind:'plant',cropSlot:0});
  // CUT selects an erase gesture; the original leaves the previous tool badge in place.
  const [badge,setBadge]=useState<FieldPlanEdit>({kind:'plant',cropSlot:0});
  function chooseAction(next:FieldPlanEdit){setAction(next);if(next.kind!=='clear')setBadge(next);}
  const [overlay,setOverlay]=useState<'water'|'temperature'|null>(null),[week,setWeek]=useState(now+1);
  const canvas=useRef<HTMLCanvasElement>(null),crop=(slot:number)=>assets.catalog.crops.find(c=>`${c.id}.crp`===scenario.cropFiles[slot])!;
  const view=field?scheduleFieldView(scenario,field,crop(field.cropSlot),month):null;
  const weeks=Array.from({length:12},(_,i)=>month*4+i),fields=scenario.fields.filter(f=>f.active);
  const blocked=Boolean(snapshot.pendingTown||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
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
  useEffect(()=>{if(canvas.current)drawSchedulePreview(canvas.current.getContext('2d')!,tiles,assets.maskedTiles,assets.fieldGauges,
    {cropPage,cropCount:scenario.cropFiles.length,action:badge,month,now,field:field&&view?{...view,cropSlot:field.cropSlot,weeks:weeks.map(w=>scenario.schedule.get(w,field.slot-1))}:undefined},assets.catalog.palette);
  },[assets,tiles,snapshot,field,cropPage,badge,month]);
  const result=snapshot.lastPlanEditResult?.fieldSlot===field?.slot?snapshot.lastPlanEditResult:null;
  const tool=action.kind==='plant'?`Plant ${crop(action.cropSlot).name}`:action.kind==='clear'?'Clear remaining plan':SCHEDULE_ACTIONS.find(a=>a.kind===action.kind)!.label;
  return <section id="field-planner" ref={focusRef} tabIndex={-1} aria-label={field?`Field ${field.number} schedule`:'Field schedule'}>
    <div className="schedule-window">
      <img src={assets.scheduleArtwork.src} width={336} height={224} alt="" draggable={false}/>
      <canvas ref={canvas} className="schedule-preview" width={336} height={224} aria-label="Field and schedule graphics"/>
      <span className="schedule-label" style={{left:30,top:42,width:36}}>Crop</span>
      <span className="schedule-label" style={{left:272,top:42,width:32}}>Tool</span>
      <span className="schedule-crop-name sale-accessible-detail">{field?crop(field.cropSlot).name:''}</span>
      <span className="sale-accessible-detail" id="schedule-tool">{tool}</span>
      {(['water','temperature'] as const).map((kind,i)=><button key={kind} className="schedule-weather" style={{left:i?236:82,top:13,width:18,height:23}}
        title={kind==='water'?'Water requirements and rainfall':'Heat requirements and temperature'} aria-label={kind==='water'?'Water overlay':'Temperature overlay'} aria-pressed={overlay===kind}
        onClick={()=>setOverlay(overlay===kind?null:kind)}/>)}
      {scenario.cropFiles.slice(cropPage*16,cropPage*16+16).map((_,i)=>{const slot=cropPage*16+i;return <button key={slot} data-plan-crop={slot}
        className="schedule-icon" style={{left:104+i%8*16,top:8+Math.floor(i/8)*16}} aria-label={`Plant ${crop(slot).name}`} title={`Plant ${crop(slot).name}`}
        aria-pressed={action.kind==='plant'&&action.cropSlot===slot} onClick={()=>chooseAction({kind:'plant',cropSlot:slot})}>
        {overlay&&<span className="schedule-weather-number" style={{top:2+i%2*6}}>{scheduleCropHint(crop(slot),overlay)}</span>}
      </button>;})}
      <button className="schedule-page" style={{top:8}} aria-label="Previous crops" disabled={cropPage===0} onClick={()=>setCropPage(cropPage-1)}>‹</button>
      <button className="schedule-page" style={{top:24}} aria-label="Next crops" disabled={(cropPage+1)*16>=scenario.cropFiles.length} onClick={()=>setCropPage(cropPage+1)}>›</button>
      {SCHEDULE_ACTIONS.map((a,i)=><button key={a.kind} data-plan-action={a.kind} className="schedule-icon" style={{left:24+i%2*16,top:64+Math.floor(i/2)*16}}
        aria-label={a.label} title={a.label} aria-pressed={action.kind===a.kind} onClick={()=>chooseAction({kind:a.kind})}/>)}
      {[0,1,2].map(i=><span key={i} className="schedule-month" style={{left:96+i*64}}>{months[(month+i)%12].slice(0,3)}</span>)}
      <div className="plan-calendar" aria-label="Twelve-week field plan">
        {weeks.map((row,i)=><button key={row} data-plan-week={row} className="schedule-icon" style={{left:72+i*16,top:72}} disabled={!field||blocked}
          aria-label={`${date(row)}: ${description(row)}`} title={`${date(row)}: ${description(row)}`} aria-current={row===now?'date':undefined}
          onFocus={()=>setWeek(row)} onMouseEnter={()=>setWeek(row)} onClick={()=>{setWeek(row);if(field)onCommand({type:'edit-field-plan',fieldSlot:field.slot,week:row,action});}}>
          {overlay&&<span className="schedule-weather-number" style={{top:2+i%2*6}}>{scenario.climate[overlay==='water'?'precipitation':'temperature'][row]}</span>}
        </button>)}
      </div>
      <button style={{left:72,top:88,width:16,height:16}} aria-label="Previous month" disabled={month===0} onClick={()=>setMonth(month-1)}/>
      <input id="schedule-month" type="range" min={0} max={57} value={month} aria-label="First displayed month" aria-valuetext={`${months[month%12]} ${(calendar.year+Math.floor(month/12))&65535}`} onChange={e=>setMonth(Number(e.target.value))}/>
      <button style={{left:248,top:88,width:16,height:16}} aria-label="Next month" disabled={month===57} onClick={()=>setMonth(month+1)}/>
      <button className="schedule-caption" style={{top:61}} onClick={()=>setMonth(calendar.month)}>TODAY</button>
      <button className="schedule-caption" style={{top:77}} aria-label="Clear remaining plan" title="Choose CUT, then the first week to clear" aria-pressed={action.kind==='clear'} onClick={()=>chooseAction({kind:'clear'})}>CUT</button>
      <button className="schedule-caption" style={{top:101}} onClick={()=>windows.show(null)}>CLOSE</button>
      {view&&<>
        <span className="schedule-season">{view.season} {view.year}</span>
        <output id="schedule-value">{view.value}</output>
        <span role="meter" aria-label="Crop maturity" aria-valuemin={0} aria-valuemax={80} aria-valuenow={view.maturityPixels} className="sale-accessible-detail"/>
        <span className="schedule-quality" aria-label={`Crop quality: ${['Bad','Poor','Fair','High'][view.quality]}`} style={{backgroundImage:`url("${assets.sellConditions.src}")`,backgroundPosition:`-${view.quality*32}px 0`}}>
          <span className="condition-letter">{['X','C','B','A'][view.quality]}</span><span className="condition-word">{['BAD','POOR','FAIR','HIGH'][view.quality]}</span>
        </span>
      </>}
      {[['CurrentValue',10,130,92],['Maturity',42,145,60],['Crop',216,130,36],['Quality',204,145,58],
        ['Disease',18,200,50],['Pests',78,200,42],['Weeds',132,200,44],['Water',218,200,40],['Soil',276,200,32]].map(([label,left,top,width])=><span key={label} className="schedule-label" style={{left:Number(left),top:Number(top),width:Number(width)}}>{label}</span>)}
    </div>
    <div className="schedule-feedback">
      {fields.length?<label>Field <select id="planner-field" value={field?.slot??''} onChange={e=>onSelect(e.target.value?Number(e.target.value):null)}>
        <option value="">Choose a field…</option>{fields.map(f=><option key={f.slot} value={f.slot}>Field {f.number} · {crop(f.cropSlot).name}</option>)}
      </select></label>:<><p>This farm has no fields yet. Create and plant a field to start planning.</p><button onClick={onNewField}>Create a field</button></>}
      {field&&<><p id="plan-selection">{date(week)} · {description(week)}</p><p>Tool: {tool} · click a week to apply</p></>}
      {result&&<p id="plan-result" role="status">{result.ok?`Plan updated for ${date(result.week)}.`:failures[result.reason]}</p>}
    </div>
  </section>;
}
