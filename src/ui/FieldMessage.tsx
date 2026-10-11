import type {CSSProperties} from 'react';
import type {GameAssets} from '../assets/game-assets';
import {FIXED_HARVEST_MESSAGE} from '../formats/field-message';
import {GameWindow} from './GameWindow';

export function FieldMessage({assets,onClose}:{assets:GameAssets;onClose:()=>void}){
  const portrait=74;
  return <div style={{'--message-artwork':`url("${assets.messageArtwork.src}")`,'--message-button':`url("${assets.messageButton.src}")`} as CSSProperties}>
    <GameWindow windowKey="field-message" title="Message" forced modal descriptionId="field-message-text" onClose={onClose}>
      <div className="original-message-body" data-field-notice="fixed-harvest-week">
        <div className="message-portrait"><img src={assets.buyCards.src} alt="" draggable={false} style={{left:-(portrait%8)*112,top:-Math.floor(portrait/8)*64}}/></div>
        <p id="field-message-text">{FIXED_HARVEST_MESSAGE}</p>
        <button id="field-message-ok" className="message-ok" onClick={onClose}>OK</button>
      </div>
    </GameWindow>
  </div>;
}
