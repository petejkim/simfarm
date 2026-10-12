import { useState } from 'react';
import { assetUrl, type GameAssets } from '../assets/game-assets';
import { BUY_CATEGORIES, type BuyCategory } from '../formats/buy-window';
import type { GameSnapshot } from '../simulation/game';
import { shopProduct, type ShopProduct } from '../simulation/shop-product';
import { GameWindow, useWindows } from './GameWindow';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { Sprite, spriteFace } from './chrome/Sprite';
import { TileSprite } from './chrome/TileSprite';

const title = (name: string) => name[0].toUpperCase() + name.slice(1);

/** Original Buy window (buywndo.bmp) rebuilt from shared chrome in three flex columns:
 * category buttons; photo and description insets; map-graphic preview, browse arrows, Price/Own
 * readouts and BUY/CLOSE. Category icons and arrow glyphs are sprites from the source bitmap. */
export function BuyWindow({ assets, snapshot, tiles, onBuy }: { assets: GameAssets; snapshot: GameSnapshot; tiles: HTMLImageElement; onBuy: (product: ShopProduct) => void }) {
  const windows = useWindows(), [category, setCategory] = useState<BuyCategory>('livestock'), [index, setIndex] = useState(0);
  const products = category === 'seeds' ? snapshot.scenario.cropFiles.map((_,i)=>192+i) : assets.buyCatalog.groups[category];
  const product = shopProduct(snapshot.scenario,snapshot.finances,assets.catalog.crops,assets.buyCatalog,assets.itemText,products[index] ?? products[0]);
  const blocked = Boolean(snapshot.pendingTown || snapshot.townEvent.pending || snapshot.finances.defaultDecision || snapshot.aircraftFlight);
  const art = assets.buyArtwork.src;
  function cycle(direction: number) { setIndex(value => (value+direction+products.length)%products.length); }
  return <GameWindow windowKey="buy" title="Buy" framed>
    <section className="buy-window" aria-label="Buy catalog" onKeyDown={event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); cycle(event.key === 'ArrowUp' ? 1 : -1); }
    }}>
      <div className="buy-categories">
        {BUY_CATEGORIES.map((name,i)=><BevelButton key={name} className="buy-category" shadow pressed={category===name} aria-label={title(name)} title={title(name)}
          faceStyle={spriteFace(art, 13, 9 + i * 30)} onClick={()=>{setCategory(name);setIndex(0);}} />)}
      </div>
      <div className="buy-middle">
        <SunkenInset className="buy-photo">
          <div className="buy-card" role="img" aria-label={`${product.name} illustration`}>
            {product.cropId ? <Sprite image={assetUrl(`${product.cropId}.card.png`)} x={0} y={0} width={112} height={64} />
              : product.card !== null && <Sprite image={assets.buyCards.src} x={product.card%8*112} y={Math.floor(product.card/8)*64} width={112} height={64} />}
          </div>
        </SunkenInset>
        <SunkenInset className="buy-description-box"><p id="buy-description" aria-live="polite">{product.description}</p></SunkenInset>
      </div>
      <div className="buy-side">
        <SunkenInset className="buy-preview"><ShopPreview product={product} atlas={tiles.src} masked={assets.maskedTiles.src} /></SunkenInset>
        <div className="buy-arrows">
          <BevelButton className="buy-arrow" shadow aria-label="Next item" title="Next item" faceStyle={spriteFace(art, 179, 75)} onClick={()=>cycle(1)} />
          <BevelButton className="buy-arrow" shadow aria-label="Previous item" title="Previous item" faceStyle={spriteFace(art, 210, 75)} onClick={()=>cycle(-1)} />
        </div>
        <span className="buy-label">PRICE</span>
        <SunkenInset className="buy-readout"><output id="buy-price">${product.price.toLocaleString('en-US')}</output></SunkenInset>
        <span className="buy-label">OWN</span>
        <SunkenInset className="buy-readout"><output id="buy-owned">{product.count}</output></SunkenInset>
        <div className="buy-actions">
          <BevelButton id="catalog-buy" className="buy-caption buy-caption-buy" disabled={blocked} onClick={()=>onBuy(product)}>BUY</BevelButton>
          <BevelButton className="buy-caption buy-caption-close" onClick={()=>windows.close('buy')}>CLOSE</BevelButton>
        </div>
      </div>
    </section>
  </GameWindow>;
}

/** Source 478df..479f9: a 4×3 grass backdrop (tiles 19+(x+y)%4) with the definition graphic centred on it,
 * 4px right of centre as in the source (212−width×8). Graphics larger than 4×4 tiles are not shown. */
function ShopPreview({ product, atlas, masked }: { product: ShopProduct; atlas: string; masked: string }) {
  const showItem = product.tile !== null && product.width <= 4 && product.height <= 4;
  return <div className="buy-preview-scene" role="img" aria-label={`${product.name} map graphic`}>
    <div className="buy-grass">{Array.from({ length: 12 }, (_, i) => { const x = i % 4, y = Math.floor(i / 4);
      return <TileSprite key={i} tile={19 + (x + y) % 4} atlas={atlas} masked={masked} />; })}</div>
    {showItem && <div className="buy-item" style={{ gridTemplateColumns: `repeat(${product.width}, 16px)` }}>
      {Array.from({ length: product.width * product.height }, (_, i) => <TileSprite key={i} tile={product.tile! + i} atlas={atlas} masked={masked} />)}
    </div>}
  </div>;
}
