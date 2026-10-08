import { useEffect, useRef, useState } from 'react';
import { loadGeneratedTiles, loadNewFarmAssets, type GameAssets } from '../assets/game-assets';
import { GameSimulation } from '../simulation/game';
import type { NewFarmOptions } from '../simulation/new-farm-state';
import type { LoadedFarm } from './SaveControls';

export function NewFarmControls({ assets, open, onOpenChange, onCreate }: {
  assets: GameAssets; open: boolean; onOpenChange: (open: boolean) => void; onCreate: (farm: LoadedFarm) => void;
}) {
  const [options, setOptions] = useState<NewFarmOptions>(() => {
    const date = new Date();
    return { climate: { precipitation: 2, temperature: 2, wind: 1 }, river: true, lake: false,
      date: { year: date.getFullYear(), dayOfWeek: date.getDay() }, seeds: { visual: 9029, simulation: 9029, bounded: 9029 } };
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) { setBusy(false); setError(''); heading.current?.focus(); }
    return () => { pending.current?.abort(); pending.current = null; };
  }, [open]);
  async function create() {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try {
      const setup = await loadNewFarmAssets(assets, controller.signal);
      controller.signal.throwIfAborted();
      const simulation = GameSimulation.createNew(options, setup);
      const tiles = await loadGeneratedTiles(simulation.getSnapshot().scenario.cropFiles, controller.signal);
      if (!controller.signal.aborted) { onCreate({ scenarioId: null, simulation, tiles }); onOpenChange(false); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  if (!open) return <div className="new-farm-action"><button id="new-farm" onClick={() => { setBusy(false); setError(''); onOpenChange(true); }}>New farm</button></div>;
  return <section className="new-farm-panel" aria-label="New farm">
    <h2 ref={heading} tabIndex={-1}>Create a new farm</h2>
    <p>Start with $40,000, a homestead and nine plots of land. Creating a farm replaces the current session; save it first if you want to keep it.</p>
    <form onSubmit={event => { event.preventDefault(); if (!busy) void create(); }}>
      <fieldset disabled={busy}><legend>Landscape and climate</legend>
        {(['precipitation', 'temperature', 'wind'] as const).map((channel, i) => <label key={channel}>
          {['Rainfall', 'Temperature', 'Wind'][i]} <select id={`new-farm-${channel}`} value={options.climate[channel]}
            onChange={e => setOptions(o => ({ ...o, climate: { ...o.climate, [channel]: Number(e.target.value) } }))}>
            {[0, 1, 2, 3].map(level => <option key={level} value={level}>{['Low', 'Moderate', 'High', 'Very high'][level]}</option>)}
          </select></label>)}
        <label><input id="new-farm-river" type="checkbox" checked={options.river} onChange={e => setOptions(o => ({ ...o, river: e.target.checked }))} /> River</label>
        <label><input id="new-farm-lake" type="checkbox" checked={options.lake} onChange={e => setOptions(o => ({ ...o, lake: e.target.checked }))} /> Lake</label>
        <label>Map seed <input id="new-farm-seed" type="number" min="1" max="65535" step="1" required value={options.seeds.simulation}
          onChange={e => { const seed = Number(e.target.value); setOptions(o => ({ ...o, seeds: { visual: seed, simulation: seed, bounded: seed } })); }} /></label>
        <label>Starting year <input id="new-farm-year" type="number" min="1" max="65535" step="1" required value={options.date.year}
          onChange={e => setOptions(o => ({ ...o, date: { ...o.date, year: Number(e.target.value) } }))} /></label>
      </fieldset>
      <p>The same seed and settings recreate the same terrain. Your farm starts in April.</p>
      <button id="create-farm" disabled={busy}>{busy ? 'Creating farm…' : 'Create farm'}</button>{' '}
      <button type="button" onClick={() => onOpenChange(false)}>Cancel</button>
      {error && <p id="new-farm-error" role="alert">Could not create farm: {error}</p>}
    </form>
  </section>;
}
