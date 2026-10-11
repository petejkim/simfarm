import type {CSSProperties} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {DisasterNoticeId} from '../simulation/events';
import {DISASTER_MESSAGES,readDisasterMessage} from '../formats/disaster-message';
import {GameWindow} from './GameWindow';

export function DisasterMessage({id,assets,onClose}:{id:DisasterNoticeId;assets:GameAssets;onClose:()=>void}){
  const portrait=DISASTER_MESSAGES[id].portrait;
  return <div style={{'--message-artwork':`url("${assets.messageArtwork.src}")`,'--message-button':`url("${assets.messageButton.src}")`} as CSSProperties}>
    <GameWindow windowKey="disaster-message" title="Message" forced modal descriptionId="disaster-message-text" onClose={onClose}>
      <div className="original-message-body" data-disaster-notice={id}>
        <div className="message-portrait"><img src={assets.buyCards.src} alt="" draggable={false} style={{left:-(portrait%8)*112,top:-Math.floor(portrait/8)*64}}/></div>
        <p id="disaster-message-text">{readDisasterMessage(assets.eventText,id)}</p>
        <button id="disaster-message-ok" className="message-ok" onClick={onClose}>OK</button>
      </div>
    </GameWindow>
  </div>;
}
