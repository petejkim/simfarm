import { useEffect, useRef, useState } from 'react';
import { loadSavedFarmTiles, type GameAssets } from '../assets/game-assets';
import { MAX_SAVE_BYTES } from '../formats/native-save';
import { GameSimulation } from '../simulation/game';
import { FileMenu } from './FileMenu';
import { ControlBar, type GameWindow } from './ControlBar';

export interface LoadedFarm { scenarioId: number | null; simulation: GameSimulation; tiles: HTMLImageElement }

export function SaveControls({ simulation, scenarioId, assets, loaded, onLoad, onNewGame, onWindow }: {
  simulation: GameSimulation; scenarioId: number | null; assets: GameAssets; loaded: boolean;
  onLoad: (farm: LoadedFarm) => void;
  onNewGame: () => void; onWindow: (window: GameWindow) => void;
}) {
  const input = useRef<HTMLInputElement>(null), pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(loaded ? 'Farm loaded.' : '');
  const [chosenFilename, setChosenFilename] = useState<string | null>(null);
  const date = simulation.getSnapshot().scenario.farm.calendar;
  const filename = chosenFilename ?? `simfarm-${scenarioId === null ? simulation.getSnapshot().scenario.origin === 'generated' ? 'new-farm' : 'imported-farm' : scenarioId + 1}-${date.year}-${date.month + 1}-${date.week * 7 + date.day + 1}.simfarm.json`;
  useEffect(() => () => pending.current?.abort(), []);
  function save(name?: string): boolean {
    try {
      const selected = name === undefined ? filename : name.trim().replace(/(?:\.simfarm)?\.json$/i, '') + '.simfarm.json';
      if (!selected || /[/\\]/.test(selected) || (name !== undefined && !name.trim())) throw new Error('Choose a filename without directory separators.');
      const text = simulation.save(scenarioId);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = selected;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Farm saved to file.');
      if (name !== undefined) setChosenFilename(selected);
      return true;
    } catch (error) { setMessage(`Could not save farm: ${error instanceof Error ? error.message : String(error)}`); return false; }
  }
  async function load(file: File) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setMessage('Loading farm…');
    try {
      if (file.size > MAX_SAVE_BYTES) throw new Error('The file is too large.');
      const buffer = new Uint8Array(await file.arrayBuffer());
      if (controller.signal.aborted) return;
      const originalFile = /\.ssm$/i.test(file.name) || buffer[0] === 0x18;
      const restored = originalFile ? simulation.importOriginal(buffer, assets.catalog.crops)
        : GameSimulation.load(new TextDecoder().decode(buffer), assets.catalog.crops, assets.townLayouts);
      const world = restored.simulation.getSnapshot().scenario;
      const tiles = await loadSavedFarmTiles(world, restored.scenarioId, controller.signal);
      if (!controller.signal.aborted) onLoad({ ...restored, tiles });
    } catch (error) {
      if (!controller.signal.aborted) setMessage(`Could not load farm: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  return <div className="farm-file-controls">
    <div className="original-controls">
      <FileMenu data={assets.mainMenus} palette={assets.catalog.palette} busy={busy} filename={filename} error={message.startsWith('Could not save') ? message : null} onSave={save}
        onLoad={() => input.current?.click()} onNewGame={onNewGame} onWindow={onWindow}
        onQuit={() => { simulation.dispatch({ type: 'set-paused', paused: true }); setMessage('Farm paused. Save before closing this tab.'); }} />
      <ControlBar artwork={assets.controlBar} menus={assets.mainMenus} snapshot={simulation.getSnapshot()} onWindow={onWindow} />
    </div>
    <div className="save-controls"><div><button id="save-farm" disabled={busy} onClick={() => save()}>Save farm</button>
      <button id="load-farm" disabled={busy} onClick={() => input.current?.click()}>Load farm</button>
      <input ref={input} id="load-farm-file" type="file" accept=".ssm,.SSM,.simfarm.json,.json,application/json" hidden
        aria-label="Load farm file" onChange={event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
          if (file) void load(file);
        }} /></div>
    <span id="save-status" role="status">{message}</span>
    </div>
  </div>;
}
