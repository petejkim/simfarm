import {useState} from 'react';
import { WindowContents } from './GameWindow';
import type {GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import {marketWindowView} from '../simulation/market-view';
import {cropBadgeTile} from '../formats/crop-slots';
import {GameWindow,useWindows} from './GameWindow';
import {BevelButton} from './chrome/BevelButton';
import {SunkenInset} from './chrome/SunkenInset';
import {TileSprite} from './chrome/TileSprite';

/** Original Market Value window (source 4a750/4a776) rebuilt from shared chrome: the 30-week history
 * inset with CSS bars, grid and reference line; the 4×4 crop badge buttons; crop and price insets;
 * futures owned and CLOSE. All twenty-four crops show at once in a 6×4 grid (the source pages 4×4). */
export function MarketWindow(props: Parameters<typeof MarketWindowBody>[0]) {
  return <WindowContents windowKey="market"><MarketWindowBody {...props} /></WindowContents>;
}
function MarketWindowBody({assets,snapshot,tiles}:{assets:GameAssets;snapshot:GameSnapshot;tiles:HTMLImageElement}){
  const windows=useWindows(),[slot,setSlot]=useState(0);
  const world=snapshot.scenario,view=marketWindowView(world,snapshot.market,assets.catalog.crops,slot),palette=assets.catalog.palette;
  const rgb=(color:number)=>`rgb(${palette[color].join(',')})`;
  return <GameWindow windowKey="market" title="Market Value" framed>
    <section aria-label="Crop market" className="market-window">
      <div className="market-top">
        <SunkenInset className="market-history-box">
          <span className="market-label market-history-title">30 Week History</span>
          <span className="market-graph" role="img" aria-label={`${view.name} price history`}>
            <span className="market-bars">{view.history.map((sample,i)=><span key={i} style={{height:sample.top===null?0:160-sample.top,background:rgb(3)}}/>)}</span>
            <span className="market-grid"/>
            <span className="market-reference" style={{background:rgb(1)}}/>
          </span>
        </SunkenInset>
        <div className="market-side">
          <SunkenInset className="market-crops" role="group" aria-label="Market crops">
            {world.cropFiles.map((file,n)=>{const crop=assets.catalog.crops.find(c=>`${c.id}.crp`===file)!;
              return <button key={file} type="button" className="market-crop" data-market-crop={n} aria-label={crop.name} title={crop.name} aria-pressed={slot===n} onClick={()=>setSlot(n)}>
                <span className="market-badge">{[0,1,2,3].map(part=><TileSprite key={part} tile={cropBadgeTile(n,part)} atlas={tiles.src} masked={assets.maskedTiles.src}/>)}</span>
                {slot===n&&<span className="market-selection" style={{borderColor:rgb(8)}}/>}
              </button>;})}
          </SunkenInset>
          <div className="market-field"><span className="market-label">Crop</span><SunkenInset className="market-value-box"><output id="market-crop-name">{view.name}</output></SunkenInset></div>
          <div className="market-field"><span className="market-label">Price</span><SunkenInset className="market-value-box"><output id="market-price">{view.price}</output></SunkenInset></div>
        </div>
      </div>
      <div className="market-bottom">
        <span className="market-label">Futures Owned</span>
        <SunkenInset className="market-owned-box"><output id="market-owned">{view.futuresOwned}</output></SunkenInset>
        <BevelButton className="market-close" shadow onClick={()=>windows.close('market')}>CLOSE</BevelButton>
      </div>
      <table className="sale-accessible-detail" id="market-history"><caption>{view.name}: 30 weeks, oldest to newest</caption><thead><tr><th>Week</th><th>Recorded price</th></tr></thead>
        <tbody>{view.history.map((sample,i)=><tr key={i}><th>{i+1}</th><td>{sample.price??'Not recorded'}</td></tr>)}</tbody>
      </table>
    </section>
  </GameWindow>;
}
