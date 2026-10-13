import type {GameAssets} from '../assets/game-assets';
import type {CheatNoticeId} from '../simulation/events';
import {MessageDialog} from './MessageDialog';

/** Typed-code popups (keyboard path0xf72a..0xf7b1): initialized DS6190 strings, file base846f0, shown through the
 * same 0636:10f4 popup as disaster messages (x192/y150, one OK). LLAMA uses card25, the second llama photograph
 * (otherwise unused, as is card24); FUND uses card75. CORN has no popup. */
export const CHEAT_MESSAGES:Record<CheatNoticeId,{text:string;portrait:number}>={
  llama:{text:'"The Llama is a quadruped" - Will Wright',portrait:25},          // DS21f5, push19 at0xf75e
  fund:{text:'You just donated $10000 to the town. The mayor and his new car thank you!',portrait:75}, // DS2223, push4b at0xf792
};

export function CheatMessage({id,assets,onClose}:{id:CheatNoticeId;assets:GameAssets;onClose:()=>void}){
  const message=CHEAT_MESSAGES[id];
  return <MessageDialog windowKey="cheat-message" assets={assets} portrait={message.portrait} textId="cheat-message-text" data={{'data-cheat':id}}
    text={message.text} onClose={onClose} buttons={[{caption:'OK',id:'cheat-message-ok',onClick:onClose}]}/>;
}
