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
import { ExpertWindow } from './ExpertWindow';
import { FieldPanel } from './FieldPanel';
import { ScheduleWindow } from './ScheduleWindow';
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
import { LivestockPanel } from './LivestockPanel';
import { EquipmentShop } from './EquipmentShop';
import { checkEquipmentPurchase } from '../simulation/equipment-purchase';
import { AircraftWindow } from './AircraftWindow';
import { aircraftMapEntry } from '../simulation/aircraft-view';
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
import { DISASTER_MENU_KINDS, disasterMenuChecks } from '../simulation/disaster-menu';
import { checkLivestockPurchase } from '../simulation/livestock-purchase';

const subscribeEmpty = () => () => {};
const emptySnapshot = () => null;

interface Props {
  audioControls: ReactNode;
  audioOptions: { music: boolean; sound: boolean; toggleMusic: () => void; toggleSound: () => void };
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
  const [messages,setMessages]=useState<(Extract<GameEvent,{type:'finance-notice'|'disaster-notice'|'field-notice'}>&{serial:number})[]>([]);
  const messageSerial=useRef(0);
  function closeMessage(){onGameEvent({type:'sound',sound:'click'});setMessages(previous=>previous.slice(1));}
  const onMapPointer = useCallback((pointer: MapFocus | null) => {
    simulation?.dispatch({ type: 'set-map-pointer', pointer });
    if (buyPlacement || fieldMapTool || objectMove.active || construction.tool || bulldoze.active) setToolPointer(old => old?.x === pointer?.x && old?.y === pointer?.y ? old : pointer);
  }, [simulation, buyPlacement, fieldMapTool, objectMove.active,construction.tool,bulldoze.active]);
  useEffect(() => simulation?.subscribeEvents(event=>{
    if(event.type==='finance-notice'||event.type==='disaster-notice'||event.type==='field-notice'){
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
  const [mapTool, setMapTool] = useState<MapTool>('inspect');
  const [navigation, setNavigation] = useState<{ target: FarmDestination | WindowCommand } | null>(null);
  const [taxOpen, setTaxOpen] = useState(false);
  const evaluationRef = useRef<HTMLElement>(null), balanceRef = useRef<HTMLElement>(null), weatherRef = useRef<HTMLElement>(null);
  const sellRef = useRef<HTMLElement>(null), expertRef = useRef<HTMLElement>(null);
  const plannerRef = useRef<HTMLElement>(null), loansRef = useRef<HTMLElement>(null);
  const networkRef = useRef<HTMLHeadingElement>(null);
  const supplyRef = useRef<HTMLHeadingElement>(null);
  const landRef = useRef<HTMLHeadingElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!navigation) return;
    const target = navigation.target === 'planner' ? plannerRef.current : navigation.target === 'loans' ? loansRef.current
      : navigation.target === 'network' ? networkRef.current : navigation.target === 'crop-supplies' ? supplyRef.current : navigation.target === 'map' || navigation.target === 'edit' ? viewportRef.current
      : navigation.target === 'evaluation' ? evaluationRef.current : navigation.target === 'balance' ? balanceRef.current
      : navigation.target === 'sell' ? sellRef.current : navigation.target === 'weather' ? weatherRef.current
      : navigation.target === 'expert' ? expertRef.current : landRef.current;
    target?.scrollIntoView({ block: 'start', inline: 'nearest' });
    target?.focus({ preventScroll: true });
  }, [navigation]);
  function navigate(target: FarmDestination) {
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null); setFieldMenu(null); setFieldMapTool(null);
    if (target === 'planner') setMapTool('inspect');
    if (target === 'land' || target === 'field' || target === 'crop-supplies' || target === 'network') setMapTool(target);
    windows.show(target === 'map' ? null : target === 'loans' ? 'bank' : target === 'planner' ? 'schedule' : 'actions');
    setNavigation({ target });
  }
  function openWindow(window: WindowCommand) {
    windows.show(window === 'edit' ? null : window);
    if (window !== 'edit') {objectMove.cancel();construction.cancel();bulldoze.cancel();setBuyPlacement(null);setFieldMenu(null);setFieldMapTool(null);}
    if (window === 'buy') { setNavigation(null); return; }
    if (window === 'bank') { navigate('loans'); return; }
    if (window === 'map' || window === 'market') { setNavigation(null); return; }
    setNavigation({ target: window });
  }
  const [buildingType, setBuildingType] = useState(64);
  const [networkTool, setNetworkTool] = useState<NetworkAction>('road-161');
  const [irrigationTool, setIrrigationTool] = useState<IrrigationTool>('ditch');
  const [equipmentType, setEquipmentType] = useState(0);
  const [cropSupplyType, setCropSupplyType] = useState(192);
  const [livestockType, setLivestockType] = useState(161);
  function chooseTool(tool: MapTool) { objectMove.cancel();construction.cancel();bulldoze.cancel();setBuyPlacement(null); setFieldMenu(null); setFieldMapTool(null); setMapTool(tool); windows.show('actions'); }
  function editTool(tool: EditTool) {
    setInteractionMessage('');
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null); setFieldMenu(null); setFieldMapTool(null);
    if (tool === 'View object') { setMapTool('inspect'); windows.show(null); }
    else if (tool === 'Move object') { objectMove.start();setMapTool('move');setSelection(null);setToolPointer(null);setBuyMessage('');setFieldToolMessage('');windows.show(null);viewportRef.current?.focus({preventScroll:true}); }
    else if (tool === 'Bulldoze') { bulldoze.start();setSelection(null);setToolPointer(null);setMapTool('remove');windows.show(null);viewportRef.current?.focus({preventScroll:true}); }
    else if (tool === 'Paved road' || tool === 'Dirt road' || tool === 'Fence' || tool === 'Gate') {
      setNetworkTool(tool === 'Paved road' ? 'road-150' : tool === 'Dirt road' ? 'road-161' : tool === 'Fence' ? 'fence' : 'gate');
      construction.start(tool==='Paved road'?'road-150':tool==='Dirt road'?'road-161':tool==='Fence'?'fence':'gate');setSelection(null);setToolPointer(null);setMapTool('network'); windows.show(null);viewportRef.current?.focus({preventScroll:true});
    } else if (tool === 'Ditch' || tool === 'Valve') {
      setIrrigationTool(tool === 'Ditch' ? 'ditch' : 'valve');construction.start(tool==='Ditch'?'ditch':'valve');setSelection(null);setToolPointer(null);setMapTool('irrigation'); windows.show(null);viewportRef.current?.focus({preventScroll:true});
    } else if (tool === 'Hay' || tool === 'Trough' || tool === 'Trees') {
      if(tool !== 'Trees')setLivestockType(tool === 'Hay' ? 300 : 299);
      construction.start(tool === 'Hay' ? 'hay' : tool === 'Trough' ? 'trough' : 'trees');
      setSelection(null);setToolPointer(null);setMapTool(tool === 'Trees' ? 'inspect' : 'livestock');windows.show(null);viewportRef.current?.focus({preventScroll:true});
    }
  }
  const data = resource.status === 'ready' && snapshot ? { tiles: resource.value.tiles, scenario: snapshot.scenario } : null;
  const field = data?.scenario.fields.find(f => f.slot === fieldSlot && f.active);
  const cell = selection !== null ? data?.scenario.cells[selection] : undefined;
  const position = buyPlacement || fieldMapTool || objectMove.active || construction.tool || bulldoze.active ? toolPointer : selection !== null ? worldPosition(selection) : null;
  const removal = position && data && mapTool === 'remove' ? checkManualRemoval(data.scenario, position.x, position.y) : null;
  const hoveredField=position?data?.scenario.fields.find(f=>f.contains(position.x,position.y)):undefined;
  const constructionQuote=position?construction.quote(position.x,position.y):null;
  const preview = bulldoze.active ? bulldoze.preview(position) : construction.tool&&position ? {...position,width:1,height:1,valid:construction.enabled&&Boolean(constructionQuote?.ok)} : objectMove.active ? objectMove.preview(position) : fieldMapTool && position && data ? fieldMapTool.kind==='plant'
    ? {...position,width:8,height:8,valid:checkFieldPlacement(data.scenario,position.x,position.y).ok}
    : hoveredField ? {x:hoveredField.x,y:hoveredField.y,width:hoveredField.width,height:hoveredField.height,valid:true}: {...position,width:1,height:1,valid:false}
    : mapTool === 'move' || mapTool === 'supply-move' ? position ? { ...position, width: 1, height: 1, valid: true } : undefined
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
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setFieldMenu(null);setFieldMapTool(null);
    if (!simulation || !snapshot || snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight) return;
    setBuyMessage('');
    if (product.type === 8) {
      simulation.dispatch({ type: 'buy-aircraft' }); purchaseFeedback(simulation.getSnapshot().lastAircraftPurchaseResult,product.name);
      return;
    }
    setBuyPlacement({ type:product.type, name:product.name }); setToolPointer(null); setSelection(null);
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
  function openFieldMenu(kind:'plant'|'spray') {
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null);setFieldMapTool(null);setToolPointer(null);setFieldToolMessage('');setNavigation(null);
    windows.show(null);setFieldMenu(kind);
  }
  function cancelFieldTool(){setFieldMenu(null);setFieldMapTool(null);setToolPointer(null);setMapTool('inspect');setFieldToolMessage('');}
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
      setFieldMapTool(null);setToolPointer(null);setMapTool('inspect');
    } else {
      const messages:Record<string,string>={'outside-map':'The entire field must fit inside the map.','not-owned':'Buy all the land under this field first.',
        'blocked-terrain':'Terrain blocks this field. Automatic clearing handles trees and fences; buildings and water still block planting.',
        'field-too-close':'Leave at least one tile between fields.','no-field-slots':'The farm has reached its field limit.',
        'no-seeds':'No seed in stock. Automatic seed buying is disabled.','insufficient-funds':'There is not enough cash.',
        'invalid-field':'Choose an existing field.','field-busy':'This field is already being worked.','no-supplies':'No treatment supply in stock. Automatic buying is disabled.'};
      setFieldToolMessage(messages[result.reason]??`Cannot apply this tool: ${result.reason.replaceAll('-',' ')}.`);
    }
  }
  const cancelObjectMove=useCallback(()=>{objectMove.cancel();setToolPointer(null);setMapTool('inspect');},[objectMove.cancel]);
  const cancelBulldoze=useCallback(()=>{bulldoze.cancel();setToolPointer(null);setMapTool('inspect');},[bulldoze.cancel]);
  const cancelConstruction=useCallback(()=>{construction.cancel();setToolPointer(null);setMapTool('inspect');},[construction.cancel]);
  useEffect(()=>{
    if(!objectMove.active&&!construction.tool&&!bulldoze.active)return;
    // File Save can leave focus outside Edit. Respect Escape handled by menus/dialogs.
    const cancel=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();if(objectMove.active)cancelObjectMove();else if(bulldoze.active)cancelBulldoze();else cancelConstruction();}
    };
    window.addEventListener('keydown',cancel);
    return()=>window.removeEventListener('keydown',cancel);
  },[objectMove.active,cancelObjectMove,construction.tool,cancelConstruction,bulldoze.active,cancelBulldoze]);
  function cancelPurchase() { setBuyPlacement(null); setToolPointer(null); setMapTool('inspect'); setBuyMessage(''); }
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
    }
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
      checked: [audioOptions.music, audioOptions.sound, ...(['autoBuySeeds','autoScroll','autoClear','autoGoto','messages','autoRent'] as const).map(key=>simulation.getSnapshot().scenario.farm[key])],
      choose: index=>{
        if(index===0)audioOptions.toggleMusic();else if(index===1)audioOptions.toggleSound();
        else {const option=(['autoBuySeeds','autoScroll','autoClear','autoGoto','messages','autoRent'] as const)[index-2];if(option)simulation.dispatch({type:'set-option',option,enabled:!simulation.getSnapshot().scenario.farm[option]});}
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
    }} simulation={simulation} scenarioId={id} assets={assets} loaded={Boolean(loaded)} onLoad={onLoad} onNewGame={() => setNewFarmOpen(true)} onWindow={openWindow} />}
    <GameWindow windowKey="options" title="Audio and tools">{audioControls}
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
    <button onClick={() => windows.show('options')}>Audio and tools</button>
    <button onClick={() => windows.show('disasters')}>Disaster details</button>
    <button onClick={() => windows.show('navigation')}>Farm controls</button>
    <button onClick={()=>chooseTool('inspect')}>Field orders</button>
    <button id="new-farm" onClick={() => setNewFarmOpen(true)}>New farm</button>
    {(['machinery', 'livestock', 'aircraft'] as const).map(key => <button key={key} onClick={() => windows.show(key)}>{key === 'machinery' ? 'Machinery' : key === 'livestock' ? 'Livestock' : 'Aircraft'}</button>)}
    </GameWindow>
    <GameWindow windowKey="speed" title="Speed">
    {simulation && snapshot && <TimeControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    </GameWindow>
    <GameWindow windowKey="navigation" title="Farm controls">
    {data && snapshot && <FarmNavigation tool={mapTool} blocked={Boolean(snapshot.pendingTown || snapshot.finances.defaultDecision || snapshot.aircraftFlight)} onNavigate={navigate} />}
    <button onClick={() => windows.show('tools')}>More tools</button></GameWindow>
    {snapshot?.lastHomesteadChange?.notice && <div id="homestead-notice" className="homestead-notice" role="status">
      <span>{snapshot.lastHomesteadChange.notice === 'improved'
        ? 'Your home has been improved after a rise in cash.' : 'Your home has been downgraded after a fall in cash.'}</span>
      <button id="view-home" onClick={() => setFocus({ x: snapshot.finances.homestead.x + 2, y: snapshot.finances.homestead.y + 2 })}>View home</button>
    </div>}
    <GameWindow windowKey="town" title="Town development" titleArtwork={assets.townChoiceArtwork.src} forced={Boolean(snapshot?.pendingTown)}>
    {simulation && snapshot && <TownChoicePanel assets={assets} onEvent={onGameEvent} snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    </GameWindow>
    <GameWindow windowKey="bank" title="Bank">
    {simulation && snapshot && <LoanPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)}
      artwork={assets.bankArtwork} onClose={() => windows.show(null)} panelRef={loansRef} />}
    </GameWindow>
    <GameWindow windowKey="taxes" title="Tax details">
    {snapshot && <TaxPanel snapshot={snapshot} open={taxOpen} onOpenChange={setTaxOpen} />}
    </GameWindow>
    <GameWindow windowKey="livestock" title="Livestock">
    {snapshot && <LivestockPanel snapshot={snapshot} onMoveSupplies={() => { chooseTool('supply-move'); setSelection(null); }} onShop={() => chooseTool('livestock')} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    </GameWindow>
    {snapshot && simulation && <AircraftWindow assets={assets} selectedSlot={aircraftSlot} onSelect={setAircraftSlot} snapshot={snapshot} onCommand={command => simulation.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })}
      onFly={slot => { simulation.dispatch({ type: 'start-flight', slot, ...mapSize.current }); if (simulation.getSnapshot().aircraftFlight) windows.show(null); return Boolean(simulation.getSnapshot().aircraftFlight); }} />}
    <GameWindow windowKey="machinery" title="Machinery">
    {snapshot && <MachineryPanel snapshot={snapshot} onMove={() => { chooseTool('move'); setSelection(null); }} onShop={() => chooseTool('equipment')} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    </GameWindow>
    <GameWindow windowKey="disasters" title="Disasters">
    {snapshot && <DisasterPanel snapshot={snapshot} onCommand={command => simulation?.dispatch(command)} onLocate={(x, y) => setFocus({ x, y })} />}
    </GameWindow>
    {data && snapshot && <ScheduleWindow inspection={fieldInspection} assets={assets} snapshot={snapshot} tiles={data.tiles} field={field} focusRef={plannerRef}
      onSelect={slot=>{setSelection(null);selectField(slot,true);}} onNewField={()=>navigate('field')} onCommand={command=>simulation?.dispatch(command)}/>}
    {data && <ExpertWindow assets={assets} cropFiles={data.scenario.cropFiles} tiles={data.tiles} focusRef={expertRef} onEvent={onGameEvent}/>}
    {data && snapshot && <MarketWindow assets={assets} snapshot={snapshot} tiles={data.tiles}/>}
    {snapshot && <BalanceWindow assets={assets} snapshot={snapshot} focusRef={balanceRef} onEvent={onGameEvent} onTaxes={()=>{setTaxOpen(true);windows.show('taxes');}}/>}
    {data && snapshot && <EvaluationWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={evaluationRef} onEvent={onGameEvent}/>}
    {data && snapshot && <WeatherWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={weatherRef} onEvent={onGameEvent}/>}
    {data && snapshot && <MapWindow assets={assets} snapshot={snapshot} onCommand={command=>simulation?.dispatch(command)} viewportRef={viewportRef} zoom={zoom}
      onLocate={(x,y)=>setFocus({x:x+(viewportRef.current?.clientWidth??0)/(32*zoom),y:y+(viewportRef.current?.clientHeight??0)/(32*zoom)})} />}
    {data && snapshot && <SellWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={sellRef} onCommand={command=>simulation?.dispatch(command)} />}
    {data && snapshot && simulation && <ExamineWindow assets={assets} snapshot={snapshot} tiles={data.tiles} position={position} onCommand={command=>simulation.dispatch(command)}/>}
    {data && snapshot && <BuyWindow assets={assets} snapshot={snapshot} tiles={data.tiles} onBuy={beginPurchase} />}
    {resource.status !== 'ready' && <div className="loading"><p role="status">{resource.status === 'error' ? resource.error : 'Loading farm…'}</p>
      <button aria-label="Edit tools and help" onClick={() => windows.show('tools')}>Choose another farm</button></div>}
      {simulation&&snapshot?.finances.defaultDecision&&!messages.length&&!newFarmOpen&&<DefaultDialog
        decision={snapshot.finances.defaultDecision} assets={assets} onCommand={command=>simulation.dispatch(command)} onEvent={onGameEvent}
        onRestart={()=>setNewFarmOpen(true)}/>}
    {data && <main className="edit-workspace" aria-label="Edit" onKeyDown={event => { if(objectMove.active&&event.key==='Escape'){event.preventDefault();cancelObjectMove();} if ((fieldMenu||fieldMapTool) && event.key==='Escape') {event.preventDefault();cancelFieldTool();} if (buyPlacement && event.key === 'Escape') { event.preventDefault(); cancelPurchase(); } }}>
      <div className="edit-title">Edit</div>
      <EditPalette artwork={assets.editPalette} disabled={Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)} onTool={editTool}
        onField={() => openFieldMenu('plant')} onSpray={() => openFieldMenu('spray')} onHelp={() => {objectMove.cancel();bulldoze.cancel();construction.cancel();setBuyPlacement(null);setFieldMenu(null);setFieldMapTool(null);windows.show(null);setEditHelpOpen(open=>!open);}} />
      {snapshot&&<EditStatus codes={snapshot.editStatuses} text={assets.editStatusText}/>}
      {editHelpOpen&&<EditHelp artwork={assets.editHelp} onClose={()=>setEditHelpOpen(false)} onAdvanced={()=>{setEditHelpOpen(false);windows.show('tools');}}/>}
      {fieldMenu&&snapshot&&<FieldToolMenu kind={fieldMenu} assets={assets} world={data.scenario} tiles={data.tiles}
        onClose={()=>{setFieldMenu(null);viewportRef.current?.focus({preventScroll:true});}}
        onChoose={tool=>{if(tool.kind==='plant')simulation?.dispatch({type:'edit-status',code:17});setFieldMenu(null);setFieldMapTool(tool);setMapTool(tool.kind==='plant'?'field':'inspect');setSelection(null);viewportRef.current?.focus({preventScroll:true});}}/>}
      <section className={`map-panel${snapshot?.aircraftFlight ? ' is-flying' : ''}`} data-object-move={objectMove.active?(objectMove.selected?'drop':'pick'):undefined}>
        {snapshot && simulation && <FlightControls snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
        <FarmMap autoScroll={Boolean(snapshot?.scenario.farm.autoScroll && !windows.active && !editHelpOpen && !fieldMenu && !bulldoze.pending && !messages.length && !snapshot.pendingTown && !snapshot.finances.defaultDecision)} viewportRef={viewportRef} disasters={snapshot?.disasters ?? null} disasterSprites={assets.disasterSprites} flight={snapshot?.aircraftFlight ?? null} flightSprites={assets.flightSprites} onViewportSize={onViewportSize}
          onFlightControl={control => simulation?.dispatch({ type: 'flight-control', control })} scenario={data.scenario} tiles={data.tiles} maskedTiles={assets.maskedTiles} zoom={zoom} focus={focus}
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
            if(mapTool==='inspect'&&selected)setFieldInspection({month:data.scenario.farm.calendar.month});
            windows.show(mapTool==='inspect'?(selected?'schedule':'examine'):'actions');
          }} />
        <div className="map-footer">{bulldoze.active&&<><button id="cancel-bulldoze" onClick={cancelBulldoze}>Stop bulldozing</button><span id="bulldoze-result" role="status">{bulldoze.message}</span></>}{construction.tool&&<><button id="cancel-construction" onClick={cancelConstruction}>Stop construction</button><span id="construction-result" role="status">{construction.message}</span></>}<span id="map-interaction-result" role="status">{interactionMessage}</span>{objectMove.active&&<><button id="cancel-object-move" onClick={cancelObjectMove}>Cancel move</button><span id="object-move-result" role="status">{objectMove.message}</span></>}<span id="field-tool-result" role="status">{fieldToolMessage}</span>{fieldMapTool&&<button id="cancel-field-tool" onClick={cancelFieldTool}>Cancel field tool</button>}{buyPlacement && <button id="cancel-buy-placement" onClick={cancelPurchase}>Cancel purchase</button>}<span id="buy-result" role="status">{buyMessage}</span><span id="map-tool-hint">{bulldoze.active?'Bulldoze: click or drag to clear · Buildings and fields ask for confirmation · Escape stops':construction.tool?construction.hint:objectMove.active?objectMove.hint:fieldMapTool ? fieldMapTool.kind==='plant' ? `Plant ${assets.catalog.crops.find(c=>`${c.id}.crp`===data.scenario.cropFiles[fieldMapTool.cropSlot])?.name}: click the top-left corner of a new field · Escape cancels` : `${SPRAY_TOOLS.find(t=>t.kind===fieldMapTool.kind)?.label}: click an existing field · Escape cancels` : buyPlacement ? `${buyPlacement.name}: click to place · Escape cancels` : snapshot?.aircraftFlight ? 'Following aircraft · farm calendar suspended' : mapTool === 'land' ? 'Click to select a plot to buy' : mapTool === 'field'
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
          {!fieldMapTool && !construction.tool && (mapTool === 'land' || mapTool === 'field' || mapTool === 'crop-supplies' || mapTool === 'network') && <button disabled={!position || Boolean(snapshot?.pendingTown || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)}
            onClick={() => navigate(mapTool)}>{mapTool === 'network' ? 'Review construction' : mapTool === 'land' ? 'Review plot' : mapTool === 'crop-supplies' ? 'Review supplies' : 'Review field'}</button>}
        </div>
      </section>
      {bulldoze.pending&&<BulldozeDialog pending={bulldoze.pending} assets={assets} onConfirm={bulldoze.confirm} onCancel={bulldoze.dismiss}/>}
      {messages[0]&&(messages[0].type==='finance-notice'
        ? <FinanceMessage key={messages[0].serial} id={messages[0].id} assets={assets} onClose={closeMessage}/>
        : messages[0].type==='field-notice' ? <FieldMessage key={messages[0].serial} assets={assets} onClose={closeMessage}/>
        : <DisasterMessage key={messages[0].serial} id={messages[0].id} assets={assets} onClose={closeMessage}/>)}
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
        {mapTool === 'inspect' && <button onClick={()=>navigate('planner')}>Crop planner</button>}
        </fieldset>
      </GameWindow>
    </main>}
  </>;
}
