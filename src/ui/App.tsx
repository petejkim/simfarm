import { useCallback, useState } from 'react';
import type { GameEvent } from '../simulation/events';
import { loadGameAssets, type GameAssets } from '../assets/game-assets';
import { WindowDesktop } from './GameWindow';
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
  return <WindowDesktop artwork={assets.windowArtwork} onButtonClick={sound.click}>
    <FarmView key={farm.serial} id={farm.id} loaded={farm.loaded}
      onRetry={() => setFarm(previous => ({ ...previous, serial: previous.serial + 1 }))}
      onScenarioChange={id => setFarm(previous => ({ id, serial: previous.serial + 1 }))}
      audioControls={<>
        <MusicControls tracks={assets.catalog.music} music={music} />
        <span id="audio-status" role="status">{music.message}</span>
        {sound.error && <span id="sound-error" role="status">Sound unavailable: {sound.error}</span>}
      </>}
      audioOptions={{ music: music.enabled, sound: sound.enabled, buttonClicks:sound.buttonClicks, toggleButtonClicks:sound.toggleButtonClicks, toggleMusic: () => music.toggleTrack('genfarm'), toggleSound: () => { void sound.toggle(); } }}
      onLoad={onLoad} assets={assets}
      zoom={zoom} onZoomChange={setZoom} onGameEvent={onGameEvent} onFlightRunning={sound.setFlightRunning} />
  </WindowDesktop>;
}
