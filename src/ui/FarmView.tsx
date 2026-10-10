import { BuyWindow } from './BuyWindow';
import type { ShopProduct } from '../simulation/shop-product';
import { GameWindow, useWindows } from './GameWindow';
import { EditPalette, type EditTool } from './EditPalette';
import type { GameWindow as WindowCommand } from './ControlBar';
import { NetworkPanel } from './NetworkPanel';
import { NewFarmControls } from './NewFarmControls';
import { checkNetworkPlacement, type NetworkAction } from '../simulation/network-placement';
import { CropSupplyShop } from './CropSupplyShop';
import { checkCropSupplyPurchase } from '../simulation/crop-supply-purchase';
import { DisasterPanel } from './DisasterPanel';
import { FarmNavigation, type FarmDestination } from './FarmNavigation';
import { SupplyMovePanel } from './SupplyMovePanel';
import { EquipmentMovePanel, BuildingInteriorControls } from './EquipmentMovePanel';
import { FlightControls } from './FlightControls';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
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
import { SellWindow } from './SellWindow';
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
  audioControls: ReactNode;
  id: number | null;
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
export function FarmView({ audioControls, id, loaded, onLoad, onScenarioChange, assets, zoom, onZoomChange, cropId, onCropChange, onGameEvent, onFlightRunning }: Props) {
  const windows = useWindows();
  useEffect(() => windows.show(null), [windows.show]);
  const [newFarmOpen, setNewFarmOpen] = useState(false);
  const load = useCallback(async (signal: AbortSignal) => {
    if (loaded) return { ...loaded, simulation: loaded.simulation.withAllCrops(assets.catalog.crops) };
    if (id === null) throw new Error('Missing generated farm state');
    const data = await loadScenarioAssets(id, signal);
    return { tiles: data.tiles, simulation: new GameSimulation(data.scenario, assets.catalog.crops, assets.townLayouts).withAllCrops(assets.catalog.crops) };
  }, [id, loaded, assets.catalog.crops, assets.townLayouts]);
  const resource = useResource(load);
  const simulation = resource.status === 'ready' ? resource.value.simulation : null;
  const [buyPlacement, setBuyPlacement] = useState<Pick<ShopProduct, 'type' | 'name'> | null>(null);
  const [buyPointer, setBuyPointer] = useState<MapFocus | null>(null), [buyMessage, setBuyMessage] = useState('');
  const onMapPointer = useCallback((pointer: MapFocus | null) => {
    simulation?.dispatch({ type: 'set-map-pointer', pointer });
    if (buyPlacement) setBuyPointer(old => old?.x === pointer?.x && old?.y === pointer?.y ? old : pointer);
  }, [simulation, buyPlacement]);
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
  const [focus, setFocus] = useState<MapFocus>(() => {
    const home = id === null ? loaded?.simulation.getSnapshot().finances.homestead : null;
    return home ? { x: home.x + 2, y: home.y + 2 } : { x: 48, y: 48 };
  });
  const [mapTool, setMapTool] = useState<MapTool>('inspect');
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [navigation, setNavigation] = useState<{ target: FarmDestination | WindowCommand } | null>(null);
  const [reportOpen, setReportOpen] = useState(false), [taxOpen, setTaxOpen] = useState(false);
  const reportRef = useRef<HTMLElement>(null), weatherRef = useRef<HTMLSpanElement>(null);
  const sellRef = useRef<HTMLElement>(null), expertRef = useRef<HTMLElement>(null);
  const plannerRef = useRef<HTMLElement>(null), loansRef = useRef<HTMLElement>(null);
  const networkRef = useRef<HTMLHeadingElement>(null);
  const supplyRef = useRef<HTMLHeadingElement>(null);
  const landRef = useRef<HTMLHeadingElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!navigation) return;
    const target = navigation.target === 'planner' ? plannerRef.current : navigation.target === 'loans' ? loansRef.current
      : navigation.target === 'network' ? networkRef.current : navigation.target === 'crop-supplies' ? supplyRef.current : navigation.target === 'map' || navigation.target === 'edit' ? viewportRef.current
      : navigation.target === 'evaluation' || navigation.target === 'balance' ? reportRef.current
      : navigation.target === 'sell' ? sellRef.current : navigation.target === 'weather' ? weatherRef.current
      : navigation.target === 'expert' ? expertRef.current : landRef.current;
    target?.scrollIntoView({ block: 'start', inline: 'nearest' });
    target?.focus({ preventScroll: true });
  }, [navigation]);
  function navigate(target: FarmDestination) {
    setBuyPlacement(null);
    if (target === 'planner') { setPlannerOpen(true); setMapTool('inspect'); }
    if (target === 'land' || target === 'field' || target === 'crop-supplies' || target === 'network') setMapTool(target);
    windows.show(target === 'map' ? null : target === 'loans' ? 'bank' : 'actions');
    setNavigation({ target });
  }
  function openWindow(window: WindowCommand) {
    windows.show(window === 'edit' ? null : window);
    if (window !== 'edit') setBuyPlacement(null);
    if (window === 'buy') { setNavigation(null); return; }
    if (window === 'bank') { navigate('loans'); return; }
    if (window === 'map') { navigate('land'); return; }
    if (window === 'evaluation' || window === 'balance') { setReportOpen(true); windows.show('evaluation'); }
    if (window === 'balance') setTaxOpen(true);
    if (window === 'weather') windows.show('speed');
    setNavigation({ target: window });
  }
  const [buildingType, setBuildingType] = useState(64);
  const [networkTool, setNetworkTool] = useState<NetworkAction>('road-161');
  const [irrigationTool, setIrrigationTool] = useState<IrrigationTool>('ditch');
  const [equipmentType, setEquipmentType] = useState(0);
  const [cropSupplyType, setCropSupplyType] = useState(192);
  const [livestockType, setLivestockType] = useState(161);
  function chooseTool(tool: MapTool) { setBuyPlacement(null); setMapTool(tool); windows.show('actions'); }
  function editTool(tool: EditTool) {
    setBuyPlacement(null);
    if (tool === 'View object') { setMapTool('inspect'); windows.show(null); }
    else if (tool === 'Move object') chooseTool('move');
    else if (tool === 'Bulldoze') { setMapTool('remove'); windows.show(null); }
    else if (tool === 'Paved road' || tool === 'Dirt road' || tool === 'Fence' || tool === 'Gate') {
      setNetworkTool(tool === 'Paved road' ? 'road-150' : tool === 'Dirt road' ? 'road-161' : tool === 'Fence' ? 'fence' : 'gate');
      setMapTool('network'); windows.show(null);
    } else if (tool === 'Ditch' || tool === 'Valve') {
      setIrrigationTool(tool === 'Ditch' ? 'ditch' : 'valve'); setMapTool('irrigation'); windows.show(null);
    } else if (tool === 'Hay' || tool === 'Trough') { setLivestockType(tool === 'Hay' ? 300 : 299); chooseTool('livestock'); }
  }
  const data = resource.status === 'ready' && snapshot ? { tiles: resource.value.tiles, scenario: snapshot.scenario } : null;
  const field = data?.scenario.fields.find(f => f.slot === fieldSlot && f.active);
  const cell = selection !== null ? data?.scenario.cells[selection] : undefined;
  const position = buyPlacement ? buyPointer : selection !== null ? worldPosition(selection) : null;
  const removal = position && data && mapTool === 'remove' ? checkManualRemoval(data.scenario, position.x, position.y) : null;
  const preview = mapTool === 'move' || mapTool === 'supply-move' ? position ? { ...position, width: 1, height: 1, valid: true } : undefined
    : mapTool === 'remove' ? removal?.ok ? { x: removal.x, y: removal.y, width: removal.width, height: removal.height, valid: true } : undefined
    : position && data && snapshot && mapTool !== 'inspect' ? {
    x: mapTool === 'land' ? (position.x >> 3) * 8 : position.x,
    y: mapTool === 'land' ? (position.y >> 3) * 8 : position.y,
    width: mapTool === 'equipment' ? data.scenario.equipmentDefinitions[equipmentType].width : mapTool === 'build' ? data.scenario.buildingDefinitions[buildingType - 64].width : mapTool === 'network' || mapTool === 'irrigation' || mapTool === 'livestock' || mapTool === 'crop-supplies' ? 1 : 8,
    height: mapTool === 'equipment' ? data.scenario.equipmentDefinitions[equipmentType].height : mapTool === 'build' ? data.scenario.buildingDefinitions[buildingType - 64].height : mapTool === 'network' || mapTool === 'irrigation' || mapTool === 'livestock' || mapTool === 'crop-supplies' ? 1 : 8,
    valid: mapTool === 'land' ? quoteLand(data.scenario, position.x >> 3, position.y >> 3, snapshot.weather.soilMoisture)?.ownership === 0
      : mapTool === 'build' ? checkBuildingPlacement(data.scenario, buildingType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'network' ? checkNetworkPlacement(data.scenario, snapshot.finances, networkTool, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'irrigation' ? checkIrrigationPlacement(data.scenario, snapshot.finances, irrigationTool, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'equipment' ? checkEquipmentPurchase(data.scenario, equipmentType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'crop-supplies' ? checkCropSupplyPurchase(data.scenario, cropSupplyType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : mapTool === 'livestock' ? checkLivestockPurchase(data.scenario, snapshot.finances, livestockType, position.x, position.y, snapshot.weather.soilMoisture).ok
      : checkFieldPlacement(data.scenario, position.x, position.y).ok,
  } : undefined;
  function purchaseFeedback(result: { ok: boolean; reason?: string } | null, name: string) {
    if (!result) return;
    const reasons: Record<string,string> = {
      'insufficient-cash':'Not enough cash.', 'not-owned':'Choose land you own.', 'outside-map':'The whole item must fit inside the map.',
      'blocked-terrain':'Choose clear ground or compatible storage.', 'occupied':'This location is occupied.',
      'storage-required':'Choose a crop or equipment storage building.', 'incompatible-storage':'Choose equipment storage for chemicals.',
      'no-storage-space':'There is no compatible free storage space.', 'no-airport':'An airport is needed.', 'no-parking':'No airport parking space is available.',
    };
    setBuyMessage(result.ok ? `${name} purchased.` : reasons[result.reason ?? ''] ?? `Cannot buy here: ${result.reason?.replaceAll('-', ' ') ?? 'unavailable'}.`);
  }
  function beginPurchase(product: ShopProduct) {
    if (!simulation || !snapshot || snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight) return;
    setBuyMessage('');
    if (product.type === 8) {
      simulation.dispatch({ type: 'buy-aircraft' }); purchaseFeedback(simulation.getSnapshot().lastAircraftPurchaseResult,product.name);
      return;
    }
    setBuyPlacement({ type:product.type, name:product.name }); setBuyPointer(null); setSelection(null);
    if (product.type < 8) { setEquipmentType(product.type); setMapTool('equipment'); }
    else if (product.type < 128) { setBuildingType(product.type); setMapTool('build'); }
    else if (product.type < 192) { setLivestockType(product.type); setMapTool('livestock'); }
    else { setCropSupplyType(product.type); setMapTool('crop-supplies'); }
    windows.show(null); viewportRef.current?.focus({ preventScroll: true });
  }
  function placePurchase(x: number, y: number) {
    if (!simulation || !buyPlacement || !snapshot || snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight) return;
    const type = buyPlacement.type;
    if (type < 8) simulation.dispatch({ type: 'buy-equipment', equipmentType: type, x, y });
    else if (type < 128) simulation.dispatch({ type: 'build', buildingType: type, x, y });
    else if (type < 192) simulation.dispatch({ type: 'buy-livestock', productType: type, x, y });
    else simulation.dispatch({ type: 'buy-crop-supply', productType: type, x, y });
    const next = simulation.getSnapshot();
    purchaseFeedback(type < 8 ? next.lastEquipmentPurchaseResult : type < 128 ? next.lastBuildingResult : type < 192 ? next.lastLivestockResult : next.lastCropSupplyPurchaseResult,buyPlacement.name);
  }
  function cancelPurchase() { setBuyPlacement(null); setBuyPointer(null); setMapTool('inspect'); setBuyMessage(''); }
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
    {simulation && <SaveControls simulation={simulation} scenarioId={id} assets={assets} loaded={Boolean(loaded)} onLoad={onLoad} onNewGame={() => setNewFarmOpen(true)} onWindow={openWindow} />}
    <GameWindow windowKey="options" title="Options">{audioControls}
      <button onClick={() => windows.show('session')}>Game files</button> <button onClick={() => windows.show('tools')}>Edit tools</button>
      <button onClick={() => windows.show('about-project')}>Preservation progress</button>
    </GameWindow>
    <GameWindow windowKey="newgame" title="New Game" forced={newFarmOpen} onClose={() => setNewFarmOpen(false)}>
    {simulation && <NewFarmControls assets={assets} simulation={simulation} open={newFarmOpen} onOpenChange={setNewFarmOpen} onCreate={onLoad} />}
    </GameWindow>
    <GameWindow windowKey="tools" title="Edit tools">
    <section className="toolbar">
      <div><label>Original farm <select id="scenario" value={id ?? 'generated'} onChange={e => onScenarioChange(Number(e.target.value))}>
        {id === null && <option value="generated" disabled>{snapshot?.scenario.origin === 'original' ? 'Imported farm' : 'Generated farm'}</option>}
        {Array.from({ length: 8 }, (_, i) => <option key={i} value={i}>Scenario {i + 1}</option>)}
      </select></label>
        <span id="map-status" role="status">{resource.status === 'ready' ? (id === null ? `${snapshot?.scenario.origin === 'original' ? 'Imported' : 'Generated'} farm · original terrain` : `Scenario ${id + 1} · original terrain`)
          : resource.status === 'error' ? resource.error : 'Loading map…'}</span></div>
      <div><label>Map tool <select id="map-tool" disabled={!data || Boolean(snapshot?.aircraftFlight)} value={mapTool} onChange={e => chooseTool(e.target.value as MapTool)}>
        <option value="inspect">Inspect</option><option value="land">Buy land</option><option value="field">New field</option>
        <option value="build">Build</option>
        <option value="remove">Bulldoze</option>
        <option value="network">Roads &amp; fences</option>
        <option value="irrigation">Irrigation</option>
        <option value="equipment">Buy machinery</option><option value="move">Move machinery</option><option value="supply-move">Move supplies</option>
        <option value="crop-supplies">Buy seeds &amp; chemicals</option>
        <option value="livestock">Animals &amp; supplies</option>
      </select></label><label>Zoom <select id="zoom" value={zoom} onChange={e => onZoomChange(Number(e.target.value))}>
        <option value={0.5}>50%</option><option value={1}>100%</option><option value={2}>200%</option>
      </select></label><button id="center" disabled={!data || Boolean(snapshot?.aircraftFlight)} onClick={() => setFocus({ x: 48, y: 48 })}>Center map</button></div>
    </section>
    <button onClick={() => windows.show('navigation')}>Farm controls</button>
    <button id="new-farm" onClick={() => setNewFarmOpen(true)}>New farm</button>
    {(['machinery', 'livestock', 'aircraft'] as const).map(key => <button key={key} onClick={() => windows.show(key)}>{key === 'machinery' ? 'Machinery' : key === 'livestock' ? 'Livestock' : 'Aircraft'}</button>)}
    </GameWindow>
    <GameWindow windowKey="speed" title="Speed and weather">
    {simulation && snapshot && <TimeControls weatherRef={weatherRef} snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    </GameWindow>
    <GameWindow windowKey="navigation" title="Farm controls">
    {data && snapshot && <FarmNavigation tool={mapTool} blocked={Boolean(snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight)} onNavigate={navigate} />}
    <button onClick={() => windows.show('tools')}>More tools</button></GameWindow>
    {snapshot?.lastHomesteadChange?.notice && <div id="homestead-notice" className="homestead-notice" role="status">
      <span>{snapshot.lastHomesteadChange.notice === 'improved'
        ? 'Your home has been improved after a rise in cash.' : 'Your home has been downgraded after a fall in cash.'}</span>
      <button id="view-home" onClick={() => setFocus({ x: snapshot.finances.homestead.x + 2, y: snapshot.finances.homestead.y + 2 })}>View home</button>
    </div>}
    <GameWindow windowKey="town" title="Town development" forced={Boolean(snapshot?.pendingTown)}>
    {simulation && snapshot && <TownChoicePanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    </GameWindow>
    <GameWindow windowKey="bank" title="Bank" forced={Boolean(snapshot?.finances.defaultDecision)}>
    {simulation && snapshot && <LoanPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)}
      onRestart={() => setNewFarmOpen(true)} artwork={assets.bankArtwork} onClose={() => windows.show(null)} panelRef={loansRef} />}
    </GameWindow>
    <GameWindow windowKey="evaluation" title="Evaluation and balance sheet">
    {snapshot && <TaxPanel snapshot={snapshot} open={taxOpen} onOpenChange={setTaxOpen} />}
    {snapshot && <FarmReport snapshot={snapshot} open={reportOpen} onOpenChange={setReportOpen} summaryRef={reportRef} />}
    </GameWindow>
    <GameWindow windowKey="livestock" title="Livestock">
    {snapshot && <LivestockPanel snapshot={snapshot} onMoveSupplies={() => { chooseTool('supply-move'); setSelection(null); }} onShop={() => chooseTool('livestock')} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    </GameWindow>
    <GameWindow windowKey="aircraft" title="Aircraft">
    {snapshot && simulation && <AircraftPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })}
      onFly={slot => { simulation.dispatch({ type: 'start-flight', slot, ...mapSize.current }); if (simulation.getSnapshot().aircraftFlight) windows.show(null); return Boolean(simulation.getSnapshot().aircraftFlight); }} />}
    </GameWindow>
    <GameWindow windowKey="machinery" title="Machinery">
    {snapshot && <MachineryPanel snapshot={snapshot} onMove={() => { chooseTool('move'); setSelection(null); }} onShop={() => chooseTool('equipment')} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    </GameWindow>
    <GameWindow windowKey="disasters" title="Disasters">
    {snapshot && <DisasterPanel snapshot={snapshot} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    </GameWindow>
    {data && snapshot && <SellWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={sellRef} onCommand={command=>simulation?.dispatch(command)} />}
    {data && snapshot && <BuyWindow assets={assets} snapshot={snapshot} tiles={data.tiles} onBuy={beginPurchase} />}
    {resource.status !== 'ready' && <div className="loading"><p role="status">{resource.status === 'error' ? resource.error : 'Loading farm…'}</p>
      <button aria-label="Edit tools and help" onClick={() => windows.show('tools')}>Choose another farm</button></div>}
    {data && <main className="edit-workspace" aria-label="Edit" onKeyDown={event => { if (buyPlacement && event.key === 'Escape') { event.preventDefault(); cancelPurchase(); } }}>
      <div className="edit-title">Edit</div>
      <EditPalette artwork={assets.editPalette} disabled={Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)} onTool={editTool}
        onField={() => navigate('planner')} onSpray={() => { chooseTool('inspect'); }} onHelp={() => windows.show('tools')} />
      <section className={`map-panel${snapshot?.aircraftFlight ? ' is-flying' : ''}`}>
        {snapshot && simulation && <FlightControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
        <FarmMap viewportRef={viewportRef} disasters={snapshot?.disasters ?? null} disasterSprites={assets.disasterSprites} flight={snapshot?.aircraftFlight ?? null} flightSprites={assets.flightSprites} onViewportSize={onViewportSize}
          onFlightControl={control => simulation?.dispatch({ type: 'flight-control', control })} scenario={data.scenario} tiles={data.tiles} maskedTiles={assets.maskedTiles} zoom={zoom} focus={focus}
          field={field} selection={selection} preview={preview} onPointer={onMapPointer} onSelect={index => {
            setSelection(index);
            const { x, y } = worldPosition(index);
            if (buyPlacement) { placePurchase(x,y); return; }
            selectField(data.scenario.fields.find(f => f.contains(x, y))?.slot ?? null, false);
            windows.show('actions');
          }} />
        <div className="map-footer">{buyPlacement && <button id="cancel-buy-placement" onClick={cancelPurchase}>Cancel purchase</button>}<span id="buy-result" role="status">{buyMessage}</span><span>{buyPlacement ? `${buyPlacement.name}: click to place · Escape cancels` : snapshot?.aircraftFlight ? 'Following aircraft · farm calendar suspended' : mapTool === 'land' ? 'Click to select a plot to buy' : mapTool === 'field'
          ? 'Click the top-left corner of a new field' : mapTool === 'build' ? 'Click the top-left corner of a building'
          : mapTool === 'supply-move' ? 'Select a supply, then choose its destination in the movement panel'
          : mapTool === 'move' ? 'Select a machine, then choose its destination in the movement panel'
          : mapTool === 'remove' ? 'Click an object or terrain to review its removal'
          : mapTool === 'network' ? 'Choose a tile, then review road, fence or gate work'
          : mapTool === 'irrigation' ? 'Click a tile to dig a ditch or control a valve'
          : mapTool === 'equipment' ? 'Click clear ground or an equipment storage building'
          : mapTool === 'crop-supplies' ? 'Click a storage building, then review your purchase'
          : mapTool === 'livestock' ? 'Click a tile for your animal or supply' : 'Scroll to explore · click a tile to examine'}</span>
          <span id="cell-status">{cell && position ? `Tile ${position.x}, ${position.y} · graphic ${terrainTile(cell)}` : '96 × 96 tiles'}</span>
          {(mapTool === 'land' || mapTool === 'field' || mapTool === 'crop-supplies' || mapTool === 'network') && <button disabled={!position || Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)}
            onClick={() => navigate(mapTool)}>{mapTool === 'network' ? 'Review construction' : mapTool === 'land' ? 'Review plot' : mapTool === 'crop-supplies' ? 'Review supplies' : 'Review field'}</button>}
        </div>
      </section>
      <GameWindow windowKey="actions" title={mapTool === 'inspect' ? 'Field information' : mapTool === 'land' ? 'Land purchase' : mapTool === 'field' ? 'New field' : ['build', 'equipment', 'crop-supplies', 'livestock'].includes(mapTool) ? 'Buy' : 'Edit object'}>
        <div className="window-actions">{!['land', 'field', 'crop-supplies', 'network'].includes(mapTool) && <button onClick={() => { windows.show(null); viewportRef.current?.focus(); }}>Choose on map</button>}
          <button onClick={() => windows.show('tools')}>Tools</button>
          {mapTool === 'inspect' && <button onClick={() => navigate('field')}>New field</button>}</div>
        {['build', 'equipment', 'crop-supplies', 'livestock'].includes(mapTool) && <label>Buy <select aria-label="Purchase category" value={mapTool} onChange={event => setMapTool(event.target.value as MapTool)}>
          <option value="build">Buildings</option><option value="equipment">Machinery</option><option value="crop-supplies">Seeds and chemicals</option><option value="livestock">Livestock and supplies</option>
        </select></label>}
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
        {snapshot && mapTool === 'network' && <NetworkPanel snapshot={snapshot} position={position} tool={networkTool}
          onToolChange={setNetworkTool} onCommand={command => simulation?.dispatch(command)} headingRef={networkRef} onChooseMap={() => navigate('map')} />}
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
        {mapTool === 'inspect' && <FieldPanel scenario={data.scenario} crops={assets.catalog.crops} field={field}
          plantResult={snapshot?.lastPlantResult ?? null}
          harvestResult={snapshot?.lastHarvestResult ?? null}
          treatmentResult={snapshot?.lastTreatmentResult ?? null}
          onTreat={(fieldSlot, treatment) => simulation?.dispatch({ type: 'treat-field', fieldSlot, treatment })}
          harvestEstimate={field ? snapshot?.fieldHarvestEstimates[field.slot] : null}
          onHarvest={fieldSlot => simulation?.dispatch({ type: 'harvest-field', fieldSlot })}
          onPlant={(fieldSlot, cropSlot) => simulation?.dispatch({ type: 'plant-field', fieldSlot, cropSlot })}
          onSelect={slot => { setSelection(null); selectField(slot, true); }} />}
        {snapshot && mapTool === 'inspect' && <FieldPlanner open={plannerOpen} onOpenChange={setPlannerOpen} summaryRef={plannerRef}
          onSelect={slot => { setSelection(null); selectField(slot, true); }} onNewField={() => navigate('field')}
          scenario={data.scenario} crops={assets.catalog.crops} field={field} result={snapshot.lastPlanEditResult}
          onEdit={(fieldSlot, week, action) => simulation?.dispatch({ type: 'edit-field-plan', fieldSlot, week, action })} />}
        </fieldset>
      </GameWindow>
      <GameWindow windowKey="expert" title="Farm Expert">
        <section ref={expertRef} tabIndex={-1} aria-label="Farm Expert">
        <CropGuide crops={assets.catalog.crops} cropId={cropId} onChange={onCropChange} />
        </section>
        <details><summary>Tile details</summary><pre id="tile-details">{cell && position
          ? `Position: ${position.x}, ${position.y}\nTerrain: 0x${cell.terrain.toString(16).padStart(4, '0')}\nSecond word: 0x${cell.overlay.toString(16).padStart(4, '0')}\nAttribute: ${cell.attribute}`
          : 'Select a tile on the map.'}</pre></details>
      </GameWindow>
    </main>}
  </>;
}
