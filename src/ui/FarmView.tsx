import { BuildingMessage } from './BuildingMessage';
import {FARM_OPTIONS,applyPreferredOptions,rememberPreference} from './preferences';
import {tilesForWeather} from '../assets/weather-tiles';
import {EDIT_TOOL_STATUSES,SPRAY_STATUSES} from '../simulation/edit-status';
import {EditStatus} from './EditStatus';
import {FieldMessage} from './FieldMessage';
import {EditHelp} from './EditHelp';
import {BalanceWindow} from './BalanceWindow';
import {DisasterMessage} from './DisasterMessage';
import {FinanceMessage} from './FinanceMessage';
import {DefaultDialog} from './DefaultDialog';
import {EvaluationWindow} from './EvaluationWindow';
import { MarketWindow } from './MarketWindow';
import { WeatherWindow } from './WeatherWindow';
import { townWindowAt } from '../simulation/town-window';
import { useBulldoze } from './useBulldoze';
import { BulldozeDialog } from './BulldozeDialog';
import { useConstruction } from './useConstruction';
import { useObjectMove } from './useObjectMove';
import { mapObjectInteraction } from '../simulation/map-interaction';
import { ExamineWindow } from './ExamineWindow';
import { FieldToolMenu } from './FieldToolMenu';
import { SPRAY_TOOLS, type FieldMapTool } from '../formats/field-tool-menu';
import { MapWindow } from './MapWindow';
import { BuyWindow } from './BuyWindow';
import type { ShopProduct } from '../simulation/shop-product';
import { GameWindow, useWindows } from './GameWindow';
import { EditPalette, type EditTool } from './EditPalette';
import type { GameWindow as WindowCommand } from './ControlBar';
import { NewFarmControls } from './NewFarmControls';
import { checkCropSupplyPurchase } from '../simulation/crop-supply-purchase';
import { FlightControls } from './FlightControls';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadScenarioAssets, type GameAssets } from '../assets/game-assets';
import { terrainTile, worldPosition, worldIndex } from '../formats/scenario';
import { ExpertWindow } from './ExpertWindow';
import { ScheduleWindow } from './ScheduleWindow';
import { FarmMap, type MapFocus } from './FarmMap';
import { useResource } from './useResource';
import { GameSimulation, type GameCommand } from '../simulation/game';
import { TimeControls } from './TimeControls';
import { SaveControls, type LoadedFarm } from './SaveControls';
import { SellWindow } from './SellWindow';
import { checkFieldPlacement } from '../simulation/field-placement';
import { LoanPanel } from './LoanPanel';
import { checkEquipmentPurchase } from '../simulation/equipment-purchase';
import { AircraftWindow } from './AircraftWindow';
import { aircraftMapEntry } from '../simulation/aircraft-view';
import { TownChoicePanel } from './TownChoicePanel';
import type { GameEvent } from '../simulation/events';
import { checkBuildingPlacement } from '../simulation/building-placement';
import { DISASTER_MENU_KINDS, disasterMenuChecks } from '../simulation/disaster-menu';
import { checkLivestockPurchase } from '../simulation/livestock-purchase';

const subscribeEmpty = () => () => {};
const emptySnapshot = () => null;

type FarmDestination = 'loans';
interface Props {
  audioControls: ReactNode;
  audioOptions: { music: boolean; sound: boolean; buttonClicks:boolean; toggleButtonClicks:()=>void; toggleMusic: () => void; toggleSound: () => void };
  id: number | null;
  loaded?: LoadedFarm;
  onLoad: (farm: LoadedFarm) => void;
  onScenarioChange: (id: number) => void;
  assets: GameAssets;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onGameEvent: (event: GameEvent) => void;
  onFlightRunning: (running: boolean) => void;
}
/** Each new/loaded farm has its own mount, subscriptions, clock and UI selection. */
export function FarmView({ audioControls, audioOptions, id, loaded, onLoad, onScenarioChange, assets, zoom, onZoomChange, onGameEvent, onFlightRunning }: Props) {
  const windows = useWindows();
  useEffect(() => windows.reset(), [windows.reset]);
  const [newFarmOpen, setNewFarmOpen] = useState(false);
  const load = useCallback(async (signal: AbortSignal) => {
    if (loaded) return { ...loaded, simulation: loaded.simulation.withAllCrops(assets.catalog.crops) };
    if (id === null) throw new Error('Missing generated farm state');
    const data = await loadScenarioAssets(id, signal);
    const simulation=new GameSimulation(data.scenario, assets.catalog.crops, assets.townLayouts).withAllCrops(assets.catalog.crops);
    applyPreferredOptions(simulation);
    return {tiles:data.tiles,simulation};
  }, [id, loaded, assets.catalog.crops, assets.townLayouts]);
  const resource = useResource(load);
  const simulation = resource.status === 'ready' ? resource.value.simulation : null;
  const [fieldMenu,setFieldMenu]=useState<'plant'|'spray'|null>(null),[fieldMapTool,setFieldMapTool]=useState<FieldMapTool|null>(null);
  const [fieldToolMessage,setFieldToolMessage]=useState('');
  const [interactionMessage,setInteractionMessage]=useState('');
  const [aircraftSlot,setAircraftSlot]=useState<number|null>(null);
  const [buyPlacement, setBuyPlacement] = useState<Pick<ShopProduct, 'type' | 'name'> | null>(null);
  const [toolPointer, setToolPointer] = useState<MapFocus | null>(null), [buyMessage, setBuyMessage] = useState('');
  const snapshot = useSyncExternalStore(simulation?.subscribe ?? subscribeEmpty, simulation?.getSnapshot ?? emptySnapshot);
  const objectMove=useObjectMove(simulation,snapshot);
  const construction=useConstruction(simulation,snapshot);
  const bulldoze=useBulldoze(simulation,snapshot);
  const [messages,setMessages]=useState<(Extract<GameEvent,{type:'finance-notice'|'disaster-notice'|'field-notice'|'building-notice'}>&{serial:number})[]>([]);
  const messageSerial=useRef(0);
  function closeMessage(){setMessages(previous=>previous.slice(1));}
  const onMapPointer = useCallback((pointer: MapFocus | null) => {
    simulation?.dispatch({ type: 'set-map-pointer', pointer });
    if (buyPlacement || fieldMapTool || objectMove.active || construction.tool || bulldoze.active) setToolPointer(old => old?.x === pointer?.x && old?.y === pointer?.y ? old : pointer);
  }, [simulation, buyPlacement, fieldMapTool, objectMove.active,construction.tool,bulldoze.active]);
  useEffect(() => simulation?.subscribeEvents(event=>{
    if(event.type==='finance-notice'||event.type==='disaster-notice'||event.type==='field-notice'||event.type==='building-notice'){
      const message={...event,serial:++messageSerial.current};
      setMessages(previous=>[...previous,message]);
    }else if(event.type==='map-focus')setFocus({x:event.x,y:event.y});
    else onGameEvent(event);
  }), [simulation, onGameEvent]);
  const flightRunning = Boolean(snapshot?.aircraftFlight && !snapshot.paused);
  useEffect(() => { onFlightRunning(flightRunning); return () => onFlightRunning(false); }, [flightRunning, onFlightRunning]);
  const mapSize = useRef({ columns: 20, rows: 16 });
  const onViewportSize = useCallback((size: { columns: number; rows: number }) => { mapSize.current = size; }, []);
  useEffect(() => {
    if (!simulation) return;
    let frame: number, previous: number | null = null;
    const tick = (now: number) => {
      // Background tabs do not accumulate days; wall-clock pacing remains outside the simulation rules.
      if (!document.hidden && previous !== null && !bulldoze.pending && !messages.length) simulation.tick(Math.min(250, Math.max(0, now - previous)));
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [simulation,Boolean(bulldoze.pending),Boolean(messages.length)]);
  const [editHelpOpen,setEditHelpOpen]=useState(false);
  const [fieldInspection,setFieldInspection]=useState<{month:number}|null>(null);
  const [selection, setSelection] = useState<number | null>(null), [fieldSlot, setFieldSlot] = useState<number | null>(null);
  const [focus, setFocus] = useState<MapFocus>(() => {
    const home = id === null ? loaded?.simulation.getSnapshot().finances.homestead : null;
    return home ? { x: home.x + 2, y: home.y + 2 } : { x: 48, y: 48 };
  });
  const [navigation, setNavigation] = useState<{ target: FarmDestination | WindowCommand } | null>(null);
  const evaluationRef = useRef<HTMLElement>(null), balanceRef = useRef<HTMLElement>(null), weatherRef = useRef<HTMLElement>(null);
  const sellRef = useRef<HTMLElement>(null), expertRef = useRef<HTMLElement>(null);
  const plannerRef = useRef<HTMLElement>(null), loansRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!navigation) return;
    const target = navigation.target === 'loans' ? loansRef.current
      : navigation.target === 'map' || navigation.target === 'edit' ? viewportRef.current
      : navigation.target === 'evaluation' ? evaluationRef.current : navigation.target === 'balance' ? balanceRef.current
      : navigation.target === 'sell' ? sellRef.current : navigation.target === 'weather' ? weatherRef.current
      : navigation.target === 'expert' ? expertRef.current : null;
    // Floating windows already occupy the desktop. Scrolling a child into view
    // also scrolls its overflow-hidden ancestors and displaces the entire map.
    target?.focus({ preventScroll: true });
  }, [navigation]);
  function navigate(target: FarmDestination) {
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null); setFieldMenu(null); setFieldMapTool(null);
    windows.show('bank');
    setNavigation({ target });
  }
  function activateEdit(event: { target: EventTarget }) {
    // Some ordinary/forced dialogs are React children of Edit, but own their depth.
    if (event.target instanceof Element && !event.target.closest('.game-window')) windows.show(null);
  }
  function openWindow(window: WindowCommand, source: 'menu' | 'toolbar') {
    if(fieldMapTool)cancelFieldTool();
    if(window!=='edit'&&windows.order.includes(window)){
      // Resident toolbar e9e0..ea16 raises a background window; the menu closes it.
      if(source==='toolbar'&&windows.active!==window)windows.raise(window);
      else windows.close(window);
      return;
    }
    windows.show(window === 'edit' ? null : window);
    if (window !== 'edit') {objectMove.cancel();construction.cancel();bulldoze.cancel();setBuyPlacement(null);setFieldMenu(null);setFieldMapTool(null);}
    if (window === 'buy') { setNavigation(null); return; }
    if (window === 'bank') { navigate('loans'); return; }
    if (window === 'map' || window === 'market') { setNavigation(null); return; }
    setNavigation({ target: window });
  }
  function editTool(tool: EditTool) {
    simulation?.dispatch({type:'edit-status',code:EDIT_TOOL_STATUSES[tool]});
    setInteractionMessage('');
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null); setFieldMenu(null); setFieldMapTool(null);
    if (tool === 'View object') { windows.show(null); }
    else if (tool === 'Move object') { objectMove.start();setSelection(null);setToolPointer(null);setBuyMessage('');setFieldToolMessage('');windows.show(null);viewportRef.current?.focus({preventScroll:true}); }
    else if (tool === 'Bulldoze') { bulldoze.start();setSelection(null);setToolPointer(null);windows.show(null);viewportRef.current?.focus({preventScroll:true}); }
    else if (tool === 'Paved road' || tool === 'Dirt road' || tool === 'Fence' || tool === 'Gate') {
      construction.start(tool==='Paved road'?'road-150':tool==='Dirt road'?'road-161':tool==='Fence'?'fence':'gate');setSelection(null);setToolPointer(null); windows.show(null);viewportRef.current?.focus({preventScroll:true});
    } else if (tool === 'Ditch' || tool === 'Valve') {
      construction.start(tool==='Ditch'?'ditch':'valve');setSelection(null);setToolPointer(null); windows.show(null);viewportRef.current?.focus({preventScroll:true});
    } else if (tool === 'Hay' || tool === 'Trough' || tool === 'Trees') {
      construction.start(tool === 'Hay' ? 'hay' : tool === 'Trough' ? 'trough' : 'trees');
      setSelection(null);setToolPointer(null);windows.show(null);viewportRef.current?.focus({preventScroll:true});
    }
  }
  const data = resource.status === 'ready' && snapshot ? { tiles: resource.value.tiles, scenario: snapshot.scenario } : null;
  const field = data?.scenario.fields.find(f => f.slot === fieldSlot && f.active);
  const cell = selection !== null ? data?.scenario.cells[selection] : undefined;
  const position = buyPlacement || fieldMapTool || objectMove.active || construction.tool || bulldoze.active ? toolPointer : selection !== null ? worldPosition(selection) : null;
  const hoveredField=position?data?.scenario.fields.find(f=>f.contains(position.x,position.y)):undefined;
  const constructionQuote=position?construction.quote(position.x,position.y):null;
  const preview = bulldoze.active ? bulldoze.preview(position) : construction.tool&&position ? {...position,width:1,height:1,valid:construction.enabled&&Boolean(constructionQuote?.ok)} : objectMove.active ? objectMove.preview(position) : fieldMapTool && position && data ? fieldMapTool.kind==='plant'
    ? {...position,width:8,height:8,valid:checkFieldPlacement(data.scenario,position.x,position.y).ok}
    : hoveredField ? {x:hoveredField.x,y:hoveredField.y,width:hoveredField.width,height:hoveredField.height,valid:true}: {...position,width:1,height:1,valid:false}
    : buyPlacement && buyPlacement.type < 8 && position && data && snapshot ? {...position,
      width:data.scenario.equipmentDefinitions[buyPlacement.type].width,height:data.scenario.equipmentDefinitions[buyPlacement.type].height,
      valid:checkEquipmentPurchase(data.scenario,buyPlacement.type,position.x,position.y,snapshot.weather.soilMoisture).ok}
    : buyPlacement && buyPlacement.type >= 64 && buyPlacement.type <= 72 && position && data && snapshot ? { ...position,
      width:data.scenario.buildingDefinitions[buyPlacement.type-64].width,height:data.scenario.buildingDefinitions[buyPlacement.type-64].height,
      valid:checkBuildingPlacement(data.scenario,buyPlacement.type,position.x,position.y,snapshot.weather.soilMoisture).ok }
    : buyPlacement && buyPlacement.type >= 160 && buyPlacement.type <= 163 && position && data && snapshot ? {...position,width:1,height:1,
      valid:checkLivestockPurchase(data.scenario,snapshot.finances,buyPlacement.type,position.x,position.y,snapshot.weather.soilMoisture).ok}
    : buyPlacement && buyPlacement.type >= 192 && position && data && snapshot ? {
    x: position.x,
    y: position.y,
    width: 1,
    height: 1,
    valid: checkCropSupplyPurchase(data.scenario,buyPlacement.type,position.x,position.y,snapshot.weather.soilMoisture).ok,
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
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setFieldMenu(null);setFieldMapTool(null);
    if (!simulation || !snapshot || snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight) return;
    setBuyMessage('');
    if (product.type === 8) {
      simulation.dispatch({ type: 'buy-aircraft' }); purchaseFeedback(simulation.getSnapshot().lastAircraftPurchaseResult,product.name);
      return;
    }
    setBuyPlacement({ type:product.type, name:product.name }); setToolPointer(null); setSelection(null);

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
  function openFieldMenu(kind:'plant'|'spray') {
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null);setFieldMapTool(null);setToolPointer(null);setFieldToolMessage('');setNavigation(null);
    windows.show(null);setFieldMenu(kind);
  }
  function cancelFieldTool(){setFieldMenu(null);setFieldMapTool(null);setToolPointer(null);setFieldToolMessage('');}
  function applyFieldTool(x:number,y:number){
    if(!simulation||!snapshot||!fieldMapTool||snapshot.pendingTown||snapshot.finances.defaultDecision||snapshot.aircraftFlight)return;
    const selected=data?.scenario.fields.find(f=>f.contains(x,y));
    simulation.dispatch(fieldMapTool.kind==='plant'?{type:'create-field',x,y,cropSlot:fieldMapTool.cropSlot}
      :{type:'treat-field',fieldSlot:selected?.slot??0,treatment:fieldMapTool.kind});
    const next=simulation.getSnapshot(),result=fieldMapTool.kind==='plant'?next.lastNewFieldResult:next.lastTreatmentResult;
    if(!result)return;
    if(result.ok){
      const slot=fieldMapTool.kind==='plant'&&'slot' in result?result.slot:selected?.slot;
      if(slot!==undefined)setFieldSlot(slot);
      setFieldToolMessage(fieldMapTool.kind==='plant'?`Field planted. ${result.source==='stored'?'Used seed in stock.':`Seed cost: $${result.cost}.`}`:'Treatment ordered.');
      if(fieldMapTool.kind==='plant'){setFieldMapTool(null);setToolPointer(null);}
    } else {
      const messages:Record<string,string>={'outside-map':'The entire field must fit inside the map.','not-owned':'Buy all the land under this field first.',
        'blocked-terrain':'Terrain blocks this field. Automatic clearing handles trees and fences; buildings and water still block planting.',
        'field-too-close':'Leave at least one tile between fields.','no-field-slots':'The farm has reached its field limit.',
        'no-seeds':'No seed in stock. Automatic seed buying is disabled.','insufficient-funds':'There is not enough cash.',
        'invalid-field':'Choose an existing field.','field-busy':'This field is already being worked.','no-supplies':'No treatment supply in stock. Automatic buying is disabled.'};
      setFieldToolMessage(messages[result.reason]??`Cannot apply this tool: ${result.reason.replaceAll('-',' ')}.`);
    }
  }
  const cancelObjectMove=useCallback(()=>{objectMove.cancel();setToolPointer(null);},[objectMove.cancel]);
  const cancelBulldoze=useCallback(()=>{bulldoze.cancel();setToolPointer(null);},[bulldoze.cancel]);
  const cancelConstruction=useCallback(()=>{construction.cancel();setToolPointer(null);},[construction.cancel]);
  useEffect(()=>{
    if(!objectMove.active&&!construction.tool&&!bulldoze.active)return;
    // File Save can leave focus outside Edit. Respect Escape handled by menus/dialogs.
    const cancel=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();if(objectMove.active)cancelObjectMove();else if(bulldoze.active)cancelBulldoze();else cancelConstruction();}
    };
    window.addEventListener('keydown',cancel);
    return()=>window.removeEventListener('keydown',cancel);
  },[objectMove.active,cancelObjectMove,construction.tool,cancelConstruction,bulldoze.active,cancelBulldoze]);
  function cancelPurchase() { setBuyPlacement(null); setToolPointer(null); setBuyMessage(''); }
  function enterMapWindow(index:number){
    if(!simulation)return false;
    const current=simulation.getSnapshot();
    if(current.pendingTown||current.finances.defaultDecision||current.aircraftFlight)return false;
    const {x,y}=worldPosition(index),entry=aircraftMapEntry(current.scenario,x,y);
    if(entry){if(entry.slot!==null){setAircraftSlot(entry.slot);windows.show('aircraft');}return true;}
    const town=townWindowAt(current.scenario,x,y);
    if(!town)return false;
    windows.show(town);return true;
  }
  function interactWithMap(index:number){
    if(enterMapWindow(index))return;
    if(!simulation)return;
    const current=simulation.getSnapshot();
    if(current.pendingTown||current.finances.defaultDecision||current.aircraftFlight)return;
    const {x,y}=worldPosition(index),command=mapObjectInteraction(current.scenario,x,y);
    setInteractionMessage('');
    if(!command)return;
    simulation.dispatch(command);
    const next=simulation.getSnapshot();
    if(command.type==='toggle-building-interior'){
      const result=next.lastBuildingInteriorResult;
      if(result?.ok)setInteractionMessage(result.open?'Building opened.':'Building closed.');
    }else if(command.type==='toggle-valve'){
      const result=next.lastIrrigationResult;
      if(result?.ok)setInteractionMessage(result.tile&1?'Valve closed.':'Valve opened.');
    }else if(next.lastNetworkResult?.ok)setInteractionMessage(command.tool==='open-gate'?'Gate opened.':'Gate closed.');
  }
  function selectField(slot: number | null, navigate: boolean) {
    const selected = data?.scenario.fields.find(f => f.slot === slot && f.active);
    setFieldSlot(selected?.slot ?? null);
    if (selected) {
      if (navigate) setFocus({ x: selected.x + selected.width / 2, y: selected.y + selected.height / 2 });
    }
  }
  return <>
    {simulation && <SaveControls options={{
      checked: [audioOptions.music, audioOptions.sound, ...FARM_OPTIONS.map(key=>simulation.getSnapshot().scenario.farm[key]),audioOptions.buttonClicks],
      extraLabels:['Button Click Sounds'],
      actions:[{label:'Settings…',choose:()=>windows.show('options')}],
      choose: index=>{
        if(index===0)audioOptions.toggleMusic();else if(index===1)audioOptions.toggleSound();else if(index===8)audioOptions.toggleButtonClicks();
        else {const option=FARM_OPTIONS[index-2];if(option){const enabled=!simulation.getSnapshot().scenario.farm[option];simulation.dispatch({type:'set-option',option,enabled});rememberPreference(option,enabled);}}
      },
    }} disasters={{
      checked: disasterMenuChecks(simulation.getSnapshot().disasters),
      disabled: Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight),
      choose: index=>{
        const action=index===6?'disable':DISASTER_MENU_KINDS[index]; if(!action)return;
        simulation.dispatch({type:'disaster-menu',action});
        if(action==='disable'){setInteractionMessage(simulation.getSnapshot().disasters.enabled?'New disasters enabled.':'New disasters disabled; active events continue.');return;}
        const result=simulation.getSnapshot().lastDisasterResult;
        setInteractionMessage(result?.ok?'':result?.reason==='no-fields'?'Create a field before starting locusts.':result?.reason==='tornado-active'?'Locusts cannot start during a tornado.':'That disaster is already active.');
      },
    }} simulation={simulation} scenarioId={id} tiles={data?.tiles??null} assets={assets} loaded={Boolean(loaded)} onLoad={onLoad} onNewGame={() => setNewFarmOpen(true)} onWindow={openWindow} />}
    <GameWindow windowKey="options" title="Settings"><section className="browser-settings" aria-label="View and audio settings">
      <label>Zoom <select id="zoom" value={zoom} onChange={e => onZoomChange(Number(e.target.value))}>
        <option value={0.5}>50%</option><option value={1}>100%</option><option value={2}>200%</option>
      </select></label>
      {audioControls}
    </section></GameWindow>
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
    </section>
    </GameWindow>
    <GameWindow windowKey="speed" title="Speed">
    {simulation && snapshot && <TimeControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    </GameWindow>
    <GameWindow windowKey="town" title="Town development" titleArtwork={assets.townChoiceArtwork.src} forced={Boolean(snapshot?.pendingTown)}>
    {simulation && snapshot && <TownChoicePanel assets={assets} snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    </GameWindow>
    <GameWindow windowKey="bank" title="Bank">
    {simulation && snapshot && <LoanPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)}
      artwork={assets.bankArtwork} onClose={() => windows.close('bank')} panelRef={loansRef} />}
    </GameWindow>
    {snapshot && simulation && <AircraftWindow assets={assets} selectedSlot={aircraftSlot} onSelect={setAircraftSlot} snapshot={snapshot} onCommand={command => simulation.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })}
      onFly={slot => { simulation.dispatch({ type: 'start-flight', slot, ...mapSize.current }); if (simulation.getSnapshot().aircraftFlight) windows.show(null); return Boolean(simulation.getSnapshot().aircraftFlight); }} />}
    {data && snapshot && <ScheduleWindow inspection={fieldInspection} assets={assets} snapshot={snapshot} tiles={data.tiles} field={field} focusRef={plannerRef}
      onSelect={slot=>{setSelection(null);selectField(slot,true);}} onNewField={()=>{windows.close('schedule');openFieldMenu('plant');}} onCommand={command=>simulation?.dispatch(command)}/>}
    {data && <ExpertWindow assets={assets} cropFiles={data.scenario.cropFiles} tiles={data.tiles} focusRef={expertRef} onEvent={onGameEvent}/>}
    {data && snapshot && <MarketWindow assets={assets} snapshot={snapshot} tiles={data.tiles}/>}
    {snapshot && <BalanceWindow assets={assets} snapshot={snapshot} focusRef={balanceRef}/>}
    {data && snapshot && <EvaluationWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={evaluationRef}/>}
    {data && snapshot && <WeatherWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={weatherRef}/>}
    {data && snapshot && <MapWindow assets={assets} snapshot={snapshot} onCommand={command=>simulation?.dispatch(command)} viewportRef={viewportRef} zoom={zoom}
      onLocate={(x,y)=>setFocus({x:x+(viewportRef.current?.clientWidth??0)/(32*zoom),y:y+(viewportRef.current?.clientHeight??0)/(32*zoom)})} />}
    {data && snapshot && <SellWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={sellRef} onCommand={command=>simulation?.dispatch(command)} />}
    {data && snapshot && simulation && <ExamineWindow assets={assets} snapshot={snapshot} tiles={data.tiles} position={position} onCommand={command=>simulation.dispatch(command)}/>}
    {data && snapshot && <BuyWindow assets={assets} snapshot={snapshot} tiles={data.tiles} onBuy={beginPurchase} />}
    {resource.status !== 'ready' && <div className="loading"><p role="status">{resource.status === 'error' ? resource.error : 'Loading farm…'}</p>
      <button aria-label="Edit tools and help" onClick={() => windows.show('tools')}>Choose another farm</button></div>}
      {simulation&&snapshot?.finances.defaultDecision&&!messages.length&&!newFarmOpen&&<DefaultDialog
        decision={snapshot.finances.defaultDecision} assets={assets} onCommand={command=>simulation.dispatch(command)}
        onRestart={()=>setNewFarmOpen(true)}/>}
    {data && <main className="edit-workspace" aria-label="Edit" onPointerDownCapture={activateEdit} onFocusCapture={activateEdit} onKeyDown={event => { if(objectMove.active&&event.key==='Escape'){event.preventDefault();cancelObjectMove();} if ((fieldMenu||fieldMapTool) && event.key==='Escape') {event.preventDefault();cancelFieldTool();} if (buyPlacement && event.key === 'Escape') { event.preventDefault(); cancelPurchase(); } }}>
      <EditPalette artwork={assets.editPalette} disabled={Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)} onTool={editTool}
        onField={() => openFieldMenu('plant')} onSpray={() => openFieldMenu('spray')} onHelp={() => {objectMove.cancel();bulldoze.cancel();construction.cancel();setBuyPlacement(null);setFieldMenu(null);setFieldMapTool(null);windows.show(null);setEditHelpOpen(open=>!open);}} />
      {snapshot&&<EditStatus codes={snapshot.editStatuses} text={assets.editStatusText}/>}
      {editHelpOpen&&<EditHelp artwork={assets.editHelp} onClose={()=>setEditHelpOpen(false)} onAdvanced={()=>{setEditHelpOpen(false);windows.show('tools');}}/>}
      {fieldMenu&&snapshot&&<FieldToolMenu kind={fieldMenu} assets={assets} world={data.scenario} tiles={data.tiles}
        onClose={()=>{setFieldMenu(null);viewportRef.current?.focus({preventScroll:true});}}
        onChoose={tool=>{simulation?.dispatch({type:'edit-status',code:tool.kind==='plant'?17:SPRAY_STATUSES[tool.kind]});setFieldMenu(null);setFieldMapTool(tool);setSelection(null);viewportRef.current?.focus({preventScroll:true});}}/>}
      <section className={`map-panel${snapshot?.aircraftFlight ? ' is-flying' : ''}`} data-object-move={objectMove.active?(objectMove.selected?'drop':'pick'):undefined}>
        {snapshot && simulation && <FlightControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
        <FarmMap animateWorkers={Boolean(snapshot && !snapshot.paused && !snapshot.pendingTown && !snapshot.finances.defaultDecision && !snapshot.aircraftFlight)} autoScroll={Boolean(snapshot?.scenario.farm.autoScroll && !windows.active && !editHelpOpen && !fieldMenu && !bulldoze.pending && !messages.length && !snapshot.pendingTown && !snapshot.finances.defaultDecision)} viewportRef={viewportRef} disasters={snapshot?.disasters ?? null} disasterSprites={assets.disasterSprites} flight={snapshot?.aircraftFlight ?? null} flightSprites={assets.flightSprites} onViewportSize={onViewportSize}
          onFlightControl={control => simulation?.dispatch({ type: 'flight-control', control })} scenario={data.scenario} tiles={tilesForWeather(data.tiles,snapshot?.weather)} maskedTiles={assets.maskedTiles} zoom={zoom} focus={focus}
          stopPaintingOutside={bulldoze.active} paintTool={bulldoze.enabled?'bulldoze':construction.enabled?construction.tool:undefined} onPaint={(index,initial)=>{if(initial&&!bulldoze.active&&enterMapWindow(index))return false;setInteractionMessage('');const {x,y}=worldPosition(index);return bulldoze.active?bulldoze.paint(x,y):construction.paint(x,y,initial);}}
          field={field} selection={selection} preview={preview} onPointer={onMapPointer} onSecondarySelect={interactWithMap} onSelect={index => {
            setInteractionMessage('');
            if(construction.tool||bulldoze.active)return;
            if(enterMapWindow(index))return;
            setSelection(index);
            const { x, y } = worldPosition(index);
            if(objectMove.active){objectMove.click(x,y);return;}
            if (buyPlacement) { placePurchase(x,y); return; }
            if (fieldMapTool) {applyFieldTool(x,y);return;}
            const selected=data.scenario.fields.find(f => f.contains(x,y));
            selectField(selected?.slot ?? null,false);
            if(selected)setFieldInspection({month:data.scenario.farm.calendar.month});
            windows.show(selected?'schedule':'examine');
          }} />
        <div className="map-footer">{bulldoze.active&&<><button id="cancel-bulldoze" onClick={cancelBulldoze}>Stop bulldozing</button><span id="bulldoze-result" role="status">{bulldoze.message}</span></>}{construction.tool&&<><button id="cancel-construction" onClick={cancelConstruction}>Stop construction</button><span id="construction-result" role="status">{construction.message}</span></>}<span id="map-interaction-result" role="status">{interactionMessage}</span>{objectMove.active&&<><button id="cancel-object-move" onClick={cancelObjectMove}>Cancel move</button><span id="object-move-result" role="status">{objectMove.message}</span></>}<span id="field-tool-result" role="status">{fieldToolMessage}</span>{fieldMapTool&&<button id="cancel-field-tool" onClick={cancelFieldTool}>Cancel field tool</button>}{buyPlacement && <button id="cancel-buy-placement" onClick={cancelPurchase}>Cancel purchase</button>}<span id="buy-result" role="status">{buyMessage}</span><span id="map-tool-hint">{bulldoze.active?'Bulldoze: click or drag to clear · Buildings and fields ask for confirmation · Escape stops':construction.tool?construction.hint:objectMove.active?objectMove.hint:fieldMapTool ? fieldMapTool.kind==='plant' ? `Plant ${assets.catalog.crops.find(c=>`${c.id}.crp`===data.scenario.cropFiles[fieldMapTool.cropSlot])?.name}: click the top-left corner of a new field · Escape cancels` : `${SPRAY_TOOLS.find(t=>t.kind===fieldMapTool.kind)?.label}: click an existing field · Escape cancels` : buyPlacement ? `${buyPlacement.name}: click to place · Escape cancels` : snapshot?.aircraftFlight ? 'Following aircraft · farm calendar suspended'
 : 'Scroll to explore · click a tile to examine'}</span>
          <span id="cell-status">{cell && position ? `Tile ${position.x}, ${position.y} · graphic ${terrainTile(cell)}` : '96 × 96 tiles'}</span>
        </div>
      </section>
      {bulldoze.pending&&<BulldozeDialog pending={bulldoze.pending} assets={assets} onConfirm={bulldoze.confirm} onCancel={bulldoze.dismiss}/>}
      {messages[0]&&(messages[0].type==='finance-notice'
        ? <FinanceMessage key={messages[0].serial} id={messages[0].id} assets={assets} onClose={closeMessage}/>
        : messages[0].type==='field-notice' ? <FieldMessage key={messages[0].serial} assets={assets} onClose={closeMessage}/>
        : messages[0].type==='building-notice' ? <BuildingMessage key={messages[0].serial} assets={assets} onClose={closeMessage}/>
        : <DisasterMessage key={messages[0].serial} id={messages[0].id} assets={assets} onClose={closeMessage}/>)}
    </main>}
  </>;
}
