import {useEffect,useRef,useState} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import {marketWindowView} from '../simulation/market-view';
import {drawMarketPreview} from '../render/market-preview';
import {GameWindow,useWindows} from './GameWindow';

export function MarketWindow({assets,snapshot,tiles}:{assets:GameAssets;snapshot:GameSnapshot;tiles:CanvasImageSource}){
  const windows=useWindows(),[slot,setSlot]=useState(0),[page,setPage]=useState(0),canvas=useRef<HTMLCanvasElement>(null);
  const world=snapshot.scenario,view=marketWindowView(world,snapshot.market,assets.catalog.crops,slot);
  useEffect(()=>{if(canvas.current)drawMarketPreview(canvas.current.getContext('2d')!,tiles,assets.catalog.palette,{page,cropCount:world.cropFiles.length,slot,history:view.history});},[assets,tiles,snapshot,page,slot]);
  return <GameWindow windowKey="market" title="Market Value">
    <section aria-label="Crop market">
      <div className="market-window">
        <img src={assets.marketArtwork.src} width={320} height={208} alt="" draggable={false}/>
        <canvas ref={canvas} width={320} height={208} className="market-preview" aria-label={`${view.name} price history and crop graphics`}/>
        <span className="market-label" style={{left:26,top:8,width:120}}>30 Week History</span>
        <span className="market-label" style={{left:160,top:146}}>Crop</span>
        <span className="market-label" style={{left:160,top:159}}>Price</span>
        <span className="market-label" style={{left:12,top:180}}>Futures Owned</span>
        <output id="market-crop-name" style={{left:200,top:147,width:103}}>{view.name}</output>
        <output id="market-price" style={{left:200,top:160,width:103}}>{view.price}</output>
        <output id="market-owned" style={{left:120,top:182,width:40}}>{view.futuresOwned}</output>
        {world.cropFiles.slice(page*16,page*16+16).map((file,i)=>{const crop=assets.catalog.crops.find(c=>`${c.id}.crp`===file)!;return <button key={file} data-market-crop={page*16+i}
          style={{left:176+i%4*32,top:8+Math.floor(i/4)*32,width:32,height:32}} aria-label={crop.name} title={crop.name} aria-pressed={slot===page*16+i} onClick={()=>setSlot(page*16+i)}/>;})}
        <button className="market-close" style={{left:258,top:173,width:48,height:24}} onClick={()=>windows.show(null)}>CLOSE</button>
      </div>
      <div className="market-pages" aria-label="Market crop pages">
        <button aria-label="Previous market crops" disabled={page===0} onClick={()=>setPage(page-1)}>‹</button>
        <span>{page*16+1}–{Math.min((page+1)*16,world.cropFiles.length)} of {world.cropFiles.length} crops</span>
        <button aria-label="Next market crops" disabled={(page+1)*16>=world.cropFiles.length} onClick={()=>setPage(page+1)}>›</button>
      </div>
      <table className="sale-accessible-detail" id="market-history"><caption>{view.name}: 30 weeks, oldest to newest</caption><thead><tr><th>Week</th><th>Recorded price</th></tr></thead>
        <tbody>{view.history.map((sample,i)=><tr key={i}><th>{i+1}</th><td>{sample.price??'Not recorded'}</td></tr>)}</tbody>
      </table>
    </section>
  </GameWindow>;
}
