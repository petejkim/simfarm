import { useEffect, useRef, useState, type Ref } from 'react';
import { assetUrl, type GameAssets } from '../assets/game-assets';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { sellProducts, type SellCategory } from '../simulation/sell-products';
import { drawSellPreview } from '../render/sell-preview';
import { GameWindow, useWindows } from './GameWindow';

const categories: {kind:SellCategory;label:string}[]=[{kind:'harvest',label:'Harvest'},{kind:'equipment',label:'Machinery'},{kind:'animal',label:'Livestock'}];
const grades=['BAD','POOR','FAIR','HIGH'], letters=['X','C','B','A'];
const reasons: Record<string,string>={'asset-busy':'This machine is in use. Finish its work before selling.','inconsistent-asset':'This asset has inconsistent storage, ownership or links and cannot be sold.','invalid-asset':'This item is no longer available.','inconsistent-inventory':'Cannot sell: the inventory and storage records do not match.','invalid-item':'This harvest is no longer available.'};
export function SellWindow({assets,snapshot,tiles,onCommand,focusRef}:{assets:GameAssets;snapshot:GameSnapshot;tiles:CanvasImageSource;onCommand:(command:GameCommand)=>void;focusRef:Ref<HTMLElement>}) {
  const windows=useWindows(),[category,setCategory]=useState<SellCategory>('harvest'),[selection,setSelection]=useState({index:0,offset:0});
  const items=sellProducts(snapshot.scenario,snapshot.finances,assets.catalog.crops,assets.buyCatalog,assets.itemText,category,snapshot.weather.soilMoisture);
  const index=Math.min(selection.index,Math.max(0,items.length-1)), offset=Math.min(selection.offset,Math.max(0,items.length-3),index);
  const rows=items.slice(offset,offset+3),product=items[index];
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{if(canvas.current)drawSellPreview(canvas.current.getContext('2d')!,rows,tiles,assets.maskedTiles);},[snapshot,category,offset,tiles,assets.maskedTiles]);
  const blocked=Boolean(snapshot.pendingTown||snapshot.townEvent.pending||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
  const result=category==='harvest'?snapshot.lastSaleResult:snapshot.lastAssetSaleResult?.kind===category?snapshot.lastAssetSaleResult:null;
  const harvestCount=snapshot.scenario.inventory.filter(i=>i.active&&i.type>=168&&i.type<168+snapshot.scenario.cropFiles.length).length;
  function select(next:number){const i=Math.max(0,Math.min(items.length-1,next));setSelection({index:i,offset:Math.max(0,Math.min(Math.max(0,items.length-3),i<offset?i:i>offset+2?i-2:offset))});}
  return <GameWindow windowKey="sell" title="Sell">
    <section ref={focusRef} tabIndex={-1} className="sell-window" aria-label="Sell catalog" onKeyDown={event=>{
      if(event.target instanceof HTMLInputElement)return;
      if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();select(index+(event.key==='ArrowUp'?-1:1));}
      if(event.key==='Home'||event.key==='End'){event.preventDefault();select(event.key==='Home'?0:items.length-1);}
    }}>
      <img src={assets.sellArtwork.src} width="192" height="256" alt="" draggable={false}/>
      <div className="sell-card" role="img" aria-label={product?`${product.name} illustration`:'Nothing for sale'}>
        {product?.cropId?<img src={assetUrl(`${product.cropId}.card.png`)} alt=""/>:<img src={assets.buyCards.src} alt="" style={{left:-((product?.card??48)%8)*112,top:-Math.floor((product?.card??48)/8)*64}}/>}
      </div>
      {categories.map(({kind,label},i)=><button key={kind} className="sell-category" style={{top:2+i*30}} aria-label={label} title={label} aria-pressed={category===kind} onClick={()=>{setCategory(kind);setSelection({index:0,offset:0});}}/>)}
      <p id="sell-item-name" title={product?.name}>{product?.name??''}</p>
      <button className="sell-scroll" style={{top:96}} aria-label="Previous item" disabled={!items.length||index===0} onClick={()=>select(index-1)}/>
      <button className="sell-scroll" style={{top:176}} aria-label="Next item" disabled={!items.length||index===items.length-1} onClick={()=>select(index+1)}/>
      <input className="sell-scrollbar" type="range" min={0} max={Math.max(0,items.length-1)} value={index} aria-label="Sale item" disabled={items.length<2} onChange={event=>select(Number(event.target.value))}/>
      <canvas ref={canvas} className="sell-preview" width={192} height={256} aria-label="Sale item graphics"/>
      <div id="harvest-items" role="listbox" aria-label="Items for sale">
        {rows.map((p,row)=><button key={`${p.kind}-${p.slot}`} role="option" aria-selected={index===offset+row} className="sell-row" data-slot={p.slot} data-value={p.value} data-name={p.name} style={{top:96+row*32}}
          aria-label={`${p.name}, ${p.kind==='harvest'?'lot':'item'} ${p.slot}, ${grades[p.quality]}, $${p.value.toLocaleString('en-US')}`} onClick={()=>select(offset+row)}>
          <span className="sell-condition" style={{backgroundImage:`url("${assets.sellConditions.src}")`,backgroundPosition:`-${p.quality*32}px 0`}}><span className="condition-letter">{letters[p.quality]}</span><span className="condition-word">{grades[p.quality]}</span></span>
          <span className="sell-price">$ {p.value.toLocaleString('en-US')}</span>
          <span className="sale-accessible-detail">{p.name}{p.quantity!==undefined?` · Quantity ${p.quantity} · Loss ${Math.floor(p.loss!*100/65535)}%`:''}</span>
        </button>)}
      </div>
      {!product&&<p className="sell-empty">NOTHING<br/>FOR SALE</p>}
      <p id="sell-position">{product?`Item: ${index+1} of ${items.length}`:''}</p>
      <button id="catalog-sell" className={`sell-caption ${category==='harvest'&&product?'sell-harvest':''}`} style={{left:88,width:40}} disabled={blocked||!product?.available}
        aria-label={product?`Sell ${product.name}, ${category==='harvest'?'lot':'item'} ${product.slot}, for $${product.value}`:'Sell selected item'} onClick={()=>{if(product)onCommand(product.kind==='harvest'?{type:'sell-harvest',inventorySlot:product.slot}:{type:'sell-asset',kind:product.kind,slot:product.slot});}}>SELL</button>
      <button className="sell-caption" style={{left:128,width:48}} onClick={()=>windows.close('sell')}>CLOSE</button>
      <p id="harvest-stock" className="sale-accessible-detail">{harvestCount?`${harvestCount} stored harvest${harvestCount===1?'':'s'}`:'No stored harvests.'}</p>
    </section>
    {(product?.reason||result)&&<div className="sell-feedback">
      {product?.reason&&<p role="status">{reasons[product.reason]??'This item cannot be sold.'}</p>}
      {result&&<p id={category==='harvest'?'sale-result':'catalog-sale-result'} role="status">{result.ok?`${category==='harvest'?'Harvest':category==='animal'?'Animal':'Machine'} sold for $${result.value.toLocaleString('en-US')}.`:reasons[result.reason]??'This item cannot be sold.'}</p>}
    </div>}
  </GameWindow>;
}
