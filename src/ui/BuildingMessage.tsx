import type {GameAssets} from '../assets/game-assets';
import {readWaterStorageMessage,WATER_STORAGE_MESSAGE} from '../formats/building-message';
import {MessageDialog} from './MessageDialog';

export function BuildingMessage({assets,onClose}:{assets:GameAssets;onClose:()=>void}){
  return <MessageDialog windowKey="building-message" assets={assets} portrait={WATER_STORAGE_MESSAGE.portrait} textId="building-message-text" data={{'data-building-notice':'44'}}
    text={readWaterStorageMessage(assets.eventText)} onClose={onClose} buttons={[{caption:'OK',id:'building-message-ok',onClick:onClose}]}/>;
}
