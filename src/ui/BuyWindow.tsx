import { useEffect, useRef, useState } from 'react';
import { assetUrl, type GameAssets } from '../assets/game-assets';
import { BUY_CATEGORIES, type BuyCategory } from '../formats/buy-window';
import type { GameSnapshot } from '../simulation/game';
import { shopProduct, type ShopProduct } from '../simulation/shop-product';
import { drawShopPreview } from '../render/shop-preview';
import { GameWindow, useWindows } from './GameWindow';

export function BuyWindow({ assets, snapshot, tiles, onBuy }: { assets: GameAssets; snapshot: GameSnapshot; tiles: CanvasImageSource; onBuy: (product: ShopProduct) => void }) {
  const windows = useWindows(), [category, setCategory] = useState<BuyCategory>('livestock'), [index, setIndex] = useState(0);
  const products = category === 'seeds' ? snapshot.scenario.cropFiles.map((_,i)=>192+i) : assets.buyCatalog.groups[category];
  const product = shopProduct(snapshot.scenario,snapshot.finances,assets.catalog.crops,assets.buyCatalog,assets.itemText,products[index] ?? products[0]);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) drawShopPreview(canvas.current.getContext('2d')!,product,tiles,assets.maskedTiles); }, [product.type, product.tile, product.width, product.height, tiles, assets.maskedTiles]);
  const blocked = Boolean(snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight);
  function cycle(direction: number) { setIndex(value => (value+direction+products.length)%products.length); }
  return <GameWindow windowKey="buy" title="Buy">
    <section className="buy-window" aria-label="Buy catalog" onKeyDown={event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); cycle(event.key === 'ArrowUp' ? 1 : -1); }
    }}>
      <img src={assets.buyArtwork.src} width="256" height="224" alt="" draggable={false} />
      <canvas ref={canvas} className="buy-preview" width={256} height={224} aria-label={`${product.name} map graphic`} />
      <div className="buy-card" role="img" aria-label={`${product.name} illustration`}>
        {product.cropId ? <img src={assetUrl(`${product.cropId}.card.png`)} alt="" /> : product.card !== null && <img src={assets.buyCards.src} alt="" style={{ left: -(product.card%8)*112, top:-Math.floor(product.card/8)*64 }} />}
      </div>
      <p id="buy-description" aria-live="polite">{product.description}</p>
      {BUY_CATEGORIES.map((name,i)=><button key={name} className="buy-category" style={{top:6+i*30}} aria-label={name[0].toUpperCase()+name.slice(1)} title={name[0].toUpperCase()+name.slice(1)} aria-pressed={category===name}
        onClick={()=>{setCategory(name);setIndex(0);}} />)}
      <button className="buy-arrow" style={{left:176}} aria-label="Next item" title="Next item" onClick={()=>cycle(1)} />
      <button className="buy-arrow" style={{left:207}} aria-label="Previous item" title="Previous item" onClick={()=>cycle(-1)} />
      <span className="buy-label" style={{top:110}}>PRICE</span><output id="buy-price" style={{top:128}}>${product.price.toLocaleString('en-US')}</output>
      <span className="buy-label" style={{top:142}}>OWN</span><output id="buy-owned" style={{top:160}}>{product.count}</output>
      <button id="catalog-buy" className="buy-caption" style={{left:168,width:32}} disabled={blocked} onClick={()=>onBuy(product)}>BUY</button>
      <button className="buy-caption" style={{left:200,width:48}} onClick={()=>windows.close('buy')}>CLOSE</button>
    </section>
  </GameWindow>;
}
