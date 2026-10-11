import {useEffect,useState} from 'react';
import type {AboutAssets} from '../assets/game-assets';
import {ABOUT_INTRO} from '../formats/about';
import {GameWindow} from './GameWindow';

/** DSa452:400×240 at96,96; client artwork begins below the16px titlebar. */
export function AboutDialog({assets,onClose}:{assets:AboutAssets;onClose:()=>void}) {
  const [page,setPage]=useState(-1);
  useEffect(()=>{
    const timer=setTimeout(()=>setPage(value=>value+1>=assets.credits.length?-1:value+1),page===-1?8000:6000);
    return()=>clearTimeout(timer);
  },[page,assets.credits.length]);
  return <GameWindow windowKey="about" title="ABOUT" forced modal onClose={onClose}>
    <div className="about-window">
      <img src={assets.frame.src} alt="SimFarm" draggable={false}/>
      <div className="about-credits" data-credit-page={page} style={{lineHeight:page===-1?'9px':'8px'}}>
        {(page===-1?ABOUT_INTRO:assets.credits[page]).map((line,i)=><div key={i}>{line||'\u00a0'}</div>)}
      </div>
      {page===-1&&<div className="about-logo"><img src={assets.logo.src} alt="" draggable={false}/>
        <span>Leaping Lizard<br/>Software</span></div>}
    </div>
  </GameWindow>;
}
