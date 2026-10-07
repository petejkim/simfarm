import { useState } from 'react';
import { loadGameAssets, type GameAssets } from '../assets/game-assets';
import { FarmView } from './FarmView';
import { MusicControls } from './MusicControls';
import { useMusic } from './useMusic';
import { useResource } from './useResource';

export function App() {
  const assets = useResource(loadGameAssets);
  if (assets.status === 'loading') return <p className="loading">Loading SimFarm…</p>;
  if (assets.status === 'error') return <div className="loading">
    <h1>SimFarm assets unavailable</h1>
    <p>{assets.error} Start with ./tools/bun run import, then ./tools/bun run dev.</p>
  </div>;
  return <Game assets={assets.value} />;
}
function Game({ assets }: { assets: GameAssets }) {
  const [scenarioId, setScenarioId] = useState(0), [zoom, setZoom] = useState(1), [cropId, setCropId] = useState('wheat');
  const music = useMusic();
  return <>
    <header>
      <div><span className="eyebrow">NATIVE PRESERVATION PROJECT</span><h1>SimFarm<span>1993</span></h1></div>
      <MusicControls tracks={assets.catalog.music} music={music} />
    </header>
    <FarmView key={scenarioId} id={scenarioId} onScenarioChange={setScenarioId} assets={assets}
      zoom={zoom} onZoomChange={setZoom} cropId={cropId} onCropChange={setCropId} />
    <footer><strong>Reconstruction in progress</strong>
      <span>Land purchases, new fields and the farming cycle are running. Save/load and other original systems remain in progress.</span>
      <span id="audio-status" role="status">{music.message}</span>
    </footer>
  </>;
}
