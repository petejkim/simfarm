import type {GameAssets} from '../assets/game-assets';
import {FIXED_HARVEST_MESSAGE} from '../formats/field-message';
import {MessageDialog} from './MessageDialog';

export function FieldMessage({assets,onClose}:{assets:GameAssets;onClose:()=>void}){
  return <MessageDialog windowKey="field-message" assets={assets} portrait={74} textId="field-message-text" data={{'data-field-notice':'fixed-harvest-week'}}
    text={FIXED_HARVEST_MESSAGE} onClose={onClose} buttons={[{caption:'OK',id:'field-message-ok',onClick:onClose}]}/>;
}
