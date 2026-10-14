import { useState, type Ref } from 'react';
import { type GameAssets } from '../assets/game-assets';
import { cropCardFrame } from '../formats/crop-graphics';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { sellProducts, type SellCategory, type SellProduct } from '../simulation/sell-products';
import { ConditionBadge, CONDITION_WORDS } from './ConditionBadge';
import { GameWindow, useWindows } from './GameWindow';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { Sprite, spriteFace } from './chrome/Sprite';
import { TileSprite } from './chrome/TileSprite';

const categories: {kind:SellCategory;label:string}[]=[{kind:'harvest',label:'Harvest'},{kind:'equipment',label:'Machinery'},{kind:'animal',label:'Livestock'}];
const grades=CONDITION_WORDS;

/** Original Sell window (sellwndo.bmp) rebuilt from shared chrome: category buttons and the photo inset;
 * the item name; a scroll column beside the three-row sale list inset; position text; SELL/CLOSE.
 * Category icons, scroll arrows and the scroll track are sprites from the source bitmap. */
export function SellWindow({assets,snapshot,tiles,onCommand,focusRef}:{assets:GameAssets;snapshot:GameSnapshot;tiles:HTMLImageElement;onCommand:(command:GameCommand)=>void;focusRef:Ref<HTMLElement>}) {
  const windows=useWindows(),[category,setCategory]=useState<SellCategory>('harvest'),[selection,setSelection]=useState({index:0,offset:0});
  const items=sellProducts(snapshot.scenario,snapshot.finances,assets.catalog.crops,assets.buyCatalog,assets.itemText,category,snapshot.weather.soilMoisture);
  const index=Math.min(selection.index,Math.max(0,items.length-1)), offset=Math.min(selection.offset,Math.max(0,items.length-3),index);
  const rows=items.slice(offset,offset+3),product=items[index],art=assets.sellArtwork.src;
  const blocked=Boolean(snapshot.pendingTown||snapshot.townEvent.pending||snapshot.finances.defaultDecision||snapshot.aircraftFlight);
  const harvestCount=snapshot.scenario.inventory.filter(i=>i.active&&i.type>=168&&i.type<168+snapshot.scenario.cropFiles.length).length;
  const card=product?.card??48;
  function select(next:number){const i=Math.max(0,Math.min(items.length-1,next));setSelection({index:i,offset:Math.max(0,Math.min(Math.max(0,items.length-3),i<offset?i:i>offset+2?i-2:offset))});}
  return <GameWindow windowKey="sell" title="Sell" framed>
    <section ref={focusRef} tabIndex={-1} className="sell-window" aria-label="Sell catalog" onKeyDown={event=>{
      if(event.target instanceof HTMLInputElement)return;
      if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();select(index+(event.key==='ArrowUp'?-1:1));}
      if(event.key==='Home'||event.key==='End'){event.preventDefault();select(event.key==='Home'?0:items.length-1);}
    }}>
      <div className="sell-top">
        <div className="sell-categories">
          {categories.map(({kind,label},i)=><BevelButton key={kind} className="sell-category" shadow pressed={category===kind} aria-label={label} title={label}
            faceStyle={spriteFace(art,19,5+i*30)} onClick={()=>{setCategory(kind);setSelection({index:0,offset:0});}}/>)}
        </div>
        <div className="sell-heading">
          <SunkenInset className="sell-photo">
            <div className="sell-card" role="img" aria-label={product?`${product.name} illustration`:'Nothing for sale'}>
              {product?.cropId?<Sprite image={assets.cropCards.src} {...cropCardFrame(product.cropId)}/>
                :<Sprite image={assets.buyCards.src} x={card%8*112} y={Math.floor(card/8)*64} width={112} height={64}/>}
            </div>
          </SunkenInset>
          <p id="sell-item-name" title={product?.name}>{product?.name??''}</p>
        </div>
      </div>
      <div className="sell-middle">
        <div className="sell-scroll-column">
          <BevelButton className="sell-scroll" aria-label="Previous item" faceStyle={spriteFace(art,19,99)} disabled={!items.length||index===0} onClick={()=>select(index-1)}/>
          <span className="sell-track" style={spriteFace(art,16,112)}>
            <input className="sell-scrollbar" type="range" min={0} max={Math.max(0,items.length-1)} value={index} aria-label="Sale item" disabled={items.length<2} onChange={event=>select(Number(event.target.value))}/>
          </span>
          <BevelButton className="sell-scroll" aria-label="Next item" faceStyle={spriteFace(art,19,179)} disabled={!items.length||index===items.length-1} onClick={()=>select(index+1)}/>
        </div>
        <SunkenInset className="sell-list-box">
          <div id="harvest-items" role="listbox" aria-label="Items for sale">
            {rows.map((p,row)=><SellRow key={`${p.kind}-${p.slot}`} product={p} selected={index===offset+row} assets={assets} atlas={tiles.src} onSelect={()=>select(offset+row)}/>)}
          </div>
          {!product&&<p className="sell-empty">NOTHING<br/>FOR SALE</p>}
        </SunkenInset>
      </div>
      <p id="sell-position">{product?`Item: ${index+1} of ${items.length}`:''}</p>
      <div className="sell-actions">
        <BevelButton id="catalog-sell" className={`sell-caption sell-caption-sell ${category==='harvest'&&product?'sell-harvest':''}`} disabled={blocked||!product?.available}
          aria-label={product?`Sell ${product.name}, ${category==='harvest'?'lot':'item'} ${product.slot}, for $${product.value}`:'Sell selected item'}
          onClick={()=>{if(product)onCommand(product.kind==='harvest'?{type:'sell-harvest',inventorySlot:product.slot}:{type:'sell-asset',kind:product.kind,slot:product.slot});}}>SELL</BevelButton>
        <BevelButton className="sell-caption sell-caption-close" onClick={()=>windows.close('sell')}>CLOSE</BevelButton>
      </div>
      <p id="harvest-stock" className="sale-accessible-detail">{harvestCount?`${harvestCount} stored harvest${harvestCount===1?'':'s'}`:'No stored harvests.'}</p>
    </section>
  </GameWindow>;
}

/** One 32px sale row (source 4c610): the item graphic, its condition badge and price. */
function SellRow({product:p,selected,assets,atlas,onSelect}:{product:SellProduct;selected:boolean;assets:GameAssets;atlas:string;onSelect:()=>void}){
  const showTiles=p.tile!==null&&p.width<=4&&p.height<=4;
  return <button role="option" aria-selected={selected} className="sell-row" data-slot={p.slot} data-value={p.value} data-name={p.name}
    aria-label={`${p.name}, ${p.kind==='harvest'?'lot':'item'} ${p.slot}, ${grades[p.quality]}, $${p.value.toLocaleString('en-US')}`} onClick={onSelect}>
    <span className="sell-tiles" style={{gridTemplateColumns:`repeat(${showTiles?p.width:1}, 16px)`}}>
      {showTiles&&Array.from({length:p.width*p.height},(_,i)=><TileSprite key={i} tile={p.tile!+i} atlas={atlas} masked={assets.maskedTiles.src}/>)}
    </span>
    <ConditionBadge className="sell-condition" quality={p.quality} artwork={assets.sellCondition}/>
    <span className="sell-price">$ {p.value.toLocaleString('en-US')}</span>
    <span className="sale-accessible-detail">{p.name}{p.quantity!==undefined?` · Quantity ${p.quantity} · Loss ${Math.floor(p.loss!*100/65535)}%`:''}</span>
  </button>;
}
