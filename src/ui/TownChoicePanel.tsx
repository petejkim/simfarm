import type {CSSProperties} from 'react';
import type {GameCommand,GameSnapshot} from '../simulation/game';
import type {TownChoice} from '../simulation/town-construction';
import type {GameAssets} from '../assets/game-assets';
import type {GameEvent} from '../simulation/events';
import {TOWN_CHOICES,TOWN_INSTRUCTIONS} from '../formats/town-choice';

export function TownChoicePanel({snapshot,onCommand,assets,onEvent}:{
  snapshot:GameSnapshot;onCommand:(command:GameCommand)=>void;assets:GameAssets;onEvent:(event:GameEvent)=>void;
}){
  if(!snapshot.pendingTown)return null;
  const result=snapshot.lastTownResult;
  const choose=(choice:TownChoice)=>{onEvent({type:'sound',sound:'click'});onCommand({type:'choose-town',choice});};
  return <section id="town-choice" aria-label="Town expansion choice" style={{'--town-pressed':`url("${assets.townChoicePressed.src}")`} as CSSProperties}>
    <div className="town-choice-artwork">
      <img src={assets.townChoiceArtwork.src} width={368} height={224} alt="" draggable={false}/>
      {TOWN_CHOICES.map(c=><div key={c.choice}>
        <button id={`town-${c.choice}`} className="town-picture" style={{left:c.x}} aria-labelledby={`town-label-${c.choice}`} onClick={()=>choose(c.choice)}/>
        <span id={`town-label-${c.choice}`} className="town-caption" style={{left:c.x-8}}>{c.label}</span>
      </div>)}
      <p className="town-instructions">{TOWN_INSTRUCTIONS}</p>
      <button id="town-timeout" onClick={()=>choose('timeout')}>Let town decide</button>
    </div>
    {result&&!result.ok&&<p id="town-choice-error" role="status">{result.reason==='recreation-limit'
      ?'The town cannot support another recreational district yet. Choose another district.'
      :'That district could not be built. Please choose again.'}</p>}
  </section>;
}
