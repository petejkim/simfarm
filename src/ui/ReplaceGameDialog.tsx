import type {GameAssets} from '../assets/game-assets';
import {MessageDialog} from './MessageDialog';

export type ReplaceGameAction='new-game'|'load';
const TEXT:Record<ReplaceGameAction,string>={
  'new-game':'Starting a new game will delete your current farm. Cancel and use Save to File... first to keep a copy. Continue?',
  load:'Loading a farm will delete your current farm. Cancel and use Save to File... first to keep a copy. Continue?',
};

/** Native confirmation (user request) before File → New Game or Load from File... replaces the current game and
 * its browser-stored save. Original message popup with portrait 74 and YES/CANCEL, as the Bulldoze confirmation.
 * YES runs the action inside its click, so Load can still open the file picker. */
export function ReplaceGameDialog({action,assets,onConfirm,onCancel}:{action:ReplaceGameAction;assets:GameAssets;onConfirm:()=>void;onCancel:()=>void}){
  return <MessageDialog windowKey="replace-game" assets={assets} portrait={74} textId="replace-game-text" data={{'data-replace-game':action}}
    text={TEXT[action]} onClose={onCancel}
    buttons={[{caption:'YES',id:'replace-game-yes',onClick:onConfirm},{caption:'CANCEL',id:'replace-game-cancel',onClick:onCancel}]}/>;
}
