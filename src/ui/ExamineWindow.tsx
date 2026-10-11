import { useEffect, useRef } from 'react';
import type { GameAssets } from '../assets/game-assets';
import type { GameSnapshot,GameCommand } from '../simulation/game';
import { examineObject } from '../simulation/examine-object';
import { findBuilding } from '../simulation/building-storage';
import { drawExamine } from '../render/examine';
import { GameWindow,useWindows } from './GameWindow';
export function ExamineWindow({assets,snapshot,tiles,position,onCommand}:{assets:GameAssets;snapshot:GameSnapshot;tiles:CanvasImageSource;
  position:{x:number;y:number}|null;onCommand:(c:GameCommand)=>void}){
  const windows=useWindows(),canvas=useRef<HTMLCanvasElement>(null),world=snapshot.scenario;
  const view=position?examineObject(world,snapshot.finances,assets.catalog.crops,assets.buyCatalog,assets.examineData,assets.itemText,position.x,position.y):null;
  const building=position&&findBuilding(world,position.x,position.y);
  const blocked=Boolean(snapshot.pendingTown||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
  useEffect(()=>{if(view&&canvas.current)drawExamine(canvas.current.getContext('2d')!,view,assets.examineArtwork,assets.buyCards,tiles,assets.maskedTiles,assets.catalog.palette);},[snapshot,position,tiles,assets]);
  return <GameWindow windowKey="examine" title="Examine">
    {view&&<section className="examine-window" aria-label="Object information" data-kind={view.kind}>
      <canvas ref={canvas} width={208} height={192} aria-label="Original object illustration"/>
      <p id="examine-text" tabIndex={view.fullText?0:undefined} className={view.fullText?'examine-description':'examine-name'}>{view.text}</p>
      {view.damage!==undefined&&<span className="examine-damage" aria-label={`Damage ${view.damage} of 64`}>{assets.examineData.strings.damage}</span>}
      {view.quality!==undefined&&<div className="examine-condition" aria-label={`Condition ${['BAD','POOR','FAIR','HIGH'][view.quality]}`}
        style={{backgroundImage:`url("${assets.sellConditions.src}")`,backgroundPosition:`-${view.quality*32}px 0`}}>
        <span className="condition-letter">{['X','C','B','A'][view.quality]}</span><span className="condition-word">{['BAD','POOR','FAIR','HIGH'][view.quality]}</span>
      </div>}
      {view.value!==undefined&&<span id="examine-value">${view.value}</span>}
    </section>}
    <div className="examine-actions">
      {building&&![70,71].includes(building.type)&&<button id="examine-building" disabled={blocked} onClick={()=>onCommand({type:'toggle-building-interior',...position!,slot:building.slot})}>{building.flags&1?'Close building':'Open building'}</button>}
      <button onClick={()=>windows.show('actions')}>Object actions</button>
    </div>
  </GameWindow>;
}
