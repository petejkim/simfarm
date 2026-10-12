import type {GameAssets} from '../assets/game-assets';
import type {FinanceNoticeId} from '../simulation/events';
import {FINANCE_MESSAGES,readFinanceMessage} from '../formats/finance-message';
import {MessageDialog} from './MessageDialog';

export function FinanceMessage({id,assets,onClose}:{id:FinanceNoticeId;assets:GameAssets;onClose:()=>void}){
  return <MessageDialog windowKey="finance-message" assets={assets} portrait={FINANCE_MESSAGES[id].portrait} textId="finance-message-text" data={{'data-finance-notice':String(id)}}
    text={readFinanceMessage(assets.eventText,id)} onClose={onClose} buttons={[{caption:'OK',id:'finance-message-ok',onClick:onClose}]}/>;
}
