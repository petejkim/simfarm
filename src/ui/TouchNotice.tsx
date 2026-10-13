import type {GameAssets} from '../assets/game-assets';
import {MessageDialog} from './MessageDialog';

/** Native notice (user request): touch screens are told once, by the farmer, that mobile support is still in progress
 * and how to play full screen. Not an original message; it uses the original popup and card 75 (farmer, thumbs up). */
const SEEN_KEY='simfarm.touch-notice.v1';
const standalone=()=>matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
export function touchNoticeDue():boolean{
  try{return matchMedia('(pointer:coarse)').matches&&!localStorage.getItem(SEEN_KEY);}catch{return false;}
}
function markSeen(){try{localStorage.setItem(SEEN_KEY,'1');}catch{/* Shown again next time; storage is optional. */}}
export function touchNoticeText(installed:boolean):string{
  return 'Mobile support is still a work in progress, so some things may be hard to use on a touch screen.'+
    (installed?'':' For the best experience, add SimFarm to your Home Screen to play in full screen.');
}
export function TouchNotice({assets,onClose}:{assets:GameAssets;onClose:()=>void}){
  const close=()=>{markSeen();onClose();};
  return <MessageDialog windowKey="touch-notice" assets={assets} portrait={75} textId="touch-notice-text" data={{'data-touch-notice':''}}
    text={touchNoticeText(standalone())} onClose={close} buttons={[{caption:'OK',id:'touch-notice-ok',onClick:close}]}/>;
}
