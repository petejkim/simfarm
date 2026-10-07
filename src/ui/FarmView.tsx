import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { loadScenarioAssets, type GameAssets } from '../assets/game-assets';
import { terrainTile, worldPosition, worldIndex } from '../formats/scenario';
import { CropGuide } from './CropGuide';
import { FieldPanel } from './FieldPanel';
import { FieldPlanner } from './FieldPlanner';
import { FarmMap, type MapFocus } from './FarmMap';
import { useResource } from './useResource';
import { GameSimulation, type GameCommand } from '../simulation/game';
import { TimeControls } from './TimeControls';
import { SaveControls, type LoadedFarm } from './SaveControls';
import { HarvestInventory } from './HarvestInventory';
import { LandPanel, type MapTool } from './LandPanel';
import { checkFieldPlacement } from '../simulation/field-placement';
import { quoteLand } from '../simulation/land';
import { LoanPanel } from './LoanPanel';
import { TaxPanel } from './TaxPanel';
import { FarmReport } from './FarmReport';
import { TownChoicePanel } from './TownChoicePanel';
import type { GameEvent } from '../simulation/events';
import { BuildingPanel } from './BuildingPanel';
import { checkBuildingPlacement } from '../simulation/building-placement';

const subscribeEmpty = () => () => {};
const emptySnapshot = () => null;

interface Props {
  id: number;
  loaded?: LoadedFarm;
  onLoad: (farm: LoadedFarm) => void;
  onScenarioChange: (id: number) => void;
  assets: GameAssets;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  cropId: string;
  onCropChange: (id: string) => void;
  onGameEvent: (event: GameEvent) => void;
}
/** Each new/loaded farm has its own mount, subscriptions, clock and UI selection. */
export function FarmView({ id, loaded, onLoad, onScenarioChange, assets, zoom, onZoomChange, cropId, onCropChange, onGameEvent }: Props) {
  const load = useCallback(async (signal: AbortSignal) => {
    if (loaded) return loaded;
    const data = await loadScenarioAssets(id, signal);
    return { tiles: data.tiles, simulation: new GameSimulation(data.scenario, assets.catalog.crops, assets.townLayouts) };
  }, [id, loaded, assets.catalog.crops, assets.townLayouts]);
  const resource = useResource(load);
  const simulation = resource.status === 'ready' ? resource.value.simulation : null;
  const snapshot = useSyncExternalStore(simulation?.subscribe ?? subscribeEmpty, simulation?.getSnapshot ?? emptySnapshot);
  useEffect(() => simulation?.subscribeEvents(onGameEvent), [simulation, onGameEvent]);
  useEffect(() => {
    if (!simulation) return;
    let frame: number, previous: number | null = null;
    const tick = (now: number) => {
      // Background tabs do not accumulate days; wall-clock pacing remains outside the simulation rules.
      if (!document.hidden && previous !== null) simulation.tick(Math.min(250, Math.max(0, now - previous)));
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [simulation]);
  const [selection, setSelection] = useState<number | null>(null), [fieldSlot, setFieldSlot] = useState<number | null>(null);
  const [focus, setFocus] = useState<MapFocus>({ x: 48, y: 48 });
  const [mapTool, setMapTool] = useState<MapTool>('inspect');
  const [buildingType, setBuildingType] = useState(64);
  const data = resource.status === 'ready' && snapshot ? { tiles: resource.value.tiles, scenario: snapshot.scenario } : null;
  const field = data?.scenario.fields.find(f => f.slot === fieldSlot && f.active);
  const cell = selection !== null ? data?.scenario.cells[selection] : undefined;
  const position = selection !== null ? worldPosition(selection) : null;
  const preview = position && data && snapshot && mapTool !== 'inspect' ? {
    x: mapTool === 'land' ? (position.x >> 3) * 8 : position.x,
    y: mapTool === 'land' ? (position.y >> 3) * 8 : position.y,
    width: mapTool === 'build' ? data.scenario.buildingDefinitions[buildingType - 64].width : 8,
    height: mapTool === 'build' ? data.scenario.buildingDefinitions[buildingType - 64].height : 8,
    valid: mapTool === 'land' ? quoteLand(data.scenario, position.x >> 3, position.y >> 3, snapshot.weather.soilMoisture)?.ownership === 0
      : mapTool === 'build' ? checkBuildingPlacement(data.scenario, buildingType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : checkFieldPlacement(data.scenario, position.x, position.y).ok,
  } : undefined;
  function landCommand(command: GameCommand) {
    if (!simulation) return;
    simulation.dispatch(command);
    const next = simulation.getSnapshot();
    if (command.type === 'buy-land' && next.lastLandResult?.ok) {
      setSelection(worldIndex(command.regionX * 8, command.regionY * 8)); setFieldSlot(null); setMapTool('field');
    }
    if (command.type === 'create-field' && next.lastNewFieldResult?.ok) {
      setFieldSlot(next.lastNewFieldResult.slot); setSelection(null); setMapTool('inspect');
      setFocus({ x: command.x + 4, y: command.y + 4 });
      onCropChange(next.scenario.cropFiles[command.cropSlot].replace('.crp', ''));
    }
  }
  function selectField(slot: number | null, navigate: boolean) {
    const selected = data?.scenario.fields.find(f => f.slot === slot && f.active);
    setFieldSlot(selected?.slot ?? null);
    if (selected) {
      onCropChange(data!.scenario.cropFiles[selected.cropSlot].replace('.crp', ''));
      if (navigate) setFocus({ x: selected.x + selected.width / 2, y: selected.y + selected.height / 2 });
    }
  }
  return <>
    <section className="toolbar">
      <div><label>Original farm <select id="scenario" value={id} onChange={e => onScenarioChange(Number(e.target.value))}>
        {Array.from({ length: 8 }, (_, i) => <option key={i} value={i}>Scenario {i + 1}</option>)}
      </select></label>
        <span id="map-status" role="status">{resource.status === 'ready' ? `Scenario ${id + 1} · original terrain`
          : resource.status === 'error' ? resource.error : 'Loading map…'}</span></div>
      <div><label>Map tool <select id="map-tool" value={mapTool} onChange={e => setMapTool(e.target.value as MapTool)}>
        <option value="inspect">Inspect</option><option value="land">Buy land</option><option value="field">New field</option>
        <option value="build">Build storage</option>
      </select></label><label>Zoom <select id="zoom" value={zoom} onChange={e => onZoomChange(Number(e.target.value))}>
        <option value={0.5}>50%</option><option value={1}>100%</option><option value={2}>200%</option>
      </select></label><button id="center" disabled={!data} onClick={() => setFocus({ x: 48, y: 48 })}>Center map</button></div>
      {simulation && <SaveControls simulation={simulation} scenarioId={id} assets={assets} loaded={Boolean(loaded)} onLoad={onLoad} />}
    </section>
    {simulation && snapshot && <TimeControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    {snapshot?.lastHomesteadChange?.notice && <div id="homestead-notice" className="homestead-notice" role="status">
      <span>{snapshot.lastHomesteadChange.notice === 'improved'
        ? 'Your home has been improved after a rise in cash.' : 'Your home has been downgraded after a fall in cash.'}</span>
      <button id="view-home" onClick={() => setFocus({ x: snapshot.finances.homestead.x + 2, y: snapshot.finances.homestead.y + 2 })}>View home</button>
    </div>}
    {simulation && snapshot && <TownChoicePanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    {simulation && snapshot && <LoanPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)}
      onRestart={() => onScenarioChange(id)} />}
    {snapshot && <TaxPanel snapshot={snapshot} />}
    {snapshot && <FarmReport snapshot={snapshot} />}
    {data && <main>
      <section className="map-panel">
        <FarmMap scenario={data.scenario} tiles={data.tiles} maskedTiles={assets.maskedTiles} zoom={zoom} focus={focus}
          field={field} selection={selection} preview={preview} onSelect={index => {
            setSelection(index);
            const { x, y } = worldPosition(index);
            selectField(data.scenario.fields.find(f => f.contains(x, y))?.slot ?? null, false);
          }} />
        <div className="map-footer"><span>{mapTool === 'land' ? 'Click to select a plot to buy' : mapTool === 'field'
          ? 'Click the top-left corner of a new field' : mapTool === 'build' ? 'Click the top-left corner of a storage building' : 'Scroll to explore · click a tile to examine'}</span>
          <span id="cell-status">{cell && position ? `Tile ${position.x}, ${position.y} · graphic ${terrainTile(cell)}` : '96 × 96 tiles'}</span>
        </div>
      </section>
      <aside>
        <fieldset className="farm-actions" aria-label="Farm actions" disabled={Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision)}>
        {snapshot && mapTool === 'build' && <BuildingPanel snapshot={snapshot} position={position} buildingType={buildingType}
          onTypeChange={setBuildingType} onCommand={command => simulation?.dispatch(command)} />}
        {snapshot && (mapTool === 'land' || mapTool === 'field') && <LandPanel tool={mapTool} position={position} snapshot={snapshot}
          crops={assets.catalog.crops} onCommand={landCommand} />}
        <FieldPanel scenario={data.scenario} crops={assets.catalog.crops} field={field}
          plantResult={snapshot?.lastPlantResult ?? null}
          harvestResult={snapshot?.lastHarvestResult ?? null}
          treatmentResult={snapshot?.lastTreatmentResult ?? null}
          onTreat={(fieldSlot, treatment) => simulation?.dispatch({ type: 'treat-field', fieldSlot, treatment })}
          harvestEstimate={field ? snapshot?.fieldHarvestEstimates[field.slot] : null}
          onHarvest={fieldSlot => simulation?.dispatch({ type: 'harvest-field', fieldSlot })}
          onPlant={(fieldSlot, cropSlot) => simulation?.dispatch({ type: 'plant-field', fieldSlot, cropSlot })}
          onSelect={slot => { setSelection(null); selectField(slot, true); }} />
        {field && snapshot && <FieldPlanner key={`${field.slot}-${data.scenario.farm.calendar.year}`}
          scenario={data.scenario} crops={assets.catalog.crops} field={field} result={snapshot.lastPlanEditResult}
          onEdit={(fieldSlot, week, action) => simulation?.dispatch({ type: 'edit-field-plan', fieldSlot, week, action })} />}
        <HarvestInventory scenario={data.scenario} crops={assets.catalog.crops} values={snapshot?.storedHarvestValues ?? []}
          result={snapshot?.lastSaleResult ?? null} onSell={inventorySlot => simulation?.dispatch({ type: 'sell-harvest', inventorySlot })} />
        </fieldset>
        <CropGuide crops={assets.catalog.crops} cropId={cropId} onChange={onCropChange} />
        <details><summary>Tile details</summary><pre id="tile-details">{cell && position
          ? `Position: ${position.x}, ${position.y}\nTerrain: 0x${cell.terrain.toString(16).padStart(4, '0')}\nSecond word: 0x${cell.overlay.toString(16).padStart(4, '0')}\nAttribute: ${cell.attribute}`
          : 'Select a tile on the map.'}</pre></details>
      </aside>
    </main>}
  </>;
}
