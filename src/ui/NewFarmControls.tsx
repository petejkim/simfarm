import { climateForSetup } from '../formats/new-farm';
import { useEffect, useRef, useState } from 'react';
import { loadGeneratedTiles, loadNewFarmAssets, loadRegionAssets, loadScenarioAssets, type GameAssets, type RegionAssets } from '../assets/game-assets';
import { GameSimulation } from '../simulation/game';
import type { NewFarmOptions } from '../simulation/new-farm-state';
import type { LoadedFarm } from './SaveControls';
import { RegionMap } from './RegionMap';

export function NewFarmControls({ assets, simulation: current, open, onOpenChange, onCreate }: {
  assets: GameAssets; simulation: GameSimulation; open: boolean; onOpenChange: (open: boolean) => void; onCreate: (farm: LoadedFarm) => void;
}) {
  const [session, setSession] = useState<'restart' | 'fresh'>('restart');
  const [options, setOptions] = useState<NewFarmOptions>(() => {
    const date = new Date();
    return { climate: { precipitation: 2, temperature: 2, wind: 1 }, river: true, lake: false,
      date: { year: date.getFullYear(), dayOfWeek: date.getDay() }, seeds: { visual: 9029, simulation: 9029, bounded: 9029 } };
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [regionMode, setRegionMode] = useState(false), [region, setRegion] = useState<RegionAssets | null>(null);
  const [selected, setSelected] = useState(0), [regionError, setRegionError] = useState('');
  const regionPending = useRef<AbortController | null>(null);
  const pending = useRef<AbortController | null>(null), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) { setBusy(false); setError(''); setRegionMode(false); setRegion(null); setRegionError(''); heading.current?.focus(); }
    return () => { pending.current?.abort(); pending.current = null; regionPending.current?.abort(); };
  }, [open]);
  const location = regionMode && region ? region.locations[selected] : null;
  const preset = location && region ? region.farms.find(f => f.x === location.x && f.y === location.y) : undefined;
  const missingHistory = session === 'restart' && !preset && current.getSnapshot().setup.terrainHistory === null;
  function selectRegion(index: number, map = region) {
    const p = map?.locations[index]; if (!p?.selectable) return;
    setSelected(index); setError('');
    setOptions(o => ({ ...o, climate: { precipitation: p.precipitation, temperature: p.temperature, wind: p.wind } }));
  }
  async function chooseRegion() {
    regionPending.current?.abort(); const controller = new AbortController(); regionPending.current = controller;
    setRegionMode(true); setRegion(null); setRegionError('');
    try {
      const map = await loadRegionAssets(controller.signal);
      if (!controller.signal.aborted) { setRegion(map); selectRegion(map.initialLocation.y * 18 + map.initialLocation.x, map); }
    } catch (cause) { if (!controller.signal.aborted) setRegionError(cause instanceof Error ? cause.message : String(cause)); }
  }
  function designOwn() {
    regionPending.current?.abort(); setRegionMode(false); setRegion(null); setRegionError(''); setError('');
  }
  async function create() {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try {
      if (preset) {
        const [farm, setup] = await Promise.all([loadScenarioAssets(preset.id, controller.signal), loadNewFarmAssets(assets, controller.signal)]);
        controller.signal.throwIfAborted();
        const simulation = session === 'restart'
          ? current.restartRegion(farm.scenario.sourceBytes!, options.climate, setup)
          : GameSimulation.openRegion(farm.scenario, assets.catalog.crops, assets.townLayouts, climateForSetup(setup.climate, options.climate));
        if (!controller.signal.aborted) { onCreate({ scenarioId: preset.id, simulation, tiles: farm.tiles }); onOpenChange(false); }
        return;
      }
      const setup = await loadNewFarmAssets(assets, controller.signal);
      const tiles = await loadGeneratedTiles(setup.records.cropFiles, controller.signal);
      controller.signal.throwIfAborted();
      const simulation = session === 'restart' ? current.restartGenerated(options, setup) : GameSimulation.createNew(options, setup);
      if (!controller.signal.aborted) { onCreate({ scenarioId: null, simulation, tiles }); onOpenChange(false); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  if (!open) return <div className="new-farm-action"><button id="new-farm" onClick={() => { setBusy(false); setError(''); onOpenChange(true); }}>New farm</button></div>;
  return <section className="new-farm-panel" aria-label="New farm">
    <h2 ref={heading} tabIndex={-1}>Choose a farm</h2>
    <p>Choose an original region or design your own farm. Starting a farm replaces the current session; save it first if you want to keep it.</p>
    <form onSubmit={event => { event.preventDefault(); if (!busy && !missingHistory && (!regionMode || region)) void create(); }}>
      <label>Session <select id="new-farm-session" value={session} disabled={busy} onChange={e => setSession(e.target.value as 'restart' | 'fresh')}>
        <option value="restart">Restart current session</option><option value="fresh">Start fresh session</option>
      </select></label>
      <p>Restart keeps ongoing weather and financial history, as in the original game. Start fresh resets that history and lets you choose a map seed.</p>
      <div className="region-mode">
        <button id="choose-region" type="button" disabled={busy} aria-pressed={regionMode} onClick={() => void chooseRegion()}>Use region map</button>{' '}
        <button id="design-farm" type="button" disabled={busy} aria-pressed={!regionMode} onClick={designOwn}>Design your own</button>
      </div>
      {regionMode && <div className="region-chooser">
        {region ? <>
          <RegionMap assets={region} selected={selected} disabled={busy} onSelect={selectRegion} />
          <div className="region-description">
            <p id="region-map-help">Choose a location. Numbered squares open original farms. Arrow keys move across selectable regions; Home and End jump to the first or last.</p>
            <p id="region-selection" role="status">Region {location!.x + 1}, {location!.y + 1} · {preset ? `Scenario ${preset.id + 1}` : 'New farm'}</p>
            <p>{preset ? 'Uses this region’s climate, starts with $40,000 and rebuilds the starting town. The saved date is retained.' : 'Start with $40,000, a homestead and nine plots, using this region’s climate.'}</p>
          </div>
        </> : regionError ? <p id="region-error" role="alert">Could not load regions: {regionError} Use region map to retry, or Design your own.</p> : <p role="status">Loading regions…</p>}
      </div>}
      <fieldset disabled={busy || Boolean(preset)}><legend>{preset ? 'Region climate · other settings apply only to new farms' : 'Landscape and climate'}</legend>
        {(['precipitation', 'temperature', 'wind'] as const).map((channel, i) => <label key={channel}>
          {['Rainfall', 'Temperature', 'Wind'][i]} <select id={`new-farm-${channel}`} value={options.climate[channel]} disabled={regionMode}
            onChange={e => setOptions(o => ({ ...o, climate: { ...o.climate, [channel]: Number(e.target.value) } }))}>
            {[0, 1, 2, 3].map(level => <option key={level} value={level}>{['Low', 'Moderate', 'High', 'Very high'][level]}</option>)}
          </select></label>)}
        <label><input id="new-farm-river" type="checkbox" checked={options.river} onChange={e => setOptions(o => ({ ...o, river: e.target.checked }))} /> River</label>
        <label><input id="new-farm-lake" type="checkbox" checked={options.lake} onChange={e => setOptions(o => ({ ...o, lake: e.target.checked }))} /> Lake</label>
        <label>Map seed <input id="new-farm-seed" type="number" min="1" max="65535" step="1" required disabled={session === 'restart'} value={options.seeds.simulation}
          onChange={e => { const seed = Number(e.target.value); setOptions(o => ({ ...o, seeds: { visual: seed, simulation: seed, bounded: seed } })); }} /></label>
        <label>Starting year <input id="new-farm-year" type="number" min="1" max="65535" step="1" required value={options.date.year}
          onChange={e => setOptions(o => ({ ...o, date: { ...o.date, year: Number(e.target.value) } }))} /></label>
      </fieldset>
      {!preset && <p>{session === 'fresh' ? 'The same seed and settings recreate the same terrain. ' : 'Restart generates a new landscape from the current session. '}Your farm starts in April with $40,000.</p>}
      {missingHistory && <p id="restart-unavailable" role="status">This older save cannot generate a restart map. Choose a numbered farm or Start fresh session.</p>}
      <button id="create-farm" disabled={busy || missingHistory || (regionMode && !region)}>{busy ? 'Starting farm…' : preset ? `Open Scenario ${preset.id + 1}` : 'Create farm'}</button>{' '}
      <button type="button" onClick={() => { pending.current?.abort(); regionPending.current?.abort(); onOpenChange(false); }}>Cancel</button>
      {error && <p id="new-farm-error" role="alert">Could not create farm: {error}</p>}
    </form>
  </section>;
}
