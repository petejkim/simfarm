import {useEffect,useRef,useState,type RefObject} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import type {GameEvent} from '../simulation/events';
import {evaluationWindowView,EVALUATION_TOPICS,EVALUATION_PROBLEMS} from '../simulation/evaluation-view';
import {WEATHER_SEASONS} from '../simulation/weather-view';
import {drawEvaluationPreview} from '../render/evaluation-preview';
import {EVALUATION_LABELS} from '../formats/evaluation-window';
import {GameWindow,useWindows} from './GameWindow';

export function EvaluationWindow({assets,snapshot,tiles,focusRef,onEvent}:{assets:GameAssets;snapshot:GameSnapshot;tiles:CanvasImageSource;focusRef:RefObject<HTMLElement|null>;onEvent:(event:GameEvent)=>void}){
  const windows=useWindows(),canvas=useRef<HTMLCanvasElement>(null),[selectedPage,setPage]=useState(0);
  const view=evaluationWindowView(snapshot,assets.catalog.crops),pages=Math.max(1,Math.ceil(view.suggestions.length/8)),page=Math.min(selectedPage,pages-1);
  useEffect(()=>{if(canvas.current)drawEvaluationPreview(canvas.current.getContext('2d')!,tiles,assets.catalog.palette,view,page);},[assets,tiles,snapshot,page]);
  const close=()=>{onEvent({type:'sound',sound:'click'});windows.show(null);};
  return <GameWindow windowKey="evaluation" title="Evaluation" onClose={close}>
    <section ref={focusRef} tabIndex={-1} className="evaluation-window" aria-label="Farm evaluation">
      <img src={assets.evaluationArtwork.src} width={352} height={192} alt="" draggable={false}/>
      <canvas ref={canvas} width={352} height={192} className="evaluation-preview" aria-label="Original evaluation gauges and crop illustrations"/>
      {EVALUATION_LABELS.slice(0,-1).map(l=><span key={l.text} className="evaluation-label" style={{left:l.x,top:l.y,width:l.width,height:l.height}}>{l.text}</span>)}
      {EVALUATION_TOPICS.map((name,i)=><span key={name} className="evaluation-topic" style={{left:16,top:8+i*16,width:160}}>{name}</span>)}
      {view.gauges.map((g,i)=><span key={i} role="meter" aria-label={EVALUATION_TOPICS[i]} aria-valuemin={0} aria-valuemax={80} aria-valuenow={g.width}
        aria-valuetext={`${g.width} of 80, ${g.color===3?'problem':'growth or healthy'} indicator`} data-color={g.color} className="evaluation-gauge" style={{left:192,top:8+i*16,width:80,height:8}}/>)}
      <span className="evaluation-season" style={{left:288,top:40,width:48}}>{WEATHER_SEASONS[view.season]}</span>
      <ul className="evaluation-icons" aria-label="Field problems">{view.problems.map((present,i)=>present?<li key={i} style={{left:16+Math.floor(i/2)*32,top:112+i%2*32}} title={EVALUATION_PROBLEMS[i]}><span className="sale-accessible-detail">{EVALUATION_PROBLEMS[i]}</span></li>:null)}</ul>
      <ul className="evaluation-icons" aria-label="Suggested crops">{view.suggestions.slice(page*8,page*8+8).map((crop,i)=><li key={crop.slot} data-evaluation-crop={crop.slot} title={crop.name} style={{left:152+Math.floor(i/2)*32,top:112+i%2*32}}><span className="sale-accessible-detail">{crop.name}</span></li>)}</ul>
      {pages>1&&<div className="evaluation-pages" aria-label="Suggested crop pages"><span>{page+1}/{pages}</span><button aria-label="Previous suggested crops" disabled={page===0} onClick={()=>setPage(page-1)}>Prev</button><button aria-label="Next suggested crops" disabled={page===pages-1} onClick={()=>setPage(page+1)}>Next</button></div>}
      <button className="evaluation-close" onClick={close}>CLOSE</button>
    </section>
  </GameWindow>;
}
