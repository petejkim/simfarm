import {useLayoutEffect,useRef,type CSSProperties} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {DefaultDecision} from '../simulation/default';
import type {GameCommand} from '../simulation/game';
import {GameWindow} from './GameWindow';

/** 1db42: source MESSAGE, portrait74, YES/NO. SF-068 corrects the false
 * homestead-sale claim; the plain simulation owns the saved terminal choice. */
export function DefaultDialog({decision,assets,onCommand,onRestart}:{
  decision:DefaultDecision;assets:GameAssets;onCommand:(command:GameCommand)=>void;onRestart:()=>void;
}){
  const pending=decision.status==='pending';
  const newGame=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{if(!pending)newGame.current?.focus({preventScroll:true});},[pending]);
  const choose=(choice:'restart'|'exit')=>{
    onCommand({type:'resolve-default',choice});
    if(choice==='restart')onRestart();
  };
  return <div style={{'--message-artwork':`url("${assets.messageArtwork.src}")`,'--message-button':`url("${assets.messageButton.src}")`} as CSSProperties}>
    <GameWindow windowKey="default" title="Message" forced descriptionId="default-message-text">
      <section className="original-message-body" aria-label={pending?'Financial default':'Farm session ended'}>
        <div className="message-portrait"><img src={assets.buyCards.src} alt="" draggable={false} style={{left:-224,top:-576}}/></div>
        <p id="default-message-text">{pending
          ?'You cannot pay your debts. Your homestead remains yours. Would you like to start a new game?'
          :'Farm session ended. You can load a saved farm from File or choose a new game.'}</p>
        {pending?<>
          <button id="default-restart" className="message-yes" title="Start a new game" onClick={()=>choose('restart')}>YES</button>
          <button id="default-exit" className="message-cancel" title="End this farm session" onClick={()=>choose('exit')}>NO</button>
        </>:<button ref={newGame} id="default-new-game" className="message-ok" aria-label="Choose another farm" onClick={()=>{
          onRestart();
        }}>NEW GAME</button>}
      </section>
    </GameWindow>
  </div>;
}
