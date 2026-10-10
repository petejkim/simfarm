import type {CSSProperties} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {FinanceNoticeId} from '../simulation/events';
import {FINANCE_MESSAGES,readFinanceMessage} from '../formats/finance-message';
import {GameWindow} from './GameWindow';

export function FinanceMessage({id,assets,onClose}:{id:FinanceNoticeId;assets:GameAssets;onClose:()=>void}){
  const portrait=FINANCE_MESSAGES[id].portrait;
  return <div style={{'--message-artwork':`url("${assets.messageArtwork.src}")`,'--message-button':`url("${assets.messageButton.src}")`} as CSSProperties}>
    <GameWindow windowKey="finance-message" title="Message" forced modal descriptionId="finance-message-text" onClose={onClose}>
      <div className="original-message-body" data-finance-notice={id}>
        <div className="message-portrait"><img src={assets.buyCards.src} alt="" draggable={false} style={{left:-(portrait%8)*112,top:-Math.floor(portrait/8)*64}}/></div>
        <p id="finance-message-text">{readFinanceMessage(assets.eventText,id)}</p>
        <button id="finance-message-ok" className="message-ok" onClick={onClose}>OK</button>
      </div>
    </GameWindow>
  </div>;
}
