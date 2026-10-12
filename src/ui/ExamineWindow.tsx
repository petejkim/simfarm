import { useEffect, useRef } from 'react';
import type { GameAssets } from '../assets/game-assets';
import type { GameSnapshot } from '../simulation/game';
import { examineObject } from '../simulation/examine-object';
import { drawExamine } from '../render/examine';
import { ConditionBadge, CONDITION_WORDS } from './ConditionBadge';
import { GameWindow } from './GameWindow';
export function ExamineWindow({assets,snapshot,tiles,position}:{assets:GameAssets;snapshot:GameSnapshot;tiles:CanvasImageSource;
  position:{x:number;y:number}|null}){
  const canvas=useRef<HTMLCanvasElement>(null),world=snapshot.scenario;
  const view=position?examineObject(world,snapshot.finances,assets.catalog.crops,assets.buyCatalog,assets.examineData,assets.itemText,position.x,position.y):null;
  useEffect(()=>{if(view&&canvas.current)drawExamine(canvas.current.getContext('2d')!,view,assets.examineArtwork,assets.buyCards,tiles,assets.maskedTiles,assets.catalog.palette);},[snapshot,position,tiles,assets]);
  return <GameWindow windowKey="examine" title="Examine">
    {view&&<section className="examine-window" aria-label="Object information" data-kind={view.kind}>
      <canvas ref={canvas} width={208} height={192} aria-label="Original object illustration"/>
      <p id="examine-text" tabIndex={view.fullText?0:undefined} className={view.fullText?'examine-description':'examine-name'}>{view.text}</p>
      {view.damage!==undefined&&<span className="examine-damage" aria-label={`Damage ${view.damage} of 64`}>{assets.examineData.strings.damage}</span>}
      {view.quality!==undefined&&<ConditionBadge className="examine-condition" quality={view.quality} artwork={assets.sellCondition} label={`Condition ${CONDITION_WORDS[view.quality]}`}/>}
      {view.value!==undefined&&<span id="examine-value">${view.value}</span>}
    </section>}
  </GameWindow>;
}
