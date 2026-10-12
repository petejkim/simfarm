import type {ReactNode,Ref} from 'react';
import type {GameAssets} from '../assets/game-assets';
import {GameWindow} from './GameWindow';
import {BevelButton} from './chrome/BevelButton';
import {Sprite} from './chrome/Sprite';

export interface MessageButton {caption:string;onClick:()=>void;id?:string;title?:string;label?:string;ref?:Ref<HTMLButtonElement>}

/** Source 9654 message popup (popup.bmp: 256×192 at 192,150) on shared chrome: the plank title bar from the
 * bitmap, the common frame, a 112×64 portrait sprite, the message text and 48×24 caption BevelButtons
 * (one centred, or a pair at client 32 and 160). */
export function MessageDialog({windowKey,assets,portrait,text,textId,buttons,onClose,modal=true,label,data}:{
  windowKey:string;assets:GameAssets;portrait:number;text:ReactNode;textId:string;buttons:readonly MessageButton[];
  onClose?:()=>void;modal?:boolean;label?:string;data?:Record<`data-${string}`,string>;
}){
  return <GameWindow windowKey={windowKey} title="Message" forced modal={modal} framed descriptionId={textId} onClose={onClose} titleArtwork={assets.messageArtwork.src}>
    <section className="original-message-body" aria-label={label} {...data}>
      <Sprite className="message-portrait" image={assets.buyCards.src} x={portrait%8*112} y={Math.floor(portrait/8)*64} width={112} height={64}/>
      <p id={textId} className="message-text">{text}</p>
      <div className="message-buttons">
        {buttons.map(b=><BevelButton key={b.caption} ref={b.ref} id={b.id} className="message-button" title={b.title} aria-label={b.label} onClick={b.onClick}>{b.caption}</BevelButton>)}
      </div>
    </section>
  </GameWindow>;
}
