import type {CSSProperties} from 'react';
import type {GameAssets} from '../assets/game-assets';
import {readWaterStorageMessage,WATER_STORAGE_MESSAGE} from '../formats/building-message';
import {GameWindow} from './GameWindow';

export function BuildingMessage({assets,onClose}:{assets:GameAssets;onClose:()=>void}){
  const portrait=WATER_STORAGE_MESSAGE.portrait;
  return <div style={{'--message-artwork':`url("${assets.messageArtwork.src}")`,'--message-button':`url("${assets.messageButton.src}")`} as CSSProperties}>
    <GameWindow windowKey="building-message" title="Message" forced modal descriptionId="building-message-text" onClose={onClose}>
      <div className="original-message-body" data-building-notice="44">
        <div className="message-portrait"><img src={assets.buyCards.src} alt="" draggable={false} style={{left:-(portrait%8)*112,top:-Math.floor(portrait/8)*64}}/></div>
        <p id="building-message-text">{readWaterStorageMessage(assets.eventText)}</p>
        <button id="building-message-ok" className="message-ok" onClick={onClose}>OK</button>
      </div>
    </GameWindow>
  </div>;
}
