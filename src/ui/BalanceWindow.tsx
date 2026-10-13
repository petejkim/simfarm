import type {ReactNode, RefObject} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import {balanceWindowView} from '../simulation/balance-view';
import {GameWindow,useWindows} from './GameWindow';
import {BevelButton} from './chrome/BevelButton';
import {Sprite} from './chrome/Sprite';

type Fill='header'|'total'|undefined;
interface Cell { label?:string; fill?:Fill; value?:ReactNode }

/** Original Balance Sheet (cashflow.bmp) as a ledger page: 8px rows striped grey/white across both
 * halves, green section headers and dark total bars, punch-hole margins (source sprites), and CLOSE. */
export function BalanceWindow({assets,snapshot,focusRef}:{assets:GameAssets;snapshot:GameSnapshot;focusRef:RefObject<HTMLElement|null>}){
  const windows=useWindows(),v=balanceWindowView(snapshot,assets.catalog.crops),close=()=>{windows.close('balance');};
  const out=(id:string,n:number,label:string)=><output id={`balance-${id}`} aria-label={label} title={String(n)}>{n}</output>;
  const left:Cell[]=[],right:Cell[]=[];
  left[0]={label:'ASSETS',fill:'header'};right[0]={label:'EXPENDITURES',fill:'header'};
  ['Cash','Machinery','Land','Futures','Livestock'].forEach((label,i)=>{left[2+i]={label,value:out(`asset-${i}`,v.assets[i],['Cash','Machinery value','Land value','Futures value','Livestock value'][i])};});
  left[10]={label:'TOTAL ASSETS',fill:'total',value:out('assets',v.totalAssets,'Total assets')};
  left[12]={label:'ANNUAL REVENUE',fill:'header'};
  ['Crop Sales','Machinery Sales','Land Sales','Futures Sold','Animal Sales'].forEach((label,i)=>{left[14+i]={label,value:out(`revenue-${i}`,v.revenue[i],['Crop sales','Machinery sales','Land sales','Futures sold','Animal sales'][i])};});
  left[20]={label:'TOTAL REVENUE',fill:'total',value:out('income',v.income,'Total revenue')};
  ['Seed','Machinery','Land Purchases','Futures Losses','Structures','Livestock','Chemicals','Loan Interest','Leased Machines','Taxes','Miscellaneous'].forEach((label,i)=>{
    right[2+i]={label,value:out(`expense-${i}`,v.expenses[i],['Seed expenses','Machinery expenses','Land purchases','Futures losses','Structures','Livestock expenses','Chemicals','Loan interest','Leased machines','Taxes','Miscellaneous'][i])};});
  right[18]={label:'TOTAL EXPENSES',fill:'total',value:out('expenses',v.totalExpenses,'Total expenses')};
  right[20]={label:'PROFIT/LOSS',fill:'total',value:out('net',v.net,'Profit or loss')};
  const cell=(c:Cell|undefined,side:'left'|'right')=><span className={`balance-cell balance-${side}`} data-fill={c?.fill}>
    {c?.label&&<span className="balance-label">{c.label}</span>}{c?.value}</span>;
  const art=assets.balanceArtwork.src;
  return <GameWindow windowKey="balance" title="Balance Sheet" onClose={close} framed>
    <section ref={focusRef} tabIndex={-1} className="balance-window" aria-label="Farm balance sheet">
      <BinderHoles art={art} x={8}/>
      <div className="balance-ledger">
        {/* 22 striped rows from source y8, then the tax/loan rows beside CLOSE. */}
        {Array.from({length:22},(_,row)=><div key={row} className="balance-row" data-stripe={row%2?'white':'grey'}>{cell(left[row],'left')}{cell(right[row],'right')}</div>)}
        <div className="balance-footer">
          <div className="balance-footer-rows">
            <div className="balance-row balance-wide" data-stripe="grey"><span className="balance-label">Estimated Taxes</span>{out('tax',v.tax,'Estimated taxes')}</div>
            <div className="balance-row balance-wide" data-stripe="white"><span className="balance-label">Quarterly Loan Payment</span>{out('loan',v.loan,'Quarterly loan payment')}</div>
          </div>
          <BevelButton className="balance-close" shadow onClick={close}>CLOSE</BevelButton>
        </div>
      </div>
      {/* The source green header rows reach x376, so the right strip is cut from x377 and inset 1px on white paper. */}
      <BinderHoles art={art} x={377} width={15}/>
    </section>
  </GameWindow>;
}

/** Taller rows (user request) make the ledger 264px; the source strips are 216px, so a second 48px cut continues
 * the 12px hole period seamlessly below. */
function BinderHoles({art,x,width=16}:{art:string;x:number;width?:number}){
  return <div className="balance-holes" style={{paddingLeft:16-width}}>
    <Sprite image={art} x={x} y={0} width={width} height={216}/><Sprite image={art} x={x} y={0} width={width} height={48}/>
  </div>;
}
