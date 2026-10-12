import { useEffect, useRef, useState } from 'react';
import { loadSavedFarmTiles, type GameAssets } from '../assets/game-assets';
import { compressSave,readSaveFile } from '../formats/save-file';
import { GameSimulation } from '../simulation/game';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { GameWindow } from './GameWindow';
import { FileMenu, type MenuChoices } from './FileMenu';
import { ControlBar, type GameWindow as WindowCommand } from './ControlBar';
import type { SaveOutcome } from '../storage/autosave';

// File System Access pickers (Chromium). Elsewhere the download link and file input are used.
type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: object) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
  showOpenFilePicker?: (options: object) => Promise<{ getFile(): Promise<File> }[]>;
};
const SAVE_TYPES = [{ description: 'SimFarm save', accept: { 'application/gzip': ['.gz'] } }];
const LOAD_TYPES = [{ description: 'SimFarm save or original scenario', accept: { 'application/gzip': ['.gz'], 'application/json': ['.json'], 'application/octet-stream': ['.ssm', '.SSM'] } }];
const cancelled = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

export interface LoadedFarm { scenarioId: number | null; simulation: GameSimulation; tiles: HTMLImageElement }

export function SaveControls({ simulation, scenarioId, assets, tiles, loaded, startMessage, onLoad, onSaveGame, onNewGame, onWindow, options, disasters, debug }: {
  options: MenuChoices; disasters: MenuChoices; debug: MenuChoices;
  simulation: GameSimulation; scenarioId: number | null; assets: GameAssets; tiles: HTMLImageElement | null; loaded: boolean; startMessage?: string;
  onLoad: (farm: LoadedFarm) => void; onSaveGame: () => Promise<SaveOutcome>;
  onNewGame: () => void; onWindow: (window: WindowCommand, source: 'menu' | 'toolbar') => void;
}) {
  const input = useRef<HTMLInputElement>(null), pending = useRef<AbortController | null>(null);
  const savingRef=useRef(false);
  const [saving,setSaving]=useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(startMessage ?? (loaded ? 'Farm loaded.' : ''));
  const [fileError,setFileError]=useState<string|null>(null);
  const date = simulation.getSnapshot().scenario.farm.calendar;
  const filename = `simfarm-${scenarioId === null ? simulation.getSnapshot().scenario.origin === 'generated' ? 'new-farm' : 'imported-farm' : scenarioId + 1}-${date.year}-${date.month + 1}-${date.week * 7 + date.day + 1}.simfarm.json.gz`;
  useEffect(() => () => pending.current?.abort(), []);
  /** File → Save: the IndexedDB current-game slot. */
  async function saveGame(): Promise<boolean> {
    const outcome = await onSaveGame();
    setMessage(outcome.ok ? 'Farm saved.' : outcome.reason === 'other-tab' ? 'Another SimFarm tab is saving this farm.'
      : outcome.reason === 'unavailable' ? 'Saving is unavailable in this browser.' : `Could not save farm: ${outcome.error}`);
    return outcome.ok;
  }
  /** File → Save to File...: a save-file dialog where supported, otherwise a browser download. */
  async function save(): Promise<boolean> {
    if(savingRef.current)return false;
    savingRef.current=true;setSaving(true);
    setFileError(null);
    try {
      const picker = (window as FilePickerWindow).showSaveFilePicker;
      // Open the dialog first, while the menu click still counts as user activation.
      const handle = picker ? await picker({ suggestedName: filename, types: SAVE_TYPES }) : null;
      const blob = await compressSave(simulation.save(scenarioId));
      if (handle) { const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); }
      else {
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage('Farm saved to file.');
      return true;
    } catch (error) {
      if (cancelled(error)) { setMessage('Save to file cancelled.'); return false; }
      const text=`Could not save farm: ${error instanceof Error ? error.message : String(error)}`;setMessage(text);setFileError(text);return false;
    }
    finally{savingRef.current=false;setSaving(false);}
  }
  /** File → Load from File...: an open-file dialog where supported, otherwise the file input. */
  async function chooseFile() {
    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) { input.current?.click(); return; }
    try { const [handle] = await picker({ types: LOAD_TYPES, multiple: false }); if (handle) void load(await handle.getFile()); }
    catch (error) { if (!cancelled(error)) setMessage(`Could not open file: ${error instanceof Error ? error.message : String(error)}`); }
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
      <FileMenu debug={debug} about={assets.about} options={options} disasters={disasters} data={assets.mainMenus} busy={busy||saving} onSave={saveGame} onSaveToFile={save}
        onLoad={() => void chooseFile()} onNewGame={onNewGame} onWindow={window=>onWindow(window,'menu')} />
      <ControlBar tiles={tiles} artwork={assets.controlBar} expertFace={assets.expertLauncher} timeToggle={assets.timeToggle} menus={assets.mainMenus} snapshot={simulation.getSnapshot()} onWindow={window=>onWindow(window,'toolbar')}
        onTogglePause={()=>simulation.dispatch({ type: 'set-paused', paused: !simulation.getSnapshot().paused })} />
    </div>
    <input ref={input} id="load-farm-file" type="file" accept=".ssm,.SSM,.simfarm.json,.json,.gz,application/json,application/gzip" hidden
      aria-label="Load farm file" onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (file) void load(file);
      }} />
    <span id="save-status" className="file-status" role="status">{message}</span>
    {busy&&<GameWindow windowKey="file-loading" title="Loading game" forced framed onClose={cancelLoad}>
      <section className="native-window native-dialog" aria-label="Loading farm">
        <SunkenInset as="div" className="native-status"><span role="status">Loading farm…</span></SunkenInset>
        <div className="native-actions"><BevelButton className="native-button" onClick={cancelLoad}>Cancel loading</BevelButton></div>
      </section>
    </GameWindow>}
    {fileError&&<GameWindow windowKey="file-error" title="File error" forced framed descriptionId="file-error-text" onClose={()=>setFileError(null)}>
      <section className="native-window native-dialog" aria-label="File error">
        <SunkenInset as="div" className="native-status"><p id="file-error-text">{fileError}</p></SunkenInset>
        <div className="native-actions"><BevelButton id="file-error-ok" className="native-button" onClick={()=>setFileError(null)}>OK</BevelButton></div>
      </section>
    </GameWindow>}
  </div>;
}
