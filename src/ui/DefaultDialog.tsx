import {useLayoutEffect,useRef} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {DefaultDecision} from '../simulation/default';
import type {GameCommand} from '../simulation/game';
import {MessageDialog} from './MessageDialog';

/** 1db42: source MESSAGE, portrait74, YES/NO. SF-068 corrects the false
 * homestead-sale claim; the plain simulation owns the saved terminal choice. */
export function DefaultDialog({decision,assets,onCommand,onRestart}:{
  decision:DefaultDecision;assets:GameAssets;onCommand:(command:GameCommand)=>void;onRestart:()=>void;
}){
  const pending=decision.status==='pending';
  const newGame=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{if(!pending)newGame.current?.focus({preventScroll:true});},[pending]);
  const choose=(choice:'restart'|'exit')=>{
    onCommand({type:'resolve-default',choice});
    if(choice==='restart')onRestart();
  };
  // Portrait 74 (atlas 224,576).
  return <MessageDialog windowKey="default" assets={assets} portrait={74} modal={false} textId="default-message-text" label={pending?'Financial default':'Farm session ended'}
    text={pending?'You cannot pay your debts. Your homestead remains yours. Would you like to start a new game?'
      :'Farm session ended. You can load a saved farm from File or choose a new game.'}
    buttons={pending?[{caption:'YES',id:'default-restart',title:'Start a new game',onClick:()=>choose('restart')},{caption:'NO',id:'default-exit',title:'End this farm session',onClick:()=>choose('exit')}]
      :[{caption:'NEW GAME',id:'default-new-game',label:'Choose another farm',ref:newGame,onClick:onRestart}]}/>;
}
