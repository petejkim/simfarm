import type {GameAssets} from '../assets/game-assets';
import type {DisasterNoticeId} from '../simulation/events';
import {DISASTER_MESSAGES,readDisasterMessage} from '../formats/disaster-message';
import {MessageDialog} from './MessageDialog';
import {EventTextLines} from './EventTextLines';

export function DisasterMessage({id,assets,onClose}:{id:DisasterNoticeId;assets:GameAssets;onClose:()=>void}){
  return <MessageDialog windowKey="disaster-message" assets={assets} portrait={DISASTER_MESSAGES[id].portrait} textId="disaster-message-text" data={{'data-disaster-notice':String(id)}}
    text={<EventTextLines lines={readDisasterMessage(assets.eventText,id)}/>} onClose={onClose} buttons={[{caption:'OK',id:'disaster-message-ok',onClick:onClose}]}/>;
}
