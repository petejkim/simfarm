import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { loadScenarioAssets, type GameAssets } from '../assets/game-assets';
import { terrainTile, worldPosition } from '../formats/scenario';
import { CropGuide } from './CropGuide';
import { FieldPanel } from './FieldPanel';
import { FarmMap, type MapFocus } from './FarmMap';
import { useResource } from './useResource';
import { GameSimulation } from '../simulation/game';
import { TimeControls } from './TimeControls';

const subscribeEmpty = () => () => {};
const emptySnapshot = () => null;

interface Props {
  id: number;
  onScenarioChange: (id: number) => void;
  assets: GameAssets;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  cropId: string;
  onCropChange: (id: string) => void;
}
/** Mounted with the scenario ID as its key, so farm-specific selection cannot leak between saves. */
export function FarmView({ id, onScenarioChange, assets, zoom, onZoomChange, cropId, onCropChange }: Props) {
  const load = useCallback(async (signal: AbortSignal) => {
    const data = await loadScenarioAssets(id, signal);
    return { tiles: data.tiles, simulation: new GameSimulation(data.scenario, assets.catalog.crops) };
  }, [id, assets.catalog.crops]);
  const resource = useResource(load);
  const simulation = resource.status === 'ready' ? resource.value.simulation : null;
  const snapshot = useSyncExternalStore(simulation?.subscribe ?? subscribeEmpty, simulation?.getSnapshot ?? emptySnapshot);
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
  const data = resource.status === 'ready' && snapshot ? { tiles: resource.value.tiles, scenario: snapshot.scenario } : null;
  const field = data?.scenario.fields.find(f => f.slot === fieldSlot && f.active);
  const cell = selection !== null ? data?.scenario.cells[selection] : undefined;
  const position = selection !== null ? worldPosition(selection) : null;
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
      <div><label>Zoom <select id="zoom" value={zoom} onChange={e => onZoomChange(Number(e.target.value))}>
        <option value={0.5}>50%</option><option value={1}>100%</option><option value={2}>200%</option>
      </select></label><button id="center" disabled={!data} onClick={() => setFocus({ x: 48, y: 48 })}>Center map</button></div>
    </section>
    {simulation && snapshot && <TimeControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    {data && <main>
      <section className="map-panel">
        <FarmMap scenario={data.scenario} tiles={data.tiles} maskedTiles={assets.maskedTiles} zoom={zoom} focus={focus}
          field={field} selection={selection} onSelect={index => {
            setSelection(index);
            const { x, y } = worldPosition(index);
            selectField(data.scenario.fields.find(f => f.contains(x, y))?.slot ?? null, false);
          }} />
        <div className="map-footer"><span>Scroll to explore · click a tile to examine</span>
          <span id="cell-status">{cell && position ? `Tile ${position.x}, ${position.y} · graphic ${terrainTile(cell)}` : '96 × 96 tiles'}</span>
        </div>
      </section>
      <aside>
        <FieldPanel scenario={data.scenario} crops={assets.catalog.crops} field={field}
          plantResult={snapshot?.lastPlantResult ?? null}
          onPlant={(fieldSlot, cropSlot) => simulation?.dispatch({ type: 'plant-field', fieldSlot, cropSlot })}
          onSelect={slot => { setSelection(null); selectField(slot, true); }} />
        <CropGuide crops={assets.catalog.crops} cropId={cropId} onChange={onCropChange} />
        <details><summary>Tile details</summary><pre id="tile-details">{cell && position
          ? `Position: ${position.x}, ${position.y}\nTerrain: 0x${cell.terrain.toString(16).padStart(4, '0')}\nSecond word: 0x${cell.overlay.toString(16).padStart(4, '0')}\nAttribute: ${cell.attribute}`
          : 'Select a tile on the map.'}</pre></details>
      </aside>
    </main>}
  </>;
}
