import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { GameAssets } from '../assets/game-assets';
import { MAP_BUTTONS, MAP_MODES, type MapMode } from '../formats/map-window';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { quoteLand } from '../simulation/land';
import { paintTerrainPreview } from '../render/terrain-preview';
import { renderOverview, renderOverviewLegend } from '../render/overview-map';
import { GameWindow, useWindows } from './GameWindow';

export function MapWindow({ assets, snapshot, onCommand, viewportRef, zoom, onLocate }: {
  assets: GameAssets; snapshot: GameSnapshot; onCommand: (command: GameCommand) => void;
  viewportRef: RefObject<HTMLDivElement | null>; zoom: number; onLocate: (x:number,y:number)=>void;
}) {
  const {active,order,close}=useWindows(),canvas=useRef<HTMLCanvasElement>(null);
  const legend=useRef<HTMLCanvasElement>(null);
  const [mode,setMode]=useState<MapMode>(0),[selected,setSelected]=useState({x:0,y:0}),[help,setHelp]=useState(false);
  const [view,setView]=useState({x:0,y:0,width:40,height:32});
  const [transaction,setTransaction]=useState<'buy'|'sell'|null>(null);
  const quote=quoteLand(snapshot.scenario,selected.x,selected.y,snapshot.weather.soilMoisture)!;
  useLayoutEffect(()=>{
    if(!order.includes('map'))return;
    paintTerrainPreview(canvas.current!,renderOverview(snapshot.scenario,assets.miniature,assets.catalog.palette,mode,snapshot.weather.soilMoisture,selected));
    if(legend.current)paintTerrainPreview(legend.current,renderOverviewLegend(assets.miniature));
  },[order,snapshot,assets,mode,selected]);
  useLayoutEffect(()=>{
    const el=viewportRef.current;if(!el)return;
    const update=()=>setView({x:el.scrollLeft/(8*zoom),y:el.scrollTop/(8*zoom),width:el.clientWidth/(8*zoom),height:el.clientHeight/(8*zoom)});
    update();el.addEventListener('scroll',update);const observer=new ResizeObserver(update);observer.observe(el);
    return()=>{el.removeEventListener('scroll',update);observer.disconnect();};
  },[viewportRef,zoom,active]);
  function point(event: PointerEvent<HTMLCanvasElement>){
    const rect=event.currentTarget.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)/2),y=Math.floor((event.clientY-rect.top)/2);
    if(x<0||x>=96||y<0||y>=96)return;
    if(mode===1){setSelected({x:x>>3,y:y>>3});setTransaction(null);}else onLocate(x,y);
  }
  const result=transaction==='buy'?snapshot.lastLandResult:transaction==='sell'?snapshot.lastLandSaleResult:null;
  const reason=result&&!result.ok?result.reason:null;
  const message=result?.ok?`${transaction==='buy'?'Bought':'Sold'} plot at ${result.regionX*8}, ${result.regionY*8} for $${result.price.toLocaleString('en-US')}.`
    :reason==='home-plot'?'You cannot sell your home plot.':reason==='field-on-plot'?'Remove the fields on this plot before selling it.'
    :reason?'This plot cannot be traded.':'';
  return <GameWindow windowKey="map" title="Map">
    <section className="overview-window" aria-label="Farm overview">
      <img src={assets.mapArtwork.src} width={288} height={240} alt="" />
      {MAP_BUTTONS.map(b=><button key={b.mode} className="overview-mode" style={{left:b.x,top:b.y}} aria-label={MAP_MODES[b.mode]}
        title={MAP_MODES[b.mode]} aria-pressed={mode===b.mode} onClick={()=>{setMode(mode===b.mode?0:b.mode);setHelp(false);setTransaction(null);}} />)}
      <button className="overview-help-button" aria-label="Map help" aria-pressed={help} onClick={()=>setHelp(!help)}>?</button>
      <span className="overview-land-label">Land<br/>Value</span><output className="overview-land-value" aria-label="Land value">{quote.price}</output>
      <div className="overview-viewport">
        <canvas ref={canvas} width={192} height={192} tabIndex={0} aria-label={mode===1?'Property map. Click a plot, or use arrow keys to select land.':'Overview map. Click or drag to move the Edit view.'}
          onPointerDown={e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);point(e);}}
          onPointerMove={e=>{if(e.buttons===1&&e.currentTarget.hasPointerCapture(e.pointerId))point(e);}}
          onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onKeyDown={e=>{const offset=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[e.key];if(!offset)return;
            e.preventDefault();if(mode===1){setSelected(p=>({x:Math.max(0,Math.min(11,p.x+offset[0])),y:Math.max(0,Math.min(11,p.y+offset[1]))}));setTransaction(null);}
            else onLocate(Math.max(0,Math.min(95,view.x/2+offset[0])),Math.max(0,Math.min(95,view.y/2+offset[1])));}} />
        <div className="overview-edit-outline" style={{left:view.x,top:view.y,width:view.width,height:view.height}} />
        {help&&<div className="overview-help" role="note" aria-label="Map legend">{['PROPERTY','WEEDS','TOXICITY','WATER','NUTRIENTS','FIELD PROFIT','DISEASE','PESTS'].map((s,i)=><span key={s} style={{top:4+Math.floor(i/2)*30+i%2*10,left:16}}>{s}</span>)}</div>}
      </div>
      {mode>1&&<><span className="overview-low">Low</span><span className="overview-high">High</span><canvas ref={legend} width={64} height={8} className="overview-gradient" aria-hidden="true" /></>}
      <span className="overview-mode-name" style={{top:mode>1?222:216}}>{MAP_MODES[mode]}</span>
      {mode===1&&quote.ownership<=1&&<button id="map-land-action" className="overview-trade" disabled={quote.ownership===0&&(quote.price>snapshot.scenario.farm.cash||quote.price===0)}
        onClick={()=>{const sell=quote.ownership===1;setTransaction(sell?'sell':'buy');onCommand({type:sell?'sell-land':'buy-land',regionX:selected.x,regionY:selected.y});}}>{quote.ownership===1?'SELL':'BUY'}</button>}
      <button className="overview-close" onClick={()=>close('map')}>CLOSE</button>
    </section>
    <div className="overview-feedback"><span className="sale-accessible-detail" id="map-land-selection">Plot at {selected.x*8}, {selected.y*8}: {quote.ownership===1?'Owned by you':quote.ownership?'Not for sale':'For sale'}</span>
      {mode===1&&quote.ownership===0&&quote.price>snapshot.scenario.farm.cash&&<p>There is not enough cash to buy this plot.</p>}
      {message&&<p role="status" id="map-land-result">{message}</p>}</div>
  </GameWindow>;
}
