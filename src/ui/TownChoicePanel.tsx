import type {GameCommand,GameSnapshot} from '../simulation/game';
import type {TownChoice} from '../simulation/town-construction';
import type {GameAssets} from '../assets/game-assets';
import {TOWN_CHOICES,TOWN_INSTRUCTIONS} from '../formats/town-choice';
import {BevelButton} from './chrome/BevelButton';
import {RaisedPanel} from './chrome/RaisedPanel';
import {spriteFace} from './chrome/Sprite';

/** Town expansion choice (twnchoic.bmp) on shared chrome: plank title from the bitmap, common frame,
 * four picture BevelButtons (sprite faces) with HTML captions, the timeout link and a raised instructions panel. */
export function TownChoicePanel({snapshot,onCommand,assets}:{
  snapshot:GameSnapshot;onCommand:(command:GameCommand)=>void;assets:GameAssets;
}){
  if(!snapshot.pendingTown)return null;
  const result=snapshot.lastTownResult;
  const choose=(choice:TownChoice)=>{onCommand({type:'choose-town',choice});};
  const art=assets.townChoiceArtwork.src;
  return <section id="town-choice" aria-label="Town expansion choice" className="town-choice">
    <div className="town-choices">
      {TOWN_CHOICES.map(c=><div key={c.choice} className="town-choice-column">
        <BevelButton id={`town-${c.choice}`} className="town-picture" shadow faceStyle={spriteFace(art,c.x+3,35)} aria-labelledby={`town-label-${c.choice}`} onClick={()=>choose(c.choice)}/>
        <span id={`town-label-${c.choice}`} className="town-caption">{c.label}</span>
      </div>)}
    </div>
    <button id="town-timeout" type="button" onClick={()=>choose('timeout')}>Let town decide</button>
    <RaisedPanel className="town-panel" faceClassName="town-panel-face"><p className="town-instructions">{TOWN_INSTRUCTIONS}</p></RaisedPanel>
    {result&&!result.ok&&<p id="town-choice-error" role="status">{result.reason==='recreation-limit'
      ?'The town cannot support another recreational district yet. Choose another district.'
      :'That district could not be built. Please choose again.'}</p>}
  </section>;
}
