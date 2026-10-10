import { useCallback, useState } from 'react';
import type { GameEvent } from '../simulation/events';
import { loadGameAssets, type GameAssets } from '../assets/game-assets';
import { WindowDesktop, GameWindow } from './GameWindow';
import { FarmView } from './FarmView';
import type { LoadedFarm } from './SaveControls';
import { MusicControls } from './MusicControls';
import { useMusic } from './useMusic';
import { useSound } from './useSound';
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
  const [farm, setFarm] = useState<{ id: number | null; serial: number; loaded?: LoadedFarm }>({ id: 0, serial: 0 });
  const onLoad = (loaded: LoadedFarm) => setFarm(previous => ({ id: loaded.scenarioId, serial: previous.serial + 1, loaded }));
  const [zoom, setZoom] = useState(1);
  const music = useMusic();
  const sound = useSound();
  const onGameEvent = useCallback((event: GameEvent) => {
    if (event.type === 'music') music.requestTrack(event.track);
    else if(event.type==='sound') sound.play(event.sound);
  }, [music.requestTrack, sound.play]);
  return <WindowDesktop artwork={assets.windowArtwork}>
    <FarmView key={farm.serial} id={farm.id} loaded={farm.loaded}
      onScenarioChange={id => setFarm(previous => ({ id, serial: previous.serial + 1 }))}
      audioControls={<header>
        <MusicControls tracks={assets.catalog.music} music={music} />
        <button id="sound-toggle" aria-pressed={sound.enabled} onClick={() => void sound.toggle()}>{sound.enabled ? 'Mute sounds' : 'Enable sounds'}</button>
      </header>}
      onLoad={onLoad} assets={assets}
      zoom={zoom} onZoomChange={setZoom} onGameEvent={onGameEvent} onFlightRunning={sound.setFlightRunning} />
    <GameWindow windowKey="about-project" title="Preservation progress"><footer><strong>Reconstruction in progress</strong>
      <span>Loans, land purchases, field care, the farming cycle and native save/load are running. Other original systems remain in progress.</span>
      <span id="audio-status" role="status">{music.message}</span>
      {sound.error && <span id="sound-error" role="status">Sound unavailable: {sound.error}</span>}
    </footer></GameWindow>
  </WindowDesktop>;
}
