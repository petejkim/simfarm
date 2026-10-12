import type { GameAssets } from '../assets/game-assets';
import { readBulldozeMessage } from '../formats/message-dialog';
import type { BulldozePrompt } from './useBulldoze';
import { MessageDialog } from './MessageDialog';

/** Source 9654 popup: 256×192, portrait 74 at 72,24, text 16,96,
 * YES/CANCEL at 40/168,156. All lettering is React text. */
export function BulldozeDialog({pending,assets,onConfirm,onCancel}:{pending:BulldozePrompt;assets:GameAssets;onConfirm:()=>void;onCancel:()=>void}){
  const confirm=pending.kind==='confirm';
  const text=confirm?readBulldozeMessage(assets.eventText,pending.target.kind==='building'?'building':'field')
    :'You cannot bulldoze a field while equipment is operating in it.';
  return <MessageDialog windowKey="bulldoze-message" assets={assets} portrait={74} textId="bulldoze-message-text" text={text} onClose={onCancel}
    buttons={confirm?[{caption:'YES',onClick:onConfirm},{caption:'CANCEL',onClick:onCancel}]:[{caption:'OK',onClick:onCancel}]}/>;
}
