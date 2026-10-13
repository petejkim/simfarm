import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { GameAssets } from '../assets/game-assets';
import { MAP_BUTTONS, MAP_MODES, type MapMode } from '../formats/map-window';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { quoteLandSale } from '../simulation/land';
import { paintTerrainPreview } from '../render/terrain-preview';
import { renderOverview, renderOverviewLegend } from '../render/overview-map';
import { GameWindow, useWindows } from './GameWindow';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { spriteFace } from './chrome/Sprite';

export function MapWindow({ assets, snapshot, onCommand, viewportRef, zoom, onLocate }: {
  assets: GameAssets; snapshot: GameSnapshot; onCommand: (command: GameCommand) => void;
  viewportRef: RefObject<HTMLDivElement | null>; zoom: number; onLocate: (x:number,y:number)=>void;
}) {
  const {active,order,close}=useWindows(),canvas=useRef<HTMLCanvasElement>(null);
  const legend=useRef<HTMLCanvasElement>(null);
  const [mode,setMode]=useState<MapMode>(0),[selected,setSelected]=useState({x:0,y:0}),[help,setHelp]=useState(false);
  const [view,setView]=useState({x:0,y:0,width:40,height:32});
  // Owned plots show what SELL pays (SF-158 sale quote); other plots show the purchase quote.
  const quote=quoteLandSale(snapshot.scenario,selected.x,selected.y,snapshot.weather.soilMoisture)!;
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
    if(mode===1){setSelected({x:x>>3,y:y>>3});}else onLocate(x,y);
  }
  const art=assets.mapArtwork.src;
  return <GameWindow windowKey="map" title="Map" framed>
    <section className="overview-window" aria-label="Farm overview">
      <div className="overview-main">
        <div className="overview-side">
          <div className="overview-modes">
            {MAP_BUTTONS.map(b=><BevelButton key={b.mode} className="overview-mode" aria-label={MAP_MODES[b.mode]} title={MAP_MODES[b.mode]} pressed={mode===b.mode}
              faceStyle={spriteFace(art,b.x+3,b.y+3)} onClick={()=>{setMode(mode===b.mode?0:b.mode);setHelp(false);}} />)}
          </div>
          <BevelButton className="overview-help-button" aria-label="Map help" pressed={help} onClick={()=>setHelp(!help)}>?</BevelButton>
          <span className="overview-land-label">Land<br/>Value</span>
          <SunkenInset className="overview-land-box"><output className="overview-land-value" aria-label="Land value">{quote.price}</output></SunkenInset>
        </div>
        <SunkenInset className="overview-map-box">
          <div className="overview-viewport">
            <canvas ref={canvas} width={192} height={192} tabIndex={0} aria-label={mode===1?'Property map. Click a plot, or use arrow keys to select land.':'Overview map. Click or drag to move the Edit view.'}
              onPointerDown={e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);point(e);}}
              onPointerMove={e=>{if(e.buttons===1&&e.currentTarget.hasPointerCapture(e.pointerId))point(e);}}
              onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
              onKeyDown={e=>{const offset=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[e.key];if(!offset)return;
                e.preventDefault();if(mode===1){setSelected(p=>({x:Math.max(0,Math.min(11,p.x+offset[0])),y:Math.max(0,Math.min(11,p.y+offset[1]))}));}
                else onLocate(Math.max(0,Math.min(95,view.x/2+offset[0])),Math.max(0,Math.min(95,view.y/2+offset[1])));}} />
            {/* Layered in the same grid cell as the map: the Edit view outline and the help legend. */}
            <div className="overview-edit-outline" style={{marginLeft:view.x,marginTop:view.y,width:view.width,height:view.height}} />
            {help&&<div className="overview-help" role="note" aria-label="Map legend">{['PROPERTY','WEEDS','TOXICITY','WATER','NUTRIENTS','FIELD PROFIT','DISEASE','PESTS'].map(label=><span key={label}>{label}</span>)}</div>}
          </div>
        </SunkenInset>
      </div>
      <div className="overview-footer">
        <div className="overview-legend">
          {mode>1&&<div className="overview-scale"><span>Low</span><canvas ref={legend} width={64} height={8} className="overview-gradient" aria-hidden="true" /><span>High</span></div>}
          <span className="overview-mode-name">{MAP_MODES[mode]}</span>
        </div>
        {mode===1&&quote.ownership<=1&&<BevelButton id="map-land-action" className="overview-trade" disabled={quote.ownership===0&&(quote.price>snapshot.scenario.farm.cash||quote.price===0)}
          onClick={()=>{const sell=quote.ownership===1;onCommand({type:sell?'sell-land':'buy-land',regionX:selected.x,regionY:selected.y});}}>{quote.ownership===1?'SELL':'BUY'}</BevelButton>}
        <BevelButton className="overview-close" onClick={()=>close('map')}>CLOSE</BevelButton>
      </div>
    </section>
  </GameWindow>;
}
