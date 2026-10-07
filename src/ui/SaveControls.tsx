import { useEffect, useRef, useState } from 'react';
import { loadScenarioAssets, type GameAssets } from '../assets/game-assets';
import { MAX_SAVE_BYTES } from '../formats/native-save';
import { GameSimulation } from '../simulation/game';

export interface LoadedFarm { scenarioId: number; simulation: GameSimulation; tiles: HTMLImageElement }

export function SaveControls({ simulation, scenarioId, assets, loaded, onLoad }: {
  simulation: GameSimulation; scenarioId: number; assets: GameAssets; loaded: boolean;
  onLoad: (farm: LoadedFarm) => void;
}) {
  const input = useRef<HTMLInputElement>(null), pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(loaded ? 'Farm loaded.' : '');
  useEffect(() => () => pending.current?.abort(), []);
  function save() {
    try {
      const text = simulation.save(scenarioId), date = simulation.getSnapshot().scenario.farm.calendar;
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `simfarm-${scenarioId + 1}-${date.year}-${date.month + 1}-${date.week * 7 + date.day + 1}.simfarm.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Farm saved to file.');
    } catch (error) { setMessage(`Could not save farm: ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function load(file: File) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setMessage('Loading farm…');
    try {
      if (file.size > MAX_SAVE_BYTES) throw new Error('The file is too large.');
      const text = await file.text();
      if (controller.signal.aborted) return;
      const restored = GameSimulation.load(text, assets.catalog.crops, assets.townLayouts);
      const original = await loadScenarioAssets(restored.scenarioId, controller.signal);
      const template = restored.simulation.getSnapshot().scenario.sourceBytes;
      if (template.some((byte, i) => byte !== original.scenario.sourceBytes[i])) {
        throw new Error('This farm needs different original scenario assets.');
      }
      if (!controller.signal.aborted) onLoad({ ...restored, tiles: original.tiles });
    } catch (error) {
      if (!controller.signal.aborted) setMessage(`Could not load farm: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  return <div className="save-controls">
    <div><button id="save-farm" disabled={busy} onClick={save}>Save farm</button>
      <button id="load-farm" disabled={busy} onClick={() => input.current?.click()}>Load farm</button>
      <input ref={input} id="load-farm-file" type="file" accept=".simfarm.json,.json,application/json" hidden
        aria-label="Load farm file" onChange={event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
          if (file) void load(file);
        }} /></div>
    <span id="save-status" role="status">{message}</span>
  </div>;
}
