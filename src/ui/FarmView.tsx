import { CropSupplyShop } from './CropSupplyShop';
import { checkCropSupplyPurchase } from '../simulation/crop-supply-purchase';
import { DisasterPanel } from './DisasterPanel';
import { FarmNavigation, type FarmDestination } from './FarmNavigation';
import { SupplyMovePanel } from './SupplyMovePanel';
import { EquipmentMovePanel, BuildingInteriorControls } from './EquipmentMovePanel';
import { FlightControls } from './FlightControls';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
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
import { LivestockPanel } from './LivestockPanel';
import { EquipmentShop } from './EquipmentShop';
import { checkEquipmentPurchase } from '../simulation/equipment-purchase';
import { AircraftPanel } from './AircraftPanel';
import { MachineryPanel } from './MachineryPanel';
import { TownChoicePanel } from './TownChoicePanel';
import type { GameEvent } from '../simulation/events';
import { BuildingPanel } from './BuildingPanel';
import { RemovalPanel } from './RemovalPanel';
import { checkManualRemoval } from '../simulation/manual-removal';
import { checkBuildingPlacement } from '../simulation/building-placement';
import { IrrigationPanel } from './IrrigationPanel';
import { checkIrrigationPlacement, type IrrigationTool } from '../simulation/irrigation-placement';
import { LivestockShop } from './LivestockShop';
import { checkLivestockPurchase } from '../simulation/livestock-purchase';

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
  onFlightRunning: (running: boolean) => void;
}
/** Each new/loaded farm has its own mount, subscriptions, clock and UI selection. */
export function FarmView({ id, loaded, onLoad, onScenarioChange, assets, zoom, onZoomChange, cropId, onCropChange, onGameEvent, onFlightRunning }: Props) {
  const load = useCallback(async (signal: AbortSignal) => {
    if (loaded) return loaded;
    const data = await loadScenarioAssets(id, signal);
    return { tiles: data.tiles, simulation: new GameSimulation(data.scenario, assets.catalog.crops, assets.townLayouts) };
  }, [id, loaded, assets.catalog.crops, assets.townLayouts]);
  const resource = useResource(load);
  const simulation = resource.status === 'ready' ? resource.value.simulation : null;
  const onMapPointer = useCallback((pointer: MapFocus | null) => simulation?.dispatch({ type: 'set-map-pointer', pointer }), [simulation]);
  const snapshot = useSyncExternalStore(simulation?.subscribe ?? subscribeEmpty, simulation?.getSnapshot ?? emptySnapshot);
  useEffect(() => simulation?.subscribeEvents(onGameEvent), [simulation, onGameEvent]);
  const flightRunning = Boolean(snapshot?.aircraftFlight && !snapshot.paused);
  useEffect(() => { onFlightRunning(flightRunning); return () => onFlightRunning(false); }, [flightRunning, onFlightRunning]);
  const mapSize = useRef({ columns: 20, rows: 16 });
  const onViewportSize = useCallback((size: { columns: number; rows: number }) => { mapSize.current = size; }, []);
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
  const [plannerOpen, setPlannerOpen] = useState(false), [loansOpen, setLoansOpen] = useState(false);
  const [navigation, setNavigation] = useState<{ target: FarmDestination } | null>(null);
  const plannerRef = useRef<HTMLElement>(null), loansRef = useRef<HTMLElement>(null);
  const supplyRef = useRef<HTMLHeadingElement>(null);
  const landRef = useRef<HTMLHeadingElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!navigation) return;
    const target = navigation.target === 'planner' ? plannerRef.current : navigation.target === 'loans' ? loansRef.current
      : navigation.target === 'crop-supplies' ? supplyRef.current : navigation.target === 'map' ? viewportRef.current : landRef.current;
    target?.scrollIntoView({ block: 'start', inline: 'nearest' });
    target?.focus({ preventScroll: true });
  }, [navigation]);
  function navigate(target: FarmDestination) {
    if (target === 'planner') { setPlannerOpen(true); setMapTool('inspect'); }
    if (target === 'loans') setLoansOpen(true);
    if (target === 'land' || target === 'field' || target === 'crop-supplies') setMapTool(target);
    setNavigation({ target });
  }
  const [buildingType, setBuildingType] = useState(64);
  const [irrigationTool, setIrrigationTool] = useState<IrrigationTool>('ditch');
  const [equipmentType, setEquipmentType] = useState(0);
  const [cropSupplyType, setCropSupplyType] = useState(192);
  const [livestockType, setLivestockType] = useState(161);
  const data = resource.status === 'ready' && snapshot ? { tiles: resource.value.tiles, scenario: snapshot.scenario } : null;
  const field = data?.scenario.fields.find(f => f.slot === fieldSlot && f.active);
  const cell = selection !== null ? data?.scenario.cells[selection] : undefined;
  const position = selection !== null ? worldPosition(selection) : null;
  const removal = position && data && mapTool === 'remove' ? checkManualRemoval(data.scenario, position.x, position.y) : null;
  const preview = mapTool === 'move' || mapTool === 'supply-move' ? position ? { ...position, width: 1, height: 1, valid: true } : undefined
    : mapTool === 'remove' ? removal?.ok ? { x: removal.x, y: removal.y, width: removal.width, height: removal.height, valid: true } : undefined
    : position && data && snapshot && mapTool !== 'inspect' ? {
    x: mapTool === 'land' ? (position.x >> 3) * 8 : position.x,
    y: mapTool === 'land' ? (position.y >> 3) * 8 : position.y,
    width: mapTool === 'equipment' ? data.scenario.equipmentDefinitions[equipmentType].width : mapTool === 'build' ? data.scenario.buildingDefinitions[buildingType - 64].width : mapTool === 'irrigation' || mapTool === 'livestock' || mapTool === 'crop-supplies' ? 1 : 8,
    height: mapTool === 'equipment' ? data.scenario.equipmentDefinitions[equipmentType].height : mapTool === 'build' ? data.scenario.buildingDefinitions[buildingType - 64].height : mapTool === 'irrigation' || mapTool === 'livestock' || mapTool === 'crop-supplies' ? 1 : 8,
    valid: mapTool === 'land' ? quoteLand(data.scenario, position.x >> 3, position.y >> 3, snapshot.weather.soilMoisture)?.ownership === 0
      : mapTool === 'build' ? checkBuildingPlacement(data.scenario, buildingType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'irrigation' ? checkIrrigationPlacement(data.scenario, snapshot.finances, irrigationTool, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'equipment' ? checkEquipmentPurchase(data.scenario, equipmentType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'crop-supplies' ? checkCropSupplyPurchase(data.scenario, cropSupplyType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'livestock' ? checkLivestockPurchase(data.scenario, snapshot.finances, livestockType, position.x, position.y, snapshot.weather.soilMoisture).ok
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
      <div><label>Map tool <select id="map-tool" disabled={Boolean(snapshot?.aircraftFlight)} value={mapTool} onChange={e => setMapTool(e.target.value as MapTool)}>
        <option value="inspect">Inspect</option><option value="land">Buy land</option><option value="field">New field</option>
        <option value="build">Build</option>
        <option value="remove">Bulldoze</option>
        <option value="irrigation">Irrigation</option>
        <option value="equipment">Buy machinery</option><option value="move">Move machinery</option><option value="supply-move">Move supplies</option>
        <option value="crop-supplies">Buy seeds &amp; chemicals</option>
        <option value="livestock">Animals &amp; supplies</option>
      </select></label><label>Zoom <select id="zoom" value={zoom} onChange={e => onZoomChange(Number(e.target.value))}>
        <option value={0.5}>50%</option><option value={1}>100%</option><option value={2}>200%</option>
      </select></label><button id="center" disabled={!data || Boolean(snapshot?.aircraftFlight)} onClick={() => setFocus({ x: 48, y: 48 })}>Center map</button></div>
      {simulation && <SaveControls simulation={simulation} scenarioId={id} assets={assets} loaded={Boolean(loaded)} onLoad={onLoad} />}
    </section>
    {simulation && snapshot && <TimeControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    {data && snapshot && <FarmNavigation tool={mapTool} blocked={Boolean(snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight)} onNavigate={navigate} />}
    {snapshot?.lastHomesteadChange?.notice && <div id="homestead-notice" className="homestead-notice" role="status">
      <span>{snapshot.lastHomesteadChange.notice === 'improved'
        ? 'Your home has been improved after a rise in cash.' : 'Your home has been downgraded after a fall in cash.'}</span>
      <button id="view-home" onClick={() => setFocus({ x: snapshot.finances.homestead.x + 2, y: snapshot.finances.homestead.y + 2 })}>View home</button>
    </div>}
    {simulation && snapshot && <TownChoicePanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    {simulation && snapshot && <LoanPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)}
      onRestart={() => onScenarioChange(id)} open={loansOpen} onOpenChange={setLoansOpen} summaryRef={loansRef} />}
    {snapshot && <TaxPanel snapshot={snapshot} />}
    {snapshot && <FarmReport snapshot={snapshot} />}
    {snapshot && <LivestockPanel snapshot={snapshot} onMoveSupplies={() => { setMapTool('supply-move'); setSelection(null); }} onShop={() => setMapTool('livestock')} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    {snapshot && simulation && <AircraftPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })}
      onFly={slot => { simulation.dispatch({ type: 'start-flight', slot, ...mapSize.current }); return Boolean(simulation.getSnapshot().aircraftFlight); }} />}
    {snapshot && <MachineryPanel snapshot={snapshot} onMove={() => { setMapTool('move'); setSelection(null); }} onShop={() => setMapTool('equipment')} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    {snapshot && <DisasterPanel snapshot={snapshot} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    {data && <main>
      <section className={`map-panel${snapshot?.aircraftFlight ? ' is-flying' : ''}`}>
        {snapshot && simulation && <FlightControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
        <FarmMap viewportRef={viewportRef} disasters={snapshot?.disasters ?? null} disasterSprites={assets.disasterSprites} flight={snapshot?.aircraftFlight ?? null} flightSprites={assets.flightSprites} onViewportSize={onViewportSize}
          onFlightControl={control => simulation?.dispatch({ type: 'flight-control', control })} scenario={data.scenario} tiles={data.tiles} maskedTiles={assets.maskedTiles} zoom={zoom} focus={focus}
          field={field} selection={selection} preview={preview} onPointer={onMapPointer} onSelect={index => {
            setSelection(index);
            const { x, y } = worldPosition(index);
            selectField(data.scenario.fields.find(f => f.contains(x, y))?.slot ?? null, false);
          }} />
        <div className="map-footer"><span>{snapshot?.aircraftFlight ? 'Following aircraft · farm calendar suspended' : mapTool === 'land' ? 'Click to select a plot to buy' : mapTool === 'field'
          ? 'Click the top-left corner of a new field' : mapTool === 'build' ? 'Click the top-left corner of a building'
          : mapTool === 'supply-move' ? 'Select a supply, then choose its destination in the movement panel'
          : mapTool === 'move' ? 'Select a machine, then choose its destination in the movement panel'
          : mapTool === 'remove' ? 'Click an object or terrain to review its removal'
          : mapTool === 'irrigation' ? 'Click a tile to dig a ditch or control a valve'
          : mapTool === 'equipment' ? 'Click clear ground or an equipment storage building'
          : mapTool === 'crop-supplies' ? 'Click a storage building, then review your purchase'
          : mapTool === 'livestock' ? 'Click a tile for your animal or supply' : 'Scroll to explore · click a tile to examine'}</span>
          <span id="cell-status">{cell && position ? `Tile ${position.x}, ${position.y} · graphic ${terrainTile(cell)}` : '96 × 96 tiles'}</span>
          {(mapTool === 'land' || mapTool === 'field' || mapTool === 'crop-supplies') && <button disabled={!position || Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)}
            onClick={() => navigate(mapTool)}>{mapTool === 'land' ? 'Review plot' : mapTool === 'crop-supplies' ? 'Review supplies' : 'Review field'}</button>}
        </div>
      </section>
      <aside>
        <fieldset className="farm-actions" aria-label="Farm actions" disabled={Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)}>
        {snapshot && mapTool === 'supply-move' && <SupplyMovePanel snapshot={snapshot} position={position}
          onCommand={command => simulation?.dispatch(command)} onPicked={() => setSelection(null)} />}
        {snapshot && mapTool === 'move' && <EquipmentMovePanel snapshot={snapshot} position={position}
          onCommand={command => simulation?.dispatch(command)} onPicked={() => setSelection(null)} />}
        {snapshot && (mapTool === 'inspect' || mapTool === 'move' || mapTool === 'supply-move' || mapTool === 'crop-supplies') && <BuildingInteriorControls snapshot={snapshot} position={position}
          onCommand={command => simulation?.dispatch(command)} />}
        {snapshot && mapTool === 'remove' && <RemovalPanel snapshot={snapshot} position={position}
          onCommand={command => simulation?.dispatch(command)} onCancel={() => { setSelection(null); setFieldSlot(null); }} />}
        {snapshot && mapTool === 'build' && <BuildingPanel snapshot={snapshot} position={position} buildingType={buildingType}
          onTypeChange={setBuildingType} onCommand={command => simulation?.dispatch(command)} />}
        {snapshot && mapTool === 'irrigation' && <IrrigationPanel snapshot={snapshot} position={position} tool={irrigationTool}
          onToolChange={setIrrigationTool} onCommand={command => simulation?.dispatch(command)} />}
        {snapshot && mapTool === 'crop-supplies' && <CropSupplyShop snapshot={snapshot} crops={assets.catalog.crops} position={position} productType={cropSupplyType}
          onTypeChange={setCropSupplyType} onCommand={command => simulation?.dispatch(command)} headingRef={supplyRef}
          onChooseMap={() => navigate('map')} onBuild={() => { setBuildingType(66); setMapTool('build'); }}
          onChooseStorage={(x, y) => { setSelection(worldIndex(x, y)); setFocus({ x, y }); }} />}
        {snapshot && mapTool === 'equipment' && <EquipmentShop snapshot={snapshot} position={position} equipmentType={equipmentType}
          onTypeChange={setEquipmentType} onCommand={command => simulation?.dispatch(command)} />}
        {snapshot && mapTool === 'livestock' && <LivestockShop snapshot={snapshot} position={position} productType={livestockType}
          onTypeChange={setLivestockType} onCommand={command => simulation?.dispatch(command)} />}
        {snapshot && (mapTool === 'land' || mapTool === 'field') && <LandPanel tool={mapTool} position={position} snapshot={snapshot}
          crops={assets.catalog.crops} onCommand={landCommand} headingRef={landRef} onChooseLocation={() => navigate('map')} />}
        <FieldPanel scenario={data.scenario} crops={assets.catalog.crops} field={field}
          plantResult={snapshot?.lastPlantResult ?? null}
          harvestResult={snapshot?.lastHarvestResult ?? null}
          treatmentResult={snapshot?.lastTreatmentResult ?? null}
          onTreat={(fieldSlot, treatment) => simulation?.dispatch({ type: 'treat-field', fieldSlot, treatment })}
          harvestEstimate={field ? snapshot?.fieldHarvestEstimates[field.slot] : null}
          onHarvest={fieldSlot => simulation?.dispatch({ type: 'harvest-field', fieldSlot })}
          onPlant={(fieldSlot, cropSlot) => simulation?.dispatch({ type: 'plant-field', fieldSlot, cropSlot })}
          onSelect={slot => { setSelection(null); selectField(slot, true); }} />
        {snapshot && <FieldPlanner open={plannerOpen} onOpenChange={setPlannerOpen} summaryRef={plannerRef}
          onSelect={slot => { setSelection(null); selectField(slot, true); }} onNewField={() => navigate('field')}
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
