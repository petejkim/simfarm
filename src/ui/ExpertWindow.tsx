import { useEffect,useMemo,useRef,useState,type RefObject } from 'react';
import { assetUrl,type GameAssets } from '../assets/game-assets';
import { expertPage,EXPERT_CAP_TEXT } from '../formats/expert-cards';
import { drawExpertArtwork } from '../render/expert-artwork';
import type { GameEvent } from '../simulation/events';
import { GameWindow,useWindows } from './GameWindow';

const topics:Record<number,string>={2:'Field icons',10:'Crops',26:'Sprays',30:'Machinery',40:'Structures',5:'Livestock'};
export function ExpertWindow({assets,cropFiles,tiles,focusRef,onEvent}:{assets:GameAssets;cropFiles:readonly string[];tiles:CanvasImageSource;focusRef:RefObject<HTMLElement|null>;onEvent:(event:GameEvent)=>void}){
  const windows=useWindows(),[pageId,setPageId]=useState(1),canvas=useRef<HTMLCanvasElement>(null);
  const page=useMemo(()=>expertPage(assets.expertDeck,pageId,cropFiles.length),[assets.expertDeck,pageId,cropFiles.length]);
  const crop=(slot:number)=>assets.catalog.crops.find(c=>`${c.id}.crp`===cropFiles[slot])!;
  useEffect(()=>{if(canvas.current)drawExpertArtwork(canvas.current.getContext('2d')!,assets.buyCards,tiles,page);},[assets.buyCards,tiles,page]);
  function close(){setPageId(1);windows.close('expert');}
  function navigate(target:number){
    onEvent({type:'sound',sound:'click'});
    if(target===255)close();else {focusRef.current?.focus({preventScroll:true});setPageId(target);}
  }
  return <GameWindow windowKey="expert" title="Farm Expert" onClose={close}>
    <section ref={focusRef} tabIndex={-1} aria-label="Farm Expert" className="expert-window" data-expert-page={pageId}>
      <img className="expert-frame" src={assets.expertArtwork.src} width={400} height={224} alt="" draggable={false}/>
      <canvas ref={canvas} width={400} height={224} className="expert-artwork" aria-label="Original Farm Expert illustrations"/>
      {page.map((c,i)=>{
        const style={left:c.x,top:c.y-16};
        if(c.kind==='text')return <p className="expert-text" key={i} style={{...style,width:c.width}}>{c.text}</p>;
        if(c.kind==='crop')return <p className="expert-text" data-expert-crop={crop(c.slot).id} key={i} style={{...style,width:256}}>{crop(c.slot).expertDescription}</p>;
        if(c.kind==='picture'&&c.card===66)return <div className="expert-portrait" key={i} style={style}>
          <img src={assets.expertPortrait.src} width={112} height={64} alt="Farm Bureau expert" draggable={false}/>
          <span className="expert-cap-text" style={{left:EXPERT_CAP_TEXT.x,top:EXPERT_CAP_TEXT.y,width:EXPERT_CAP_TEXT.width,height:EXPERT_CAP_TEXT.height}}>FARM<br/>BUREAU</span>
        </div>;
        if(c.kind==='picture'&&(c.card<16||c.cropSlot!==undefined)){
          const item=crop(c.cropSlot??c.card);
          return <img className="expert-crop-picture" key={i} src={assetUrl(`${item.id}.card.png`)} alt={`${item.name}, original crop illustration`} width={112} height={64} style={style} draggable={false}/>;
        }
        if(c.kind==='button')return <button key={i} className="expert-caption" style={{...style,backgroundImage:`url("${assets.messageButton.src}")`}} onClick={()=>navigate(c.target)}>{c.caption}</button>;
        if(c.kind==='link')return <button key={i} className="expert-hotspot" style={{...style,width:c.width,height:c.height}} aria-label={topics[c.target]} title={topics[c.target]} onClick={()=>navigate(c.target)}/>;
        if(c.kind==='sound')return <button key={i} className="expert-hotspot" style={{...style,width:c.width,height:c.height}} aria-label="Play rooster sound" title="Play rooster sound" onClick={()=>onEvent({type:'sound',sound:c.sound})}/>;
        return null;
      })}
    </section>
  </GameWindow>;
}
