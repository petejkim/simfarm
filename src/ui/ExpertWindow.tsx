import { useMemo,useState,type RefObject } from 'react';
import { assetUrl,type GameAssets } from '../assets/game-assets';
import { expertPage } from '../formats/expert-cards';
import type { GameEvent } from '../simulation/events';
import { GameWindow,useWindows } from './GameWindow';
import { BevelButton } from './chrome/BevelButton';
import { Sprite } from './chrome/Sprite';
import { TileSprite } from './chrome/TileSprite';

const topics:Record<number,string>={2:'Field icons',10:'Crops',26:'Sprays',30:'Machinery',40:'Structures',5:'Livestock'};
/** Farm Expert (farmburo.bmp is only frame and face): the common frame around a client where each card
 * command is placed at its recorded coordinates, since the supplied cards are positional data. Pictures and
 * tile strips are sprites, captions are BevelButtons, text is HTML; links are transparent hotspots. */
export function ExpertWindow({assets,cropFiles,tiles,focusRef,onEvent}:{assets:GameAssets;cropFiles:readonly string[];tiles:HTMLImageElement;focusRef:RefObject<HTMLElement|null>;onEvent:(event:GameEvent)=>void}){
  const windows=useWindows(),[pageId,setPageId]=useState(1);
  const page=useMemo(()=>expertPage(assets.expertDeck,pageId,cropFiles.length),[assets.expertDeck,pageId,cropFiles.length]);
  const crop=(slot:number)=>assets.catalog.crops.find(c=>`${c.id}.crp`===cropFiles[slot])!;
  function close(){setPageId(1);windows.close('expert');}
  function navigate(target:number){
    if(target===255)close();else {focusRef.current?.focus({preventScroll:true});setPageId(target);}
  }
  return <GameWindow windowKey="expert" title="Farm Expert" framed onClose={close}>
    <section ref={focusRef} tabIndex={-1} aria-label="Farm Expert" className="expert-window" data-expert-page={pageId}>
      {page.map((c,i)=>{
        // Card commands carry window coordinates (16px title included); the client starts inside the 8px frame.
        const style={left:c.x-8,top:c.y-16};
        if(c.kind==='text')return <p className="expert-text" key={i} style={{...style,width:c.width}}>{c.text}</p>;
        if(c.kind==='crop')return <p className="expert-text" data-expert-crop={crop(c.slot).id} key={i} style={{...style,width:256}}>{crop(c.slot).expertDescription}</p>;
        if(c.kind==='picture'&&c.card===66)return <div className="expert-portrait" key={i} style={style}>
          <img src={assets.expertPortrait.src} width={112} height={64} alt="Farm Bureau expert" draggable={false}/>
        </div>;
        if(c.kind==='picture'&&(c.card<16||c.cropSlot!==undefined)){
          const item=crop(c.cropSlot??c.card);
          return <Sprite className="expert-picture" key={i} image={assetUrl(`${item.id}.card.png`)} x={0} y={0} width={112} height={64} label={`${item.name}, original crop illustration`} style={style}/>;
        }
        if(c.kind==='picture')return <Sprite className="expert-picture" key={i} image={assets.buyCards.src} x={c.card%8*112} y={Math.floor(c.card/8)*64} width={112} height={64} style={style}/>;
        if(c.kind==='tiles')return <span className="expert-tiles" key={i} style={{...style,gridTemplateColumns:`repeat(${c.columns},16px)`}}>
          {Array.from({length:c.columns*c.rows},(_,n)=><TileSprite key={n} tile={c.first+n} atlas={tiles.src} masked={assets.maskedTiles.src}/>)}</span>;
        if(c.kind==='button')return <BevelButton key={i} className="expert-caption" style={style} onClick={()=>navigate(c.target)}>{c.caption}</BevelButton>;
        if(c.kind==='link')return <button key={i} type="button" className="expert-hotspot" style={{...style,width:c.width,height:c.height}} aria-label={topics[c.target]} title={topics[c.target]} onClick={()=>navigate(c.target)}/>;
        if(c.kind==='sound')return <button key={i} type="button" className="expert-hotspot" style={{...style,width:c.width,height:c.height}} aria-label="Play rooster sound" title="Play rooster sound" onClick={()=>onEvent({type:'sound',sound:c.sound})}/>;
        return null;
      })}
    </section>
  </GameWindow>;
}
