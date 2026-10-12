import { useCallback, useEffect, useState } from 'react';
import type { GameEvent } from '../simulation/events';
import { loadGameAssets, type GameAssets } from '../assets/game-assets';
import { WindowDesktop } from './GameWindow';
import { FarmView } from './FarmView';
import type { LoadedFarm } from './SaveControls';
import { MusicControls } from './MusicControls';
import { useMusic } from './useMusic';
import { useSound } from './useSound';
import { useResource } from './useResource';
import { Autosave } from '../storage/autosave';
import { restoreStoredGame } from '../storage/restore';

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
  // The browser-stored current game is restored (paused) before the first farm mounts; otherwise Scenario 1.
  const [autosave] = useState(() => new Autosave());
  useEffect(() => autosave.connect(), [autosave]);
  const [farm, setFarm] = useState<{ id: number | null; serial: number; loaded?: LoadedFarm; autosaveNow: boolean; notice?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void restoreStoredGame(autosave, assets, controller.signal).then(({ farm: restored, notice }) => {
      if (!controller.signal.aborted) setFarm(restored ? { id: restored.scenarioId, serial: 1, loaded: restored, autosaveNow: false, notice: 'Saved farm restored (paused).' }
        : { id: 0, serial: 0, autosaveNow: false, notice });
    });
    return () => controller.abort();
  }, [autosave, assets]);
  // New Game and Load from File replace the current game and save it immediately.
  const onLoad = (loaded: LoadedFarm) => setFarm(previous => ({ id: loaded.scenarioId, serial: (previous?.serial ?? 0) + 1, loaded, autosaveNow: true }));
  const [zoom, setZoom] = useState(1);
  const music = useMusic();
  const sound = useSound();
  const onGameEvent = useCallback((event: GameEvent) => {
    if (event.type === 'music') music.requestTrack(event.track);
    else if(event.type==='sound') sound.play(event.sound);
  }, [music.requestTrack, sound.play]);
  if (!farm) return <p className="loading">Loading SimFarm…</p>;
  return <WindowDesktop artwork={assets.windowArtwork} onButtonClick={sound.click}>
    <FarmView key={farm.serial} id={farm.id} loaded={farm.loaded} autosave={autosave} autosaveNow={farm.autosaveNow} startMessage={farm.notice}
      onRetry={() => setFarm(previous => previous && ({ ...previous, serial: previous.serial + 1 }))}
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
