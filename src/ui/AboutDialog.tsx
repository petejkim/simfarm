import {useEffect,useState} from 'react';
import type {AboutAssets} from '../assets/game-assets';
import {ABOUT_INTRO} from '../formats/about';
import {GameWindow} from './GameWindow';
import {RaisedPanel} from './chrome/RaisedPanel';
import {Sprite} from './chrome/Sprite';

/** DSa452: 400×240 at 96,96. The common frame around a 384×216 client: the bitmap SIMFARM ribbon
 * (kept as artwork by request), a raised credits panel with the apple sprite over its left edge, the
 * credit text and, on the first page, the Leaping Lizard logo. */
export function AboutDialog({assets,onClose}:{assets:AboutAssets;onClose:()=>void}) {
  const [page,setPage]=useState(-1);
  useEffect(()=>{
    const timer=setTimeout(()=>setPage(value=>value+1>=assets.credits.length?-1:value+1),page===-1?8000:6000);
    return()=>clearTimeout(timer);
  },[page,assets.credits.length]);
  const art=assets.frame.src;
  return <GameWindow windowKey="about" title="ABOUT" forced modal framed onClose={onClose}>
    <div className="about-window">
      <Sprite className="about-ribbon" image={art} x={66} y={1} width={268} height={59} label="SimFarm"/>
      <div className="about-stack">
        <RaisedPanel className="about-panel" faceClassName="about-panel-face" shadow>
          <div className="about-credits" data-credit-page={page} style={{lineHeight:page===-1?'9px':'8px'}}>
            {(page===-1?ABOUT_INTRO:assets.credits[page]).map((line,i)=><div key={i}>{line||' '}</div>)}
          </div>
          {page===-1&&<div className="about-logo"><img src={assets.logo.src} alt="" draggable={false}/>
            <span>Leaping Lizard<br/>Software</span></div>}
        </RaisedPanel>
        <Sprite className="about-apples" image={art} x={23} y={75} width={120} height={90}/>
      </div>
      <p className="about-footer">An unofficial fan remake of the original game by Maxis &amp; Eric Albers.<br/>
        <a href="https://github.com/petejkim/simfarm"  target="_blank" rel="noopener noreferrer">Source code (CC0 1.0 Universal)</a></p>
    </div>
  </GameWindow>;
}
