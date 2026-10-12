import { useEffect, useRef, useState } from 'react';
import { loadSavedFarmTiles, type GameAssets } from '../assets/game-assets';
import { compressSave,readSaveFile } from '../formats/save-file';
import { GameSimulation } from '../simulation/game';
import { GameWindow } from './GameWindow';
import { FileMenu, type MenuChoices } from './FileMenu';
import { ControlBar, type GameWindow as WindowCommand } from './ControlBar';

export interface LoadedFarm { scenarioId: number | null; simulation: GameSimulation; tiles: HTMLImageElement }

export function SaveControls({ simulation, scenarioId, assets, tiles, loaded, onLoad, onNewGame, onWindow, options, disasters }: {
  options: MenuChoices; disasters: MenuChoices;
  simulation: GameSimulation; scenarioId: number | null; assets: GameAssets; tiles: CanvasImageSource | null; loaded: boolean;
  onLoad: (farm: LoadedFarm) => void;
  onNewGame: () => void; onWindow: (window: WindowCommand, source: 'menu' | 'toolbar') => void;
}) {
  const input = useRef<HTMLInputElement>(null), pending = useRef<AbortController | null>(null);
  const savingRef=useRef(false);
  const [saving,setSaving]=useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(loaded ? 'Farm loaded.' : '');
  const [fileError,setFileError]=useState<string|null>(null);
  const [chosenFilename, setChosenFilename] = useState<string | null>(null);
  const date = simulation.getSnapshot().scenario.farm.calendar;
  const filename = chosenFilename ?? `simfarm-${scenarioId === null ? simulation.getSnapshot().scenario.origin === 'generated' ? 'new-farm' : 'imported-farm' : scenarioId + 1}-${date.year}-${date.month + 1}-${date.week * 7 + date.day + 1}.simfarm.json.gz`;
  useEffect(() => () => pending.current?.abort(), []);
  async function save(name?: string): Promise<boolean> {
    if(savingRef.current)return false;
    savingRef.current=true;setSaving(true);
    setFileError(null);
    try {
      const selected = name === undefined ? filename : name.trim().replace(/(?:\.simfarm)?\.json(?:\.gz)?$/i, '') + '.simfarm.json.gz';
      if (!selected || /[/\\]/.test(selected) || (name !== undefined && !name.trim())) throw new Error('Choose a filename without directory separators.');
      const text = simulation.save(scenarioId);
      const url = URL.createObjectURL(await compressSave(text));
      const link = document.createElement('a');
      link.href = url; link.download = selected;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Farm saved to file.');
      if (name !== undefined) setChosenFilename(selected);
      return true;
    } catch (error) { const text=`Could not save farm: ${error instanceof Error ? error.message : String(error)}`;setMessage(text);if(name===undefined)setFileError(text);return false; }
    finally{savingRef.current=false;setSaving(false);}
  }
  function cancelLoad() {
    pending.current?.abort();pending.current=null;
    setBusy(false);setMessage('Loading cancelled.');
  }
  async function load(file: File) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setFileError(null);setBusy(true); setMessage('Loading farm…');
    try {
      const buffer = await readSaveFile(file,controller.signal);
      if (controller.signal.aborted) return;
      const originalFile = /\.ssm$/i.test(file.name) || buffer[0] === 0x18;
      const restored = originalFile ? simulation.importOriginal(buffer, assets.catalog.crops)
        : GameSimulation.load(new TextDecoder().decode(buffer), assets.catalog.crops, assets.townLayouts);
      const world = restored.simulation.getSnapshot().scenario;
      const tiles = await loadSavedFarmTiles(world, restored.scenarioId, controller.signal);
      if (!controller.signal.aborted) onLoad({ ...restored, tiles });
    } catch (error) {
      if (!controller.signal.aborted) {const text=`Could not load farm: ${error instanceof Error ? error.message : String(error)}`;setMessage(text);setFileError(text);}
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  return <div className="farm-file-controls">
    <div className="original-controls">
      <FileMenu about={assets.about} options={options} disasters={disasters} data={assets.mainMenus} palette={assets.catalog.palette} busy={busy||saving} filename={filename} error={message.startsWith('Could not save') ? message : null} onSave={save}
        onLoad={() => input.current?.click()} onNewGame={onNewGame} onWindow={window=>onWindow(window,'menu')}
        onQuit={() => { simulation.dispatch({ type: 'set-paused', paused: true }); setMessage('Farm paused. Save before closing this tab.'); }} />
      <ControlBar tiles={tiles} artwork={assets.controlBar} menus={assets.mainMenus} snapshot={simulation.getSnapshot()} onWindow={window=>onWindow(window,'toolbar')} />
    </div>
    <input ref={input} id="load-farm-file" type="file" accept=".ssm,.SSM,.simfarm.json,.json,.gz,application/json,application/gzip" hidden
      aria-label="Load farm file" onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (file) void load(file);
      }} />
    <span id="save-status" className="file-status" role="status">{message}</span>
    {busy&&<GameWindow windowKey="file-loading" title="Loading game" forced onClose={cancelLoad}>
      <p>Loading farm…</p>
      <button onClick={cancelLoad}>Cancel loading</button>
    </GameWindow>}
    {fileError&&<GameWindow windowKey="file-error" title="File error" forced descriptionId="file-error-text" onClose={()=>setFileError(null)}>
      <p id="file-error-text">{fileError}</p>
      <button id="file-error-ok" onClick={()=>setFileError(null)}>OK</button>
    </GameWindow>}
  </div>;
}
