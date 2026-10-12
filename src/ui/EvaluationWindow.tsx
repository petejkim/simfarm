import {useState,type RefObject} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import {evaluationWindowView,EVALUATION_TOPICS,EVALUATION_PROBLEMS} from '../simulation/evaluation-view';
import {WEATHER_SEASONS} from '../simulation/weather-view';
import {cropBadgeTile} from '../formats/crop-slots';
import {GameWindow,useWindows} from './GameWindow';
import {BevelButton} from './chrome/BevelButton';
import {SunkenInset} from './chrome/SunkenInset';
import {TileSprite} from './chrome/TileSprite';

/** Original Evaluation (evaluate.bmp) on shared chrome: five topic rows with sunken gauges, the season,
 * the Problems and Suggested Crops panels of 2×2-tile badges, page controls and CLOSE. */
export function EvaluationWindow({assets,snapshot,tiles,focusRef}:{assets:GameAssets;snapshot:GameSnapshot;tiles:HTMLImageElement;focusRef:RefObject<HTMLElement|null>}){
  const windows=useWindows(),[selectedPage,setPage]=useState(0);
  const view=evaluationWindowView(snapshot,assets.catalog.crops),pages=Math.max(1,Math.ceil(view.suggestions.length/8)),page=Math.min(selectedPage,pages-1);
  const close=()=>{windows.close('evaluation');},palette=assets.catalog.palette;
  const tile=(id:number,key:number)=><TileSprite key={key} tile={id} atlas={tiles.src} masked={assets.maskedTiles.src}/>;
  const badge=(parts:(p:number)=>number)=><span className="evaluation-badge">{[0,1,2,3].map(p=>tile(parts(p),p))}</span>;
  return <GameWindow windowKey="evaluation" title="Evaluation" onClose={close} framed>
    <section ref={focusRef} tabIndex={-1} className="evaluation-window" aria-label="Farm evaluation">
      <div className="evaluation-top">
        <div className="evaluation-rows">
          {EVALUATION_TOPICS.map((name,i)=>{const g=view.gauges[i];return <div key={name} className="evaluation-row">
            <SunkenInset className="evaluation-topic-box"><span className="evaluation-topic">{name}</span></SunkenInset>
            <SunkenInset className="evaluation-gauge-box"><span role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={80} aria-valuenow={g.width}
              aria-valuetext={`${g.width} of 80, ${g.color===3?'problem':'growth or healthy'} indicator`} data-color={g.color} className="evaluation-gauge">
              <span style={{width:g.width,background:`rgb(${palette[g.color].join(',')})`}}/></span></SunkenInset>
          </div>;})}
          <div className="evaluation-scale"><span className="evaluation-label">Low</span><span className="evaluation-label">High</span></div>
        </div>
        <div className="evaluation-season-column">
          <SunkenInset className="evaluation-season-icon">{tile(200+view.season,0)}</SunkenInset>
          <SunkenInset className="evaluation-season-box"><span className="evaluation-season">{WEATHER_SEASONS[view.season]}</span></SunkenInset>
        </div>
      </div>
      <div className="evaluation-bottom">
        <SunkenInset className="evaluation-panel">
          <span className="evaluation-label evaluation-panel-title">Problems</span>
          <ul className="evaluation-icons" aria-label="Field problems">{view.problems.map((present,i)=>present?<li key={i} title={EVALUATION_PROBLEMS[i]}
            style={{gridColumn:Math.floor(i/2)+1,gridRow:i%2+1}}>{badge(p=>539+(16+i)*4+p)}<span className="sale-accessible-detail">{EVALUATION_PROBLEMS[i]}</span></li>:null)}</ul>
        </SunkenInset>
        <SunkenInset className="evaluation-panel">
          <span className="evaluation-label evaluation-panel-title">Suggested Crops</span>
          <ul className="evaluation-icons" aria-label="Suggested crops">{view.suggestions.slice(page*8,page*8+8).map(crop=><li key={crop.slot} data-evaluation-crop={crop.slot} title={crop.name}>
            {badge(p=>cropBadgeTile(crop.slot,p))}<span className="sale-accessible-detail">{crop.name}</span></li>)}</ul>
        </SunkenInset>
        <div className="evaluation-side">
          {pages>1&&<div className="evaluation-pages" aria-label="Suggested crop pages"><span>{page+1}/{pages}</span>
            <BevelButton className="evaluation-page" aria-label="Previous suggested crops" disabled={page===0} onClick={()=>setPage(page-1)}>Prev</BevelButton>
            <BevelButton className="evaluation-page" aria-label="Next suggested crops" disabled={page===pages-1} onClick={()=>setPage(page+1)}>Next</BevelButton></div>}
          <BevelButton className="evaluation-close" shadow onClick={close}>CLOSE</BevelButton>
        </div>
      </div>
    </section>
  </GameWindow>;
}
