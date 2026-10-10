import type { CSSProperties } from 'react';
import type { GameAssets } from '../assets/game-assets';
import { readBulldozeMessage } from '../formats/message-dialog';
import type { BulldozePrompt } from './useBulldoze';
import { GameWindow } from './GameWindow';

/** Source9654 popup:256×192, portrait74 at72,24, text16,96,
 * YES/CANCEL at40/168,156. All lettering is React text. */
export function BulldozeDialog({pending,assets,onConfirm,onCancel}:{pending:BulldozePrompt;assets:GameAssets;onConfirm:()=>void;onCancel:()=>void}){
  const confirm=pending.kind==='confirm';
  const text=confirm?readBulldozeMessage(assets.eventText,pending.target.kind==='building'?'building':'field')
    :'You cannot bulldoze a field while equipment is operating in it.';
  return <div style={{'--message-artwork':`url("${assets.messageArtwork.src}")`,'--message-button':`url("${assets.messageButton.src}")`} as CSSProperties}>
    <GameWindow windowKey="bulldoze-message" title="Message" forced modal descriptionId="bulldoze-message-text" onClose={onCancel}>
      <div className="original-message-body">
        <div className="message-portrait"><img src={assets.buyCards.src} alt="" draggable={false} style={{left:-(74%8)*112,top:-Math.floor(74/8)*64}}/></div>
        <p id="bulldoze-message-text">{text}</p>
        {confirm?<><button className="message-yes" onClick={onConfirm}>YES</button><button className="message-cancel" onClick={onCancel}>CANCEL</button></>
          :<button className="message-ok" onClick={onCancel}>OK</button>}
      </div>
    </GameWindow>
  </div>;
}
