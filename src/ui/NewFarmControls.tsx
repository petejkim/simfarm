import {applyPreferredOptions} from './preferences';
import { useEffect, useRef, useState } from 'react';
import { loadGeneratedTiles, loadSavedFarmTiles, loadNewFarmAssets, loadRegionAssets, loadScenarioAssets, loadTerrainPreviewAssets, type TerrainPreviewAssets, type GameAssets, type RegionAssets } from '../assets/game-assets';
import { GameSimulation } from '../simulation/game';
import { CustomFarmSetup } from '../simulation/custom-farm-setup';
import { writeNativeSave, MAX_SAVE_BYTES } from '../formats/native-save';
import type { NewFarmOptions } from '../simulation/new-farm-state';
import type { LoadedFarm } from './SaveControls';
import { RegionMap } from './RegionMap';
import { TerrainDesign } from './TerrainDesign';

/** Browser setup defaults are independent of the simulation's saved RNG streams. */
function randomSetupSeeds(): NewFarmOptions['seeds'] {
  const value = new Uint16Array(1);
  do { crypto.getRandomValues(value); } while (value[0] === 0);
  return { visual: value[0], simulation: value[0], bounded: value[0] };
}

export function NewFarmControls({ assets, simulation: current, open, onOpenChange, onCreate }: {
  assets: GameAssets; simulation: GameSimulation; open: boolean; onOpenChange: (open: boolean) => void; onCreate: (farm: LoadedFarm) => void;
}) {
  const [options, setOptions] = useState<NewFarmOptions>(() => {
    const date = new Date();
    return { climate: { precipitation: 2, temperature: 2, wind: 1 }, river: true, lake: false,
      date: { year: date.getFullYear(), dayOfWeek: date.getDay() }, seeds: randomSetupSeeds() };
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [draft, setDraft] = useState<{ setup: CustomFarmSetup; artwork: TerrainPreviewAssets; tiles: HTMLImageElement } | null>(null);
  const [region, setRegion] = useState<RegionAssets | null>(null);
  const [selected, setSelected] = useState(0), [regionError, setRegionError] = useState('');
  const regionPending = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null), form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (open) { setOptions(o => ({...o, seeds: randomSetupSeeds()})); setDraft(null); setBusy(false); setError(''); void chooseRegion(); }
    return () => { pending.current?.abort(); pending.current = null; regionPending.current?.abort(); };
  }, [open]);
  const location = region ? region.locations[selected] : null;
  const preset = location && region ? region.farms.find(f => f.x === location.x && f.y === location.y) : undefined;
  function selectRegion(index: number, map = region) {
    const p = map?.locations[index]; if (!p?.selectable) return;
    setSelected(index); setError('');
    setOptions(o => ({ ...o, climate: { precipitation: p.precipitation, temperature: p.temperature, wind: p.wind } }));
  }
  async function chooseRegion() {
    regionPending.current?.abort(); const controller = new AbortController(); regionPending.current = controller;
    setRegion(null); setRegionError('');
    try {
      const map = await loadRegionAssets(controller.signal);
      if (!controller.signal.aborted) { setRegion(map); selectRegion(map.initialLocation.y * 18 + map.initialLocation.x, map); }
    } catch (cause) { if (!controller.signal.aborted) setRegionError(cause instanceof Error ? cause.message : String(cause)); }
  }
  async function create(custom = false) {
    if (custom) regionPending.current?.abort();
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try {
      if (preset && !custom) {
        const [farm, setup] = await Promise.all([loadScenarioAssets(preset.id, controller.signal), loadNewFarmAssets(assets, controller.signal)]);
        controller.signal.throwIfAborted();
        const simulation = GameSimulation.openGeographicRegion(farm.scenario.sourceBytes!, options.climate, options.seeds, setup, 'selected-climate');
        if (!controller.signal.aborted) { applyPreferredOptions(simulation);onCreate({ scenarioId: preset.id, simulation, tiles: farm.tiles }); onOpenChange(false); }
        return;
      }
      const setup = await loadNewFarmAssets(assets, controller.signal);
      const [tiles, artwork] = await Promise.all([loadGeneratedTiles(setup.records.cropFiles, controller.signal),
        !custom ? Promise.resolve(null) : loadTerrainPreviewAssets(controller.signal)]);
      controller.signal.throwIfAborted();
      if (artwork) {
        const preview = CustomFarmSetup.fresh(options, setup);
        setDraft({ setup: preview, artwork, tiles }); return;
      }
      const simulation = GameSimulation.createGeographic(options, setup, 'selected-climate');
      if (!controller.signal.aborted) { applyPreferredOptions(simulation);onCreate({ scenarioId: null, simulation, tiles }); onOpenChange(false); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  async function loadFile(file: File) {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try {
      if (file.size > MAX_SAVE_BYTES) throw new Error('The file is too large.');
      const bytes = new Uint8Array(await file.arrayBuffer()); controller.signal.throwIfAborted();
      const originalFile = /\.ssm$/i.test(file.name) || bytes[0] === 0x18;
      let restored: { scenarioId: number | null; simulation: GameSimulation };
      if (originalFile) {
        const setup = await loadNewFarmAssets(assets, controller.signal); controller.signal.throwIfAborted();
        const simulation = GameSimulation.openOriginalSave(bytes, { date: options.date, seeds: options.seeds }, setup);
        restored = { scenarioId: null, simulation };
      } else restored = GameSimulation.load(new TextDecoder().decode(bytes), assets.catalog.crops, assets.townLayouts);
      const tiles = await loadSavedFarmTiles(restored.simulation.getSnapshot().scenario, restored.scenarioId, controller.signal);
      if (!controller.signal.aborted) { onCreate({ ...restored, tiles }); onOpenChange(false); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  if (!open) return null;
  if (draft) return <section className="new-farm-panel" aria-label="New farm">
    <TerrainDesign draft={draft.setup} assets={draft.artwork} error={error}
      onCancel={() => { if (draft.setup.getSnapshot().phase === 'preview') draft.setup.cancel(); setDraft(null); onOpenChange(false); }}
      onPlay={() => {
        try {
          const simulation = GameSimulation.load(writeNativeSave(draft.setup.accept('selected-climate'), null), assets.catalog.crops, assets.townLayouts).simulation;
          applyPreferredOptions(simulation);onCreate({ scenarioId: null, simulation, tiles: draft.tiles }); onOpenChange(false);
        } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      }} />
  </section>;
  return <section className="new-farm-panel" aria-label="New farm">
    <input ref={fileInput} id="setup-load-file" type="file" accept=".ssm,.SSM,.simfarm.json,.json,application/json" hidden aria-label="Load a farm through setup"
      onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (file) void loadFile(file);
      }} />
    <form ref={form} onSubmit={event => { event.preventDefault(); if (!busy && region) void create(); }}>
      {region ? <RegionMap assets={region} selected={selected} disabled={busy} unavailable={false} onSelect={selectRegion}
        onDesign={() => { if (form.current?.reportValidity()) void create(true); }}
        onLoad={() => { setError(''); fileInput.current?.click(); }}
        onQuit={() => { pending.current?.abort(); current.dispatch({ type: 'set-paused', paused: true }); onOpenChange(false); }} />
        : <div className="setup-loading">
          {regionError ? <p id="region-error" role="alert">Could not load regions: {regionError}</p> : <p role="status">Loading regions…</p>}
          <button id="choose-region" type="button" onClick={() => void chooseRegion()}>Retry region map</button>
          <button id="design-farm" type="button" disabled={busy} onClick={() => { if(form.current?.reportValidity()) void create(true); }}>Design your own</button>
        </div>}
      <fieldset className="setup-options" disabled={busy} aria-label="Farm options">
        <label>Map seed <input id="new-farm-seed" type="number" min="1" max="65535" step="1" required value={options.seeds.simulation}
          title="Reproduce a map using the same seed and settings."
          onChange={e => { const seed = Number(e.target.value); setOptions(o => ({ ...o, seeds: { visual: seed, simulation: seed, bounded: seed } })); }} /></label>
        <label>Starting year <input id="new-farm-year" type="number" min="1" max="65535" step="1" required disabled={Boolean(preset)} value={options.date.year}
          title={preset ? 'Original farms retain their saved year.' : 'Year for a generated farm.'}
          onChange={e => setOptions(o => ({ ...o, date: { ...o.date, year: Number(e.target.value) } }))} /></label>
      </fieldset>
      <div className="setup-footer">
        <span id="region-selection" role="status">{location ? `Region ${location.x + 1}, ${location.y + 1} · ${preset ? `Scenario ${preset.id + 1}` : 'New farm'}` : ''}</span>
        <details><summary>Help</summary><div id="region-map-help">Choose a location, then Use This Region. Yellow squares open original farms and retain their dates. Design Your Own opens the terrain designer. New Game starts a fresh farm. Enter a seed to reproduce a map. Cancel keeps your farm; Quit also pauses it. Save your current farm before replacing it.</div></details>
        <button type="button" onClick={() => { pending.current?.abort(); regionPending.current?.abort(); onOpenChange(false); }}>Cancel</button>
      </div>
      {error && <p id="new-farm-error" role="alert">Could not open farm: {error}</p>}
    </form>
  </section>;
}
