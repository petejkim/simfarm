import { useState } from 'react';
import { loadGameAssets, type GameAssets } from '../assets/game-assets';
import { FarmView } from './FarmView';
import type { LoadedFarm } from './SaveControls';
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
  const [farm, setFarm] = useState<{ id: number; serial: number; loaded?: LoadedFarm }>({ id: 0, serial: 0 });
  const [zoom, setZoom] = useState(1), [cropId, setCropId] = useState('wheat');
  const music = useMusic();
  return <>
    <header>
      <div><span className="eyebrow">NATIVE PRESERVATION PROJECT</span><h1>SimFarm<span>1993</span></h1></div>
      <MusicControls tracks={assets.catalog.music} music={music} />
    </header>
    <FarmView key={farm.serial} id={farm.id} loaded={farm.loaded}
      onScenarioChange={id => setFarm(previous => ({ id, serial: previous.serial + 1 }))}
      onLoad={loaded => setFarm(previous => ({ id: loaded.scenarioId, serial: previous.serial + 1, loaded }))} assets={assets}
      zoom={zoom} onZoomChange={setZoom} cropId={cropId} onCropChange={setCropId} />
    <footer><strong>Reconstruction in progress</strong>
      <span>Loans, land purchases, field care, the farming cycle and native save/load are running. Other original systems remain in progress.</span>
      <span id="audio-status" role="status">{music.message}</span>
    </footer>
  </>;
}
