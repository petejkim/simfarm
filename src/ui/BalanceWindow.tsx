import type {RefObject} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import type {GameEvent} from '../simulation/events';
import {balanceWindowView} from '../simulation/balance-view';
import {BALANCE_LABELS} from '../formats/balance-window';
import {GameWindow,useWindows} from './GameWindow';

export function BalanceWindow({assets,snapshot,focusRef,onEvent,onTaxes}:{assets:GameAssets;snapshot:GameSnapshot;focusRef:RefObject<HTMLElement|null>;onEvent:(e:GameEvent)=>void;onTaxes:()=>void}){
  const windows=useWindows(),v=balanceWindowView(snapshot,assets.catalog.crops),close=()=>{onEvent({type:'sound',sound:'click'});windows.close('balance');};
  const output=(id:string,x:number,y:number,width:number,n:number,label:string)=><output id={`balance-${id}`} aria-label={label} title={String(n)} style={{left:x,top:y,width,fontSize:Math.min(10,width/(String(n).length*.62))}}>{n}</output>;
  return <GameWindow windowKey="balance" title="Balance Sheet" onClose={close}>
    <section ref={focusRef} tabIndex={-1} className="balance-window" aria-label="Farm balance sheet">
      <img src={assets.balanceArtwork.src} width={400} height={224} alt="" draggable={false}/>
      {BALANCE_LABELS.slice(0,-1).map(l=><span key={`${l.x}-${l.y}`} className="balance-label" style={{left:l.x,top:l.y,width:l.width,color:l.light?'#fff':'#000'}}>{l.text}</span>)}
      {v.assets.map((n,i)=>output(`asset-${i}`,144,24+i*8,56,n,['Cash','Machinery value','Land value','Futures value','Livestock value'][i]))}
      {output('assets',136,88,64,v.totalAssets,'Total assets')}
      {v.revenue.map((n,i)=>output(`revenue-${i}`,144,120+i*8,56,n,['Crop sales','Machinery sales','Land sales','Futures sold','Animal sales'][i]))}
      {v.expenses.map((n,i)=>output(`expense-${i}`,320,24+i*8,56,n,['Seed expenses','Machinery expenses','Land purchases','Futures losses','Structures','Livestock expenses','Chemicals','Loan interest','Leased machines','Taxes','Miscellaneous'][i]))}
      {output('income',136,168,64,v.income,'Total revenue')}{output('expenses',312,152,64,v.totalExpenses,'Total expenses')}{output('net',312,168,64,v.net,'Profit or loss')}
      {output('tax',192,184,64,v.tax,'Estimated taxes')}{output('loan',192,192,56,v.loan,'Quarterly loan payment')}
      <button className="balance-tax-details" aria-label="View tax details" title="View tax details" onClick={onTaxes}/>
      <button className="balance-close" onClick={close}>CLOSE</button>
    </section>
  </GameWindow>;
}
