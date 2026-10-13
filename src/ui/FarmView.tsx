import { TownEventMessage } from './TownEventMessage';
import { BuildingMessage } from './BuildingMessage';
import {FARM_OPTIONS,applyPreferredOptions,rememberPreference} from './preferences';
import {tilesForWeather} from '../assets/weather-tiles';
import {EDIT_TOOL_STATUSES,SPRAY_STATUSES} from '../simulation/edit-status';
import {EditStatus} from './EditStatus';
import {FieldMessage} from './FieldMessage';
import {BalanceWindow} from './BalanceWindow';
import {DisasterMessage} from './DisasterMessage';
import {CheatMessage} from './CheatMessage';
import {FinanceMessage} from './FinanceMessage';
import {DefaultDialog} from './DefaultDialog';
import {EvaluationWindow} from './EvaluationWindow';
import { MarketWindow } from './MarketWindow';
import { WeatherWindow } from './WeatherWindow';
import { townWindowAt } from '../simulation/town-window';
import { findTownExpansionSite } from '../simulation/town';
import { growableTownSites } from '../simulation/town-development';
import { useBulldoze } from './useBulldoze';
import { BulldozeDialog } from './BulldozeDialog';
import { useConstruction } from './useConstruction';
import { useObjectMove } from './useObjectMove';
import { mapObjectInteraction } from '../simulation/map-interaction';
import { ExamineWindow } from './ExamineWindow';
import { FieldToolMenu } from './FieldToolMenu';
import type { FieldMapTool } from '../formats/field-tool-menu';
import { MapWindow } from './MapWindow';
import { BuyWindow } from './BuyWindow';
import type { ShopProduct } from '../simulation/shop-product';
import { GameWindow, useWindows } from './GameWindow';
import { EditPalette, type EditTool, type EditPaletteAction } from './EditPalette';
import type { ConstructionTool } from './useConstruction';
const CONSTRUCTION_TOOLS:Record<ConstructionTool,EditTool>={'road-150':'Paved road','road-161':'Dirt road',fence:'Fence',gate:'Gate',ditch:'Ditch',valve:'Valve',hay:'Hay',trough:'Trough',trees:'Trees'};
import type { GameWindow as WindowCommand } from './ControlBar';
import { NewFarmControls } from './NewFarmControls';
import { FLIGHT_KEY_REPEAT_MS, flightControlForKey, flightKeyRepeats } from './flight-keys';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadScenarioAssets, type GameAssets } from '../assets/game-assets';
import { worldPosition, worldIndex } from '../formats/scenario';
import { ExpertWindow } from './ExpertWindow';
import { ScheduleWindow } from './ScheduleWindow';
import { FarmMap, type MapFocus } from './FarmMap';
import { useResource } from './useResource';
import { CHEAT_DONATION, GameSimulation, type GameCommand } from '../simulation/game';
import { speedMenu, TimeStatus } from './SpeedMenu';
import { SaveControls, type LoadedFarm } from './SaveControls';
import type { Autosave } from '../storage/autosave';
import { SellWindow } from './SellWindow';
import { LoanPanel } from './LoanPanel';
import { AircraftWindow } from './AircraftWindow';
import { aircraftMapEntry } from '../simulation/aircraft-view';
import { TownChoicePanel } from './TownChoicePanel';
import type { GameEvent } from '../simulation/events';
import { DISASTER_MENU_KINDS, disasterMenuChecks } from '../simulation/disaster-menu';

const subscribeEmpty = () => () => {};
const emptySnapshot = () => null;

type FarmDestination = 'loans';
interface Props {
  audioControls: ReactNode;
  audioOptions: { music: boolean; sound: boolean; buttonClicks:boolean; toggleButtonClicks:()=>void; toggleMusic: () => void; toggleSound: () => void };
  id: number | null;
  loaded?: LoadedFarm;
  /** Browser-stored current game: follows this farm; `autosaveNow` saves it as soon as it starts. */
  autosave: Autosave; autosaveNow: boolean; startMessage?: string;
  onLoad: (farm: LoadedFarm) => void;
  onRetry: () => void;
  assets: GameAssets;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onGameEvent: (event: GameEvent) => void;
  onFlightRunning: (running: boolean) => void;
}
/** Each new/loaded farm has its own mount, subscriptions, clock and UI selection. */
export function FarmView({ audioControls, audioOptions, id, loaded, autosave, autosaveNow, startMessage, onLoad, onRetry, assets, zoom, onZoomChange, onGameEvent, onFlightRunning }: Props) {
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
  useEffect(() => simulation ? autosave.attach(simulation, id, autosaveNow) : undefined, [simulation]);
  const [fieldMenu,setFieldMenu]=useState<'plant'|'spray'|null>(null),[fieldMapTool,setFieldMapTool]=useState<FieldMapTool|null>(null);
  const [aircraftSlot,setAircraftSlot]=useState<number|null>(null);
  const [buyPlacement, setBuyPlacement] = useState<Pick<ShopProduct, 'type' | 'name'> | null>(null);
  const [toolPointer, setToolPointer] = useState<MapFocus | null>(null);
  const snapshot = useSyncExternalStore(simulation?.subscribe ?? subscribeEmpty, simulation?.getSnapshot ?? emptySnapshot);
  const objectMove=useObjectMove(simulation,snapshot,onGameEvent);
  const construction=useConstruction(simulation,snapshot);
  const bulldoze=useBulldoze(simulation,snapshot);
  const [messages,setMessages]=useState<(Extract<GameEvent,{type:'finance-notice'|'disaster-notice'|'field-notice'|'building-notice'|'cheat-notice'}>&{serial:number})[]>([]);
  const messageSerial=useRef(0);
  // Queued message count, kept in step with events and acknowledgements synchronously so the frame loop
  // holds time from the very tick that raised a message until OK (not from React's later commit).
  const heldMessages=useRef(0);
  function closeMessage(){heldMessages.current=Math.max(0,heldMessages.current-1);setMessages(previous=>previous.slice(1));}
  const onMapPointer = useCallback((pointer: MapFocus | null) => {
    simulation?.dispatch({ type: 'set-map-pointer', pointer });
    setToolPointer(old => old?.x === pointer?.x && old?.y === pointer?.y ? old : pointer);
  }, [simulation]);
  useEffect(() => simulation?.subscribeEvents(event=>{
    if(event.type==='finance-notice'||event.type==='disaster-notice'||event.type==='field-notice'||event.type==='building-notice'||event.type==='cheat-notice'){
      const message={...event,serial:++messageSerial.current};
      heldMessages.current++;setMessages(previous=>[...previous,message]);
    }else if(event.type==='map-focus')setFocus({x:event.x,y:event.y});
    else onGameEvent(event);
  }), [simulation, onGameEvent]);
  const flightRunning = Boolean(snapshot?.aircraftFlight && !snapshot.paused);
  const flying = Boolean(snapshot?.aircraftFlight);
  useEffect(() => {
    if (!simulation || !flying) return;
    // Flight keys work wherever focus is, except while typing in a form field. One control per press; a held
    // turn/altitude key repeats only after the flight consumed the last control, so the queue never floods.
    const held = new Map<string, number>();
    const release = (code: string) => { const timer = held.get(code); if (timer !== undefined) { clearInterval(timer); held.delete(code); } };
    const releaseAll = () => { for (const code of [...held.keys()]) release(code); };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.repeat && held.has(event.code)) { event.preventDefault(); return; }
      const control = flightControlForKey(event); if (!control) return;
      event.preventDefault(); event.stopPropagation();
      simulation.dispatch({ type: 'flight-control', control });
      if (flightKeyRepeats(control) && !held.has(event.code)) held.set(event.code, window.setInterval(() => {
        const flight = simulation.getSnapshot().aircraftFlight;
        if (!flight) { releaseAll(); return; }
        if (!flight.inputs.length) simulation.dispatch({ type: 'flight-control', control });
      }, FLIGHT_KEY_REPEAT_MS));
    };
    const onKeyUp = (event: KeyboardEvent) => {
      release(event.code);
      // Space activates a focused button on key-up; while flying it only toggles spraying.
      const target = event.target as HTMLElement | null;
      if (!target?.closest('input,textarea,select,[contenteditable="true"]') && flightControlForKey({ code: event.code, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, repeat: false })) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('keydown', onKeyDown, true); window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', releaseAll);
    return () => { releaseAll(); window.removeEventListener('keydown', onKeyDown, true); window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', releaseAll); };
  }, [simulation, flying]);
  useEffect(() => { onFlightRunning(flightRunning); return () => onFlightRunning(false); }, [flightRunning, onFlightRunning]);
  const mapSize = useRef({ columns: 20, rows: 16 }), mapStroke = useRef(false);
  const onViewportSize = useCallback((size: { columns: number; rows: number }) => { mapSize.current = size; }, []);
  useEffect(() => {
    if (!simulation) return;
    let frame: number, previous: number | null = null;
    const tick = (now: number) => {
      // Background tabs do not accumulate days; wall-clock pacing remains outside the simulation rules.
      // A held construction/bulldoze stroke freezes time as the original's mouse-held loops do (docs/direct-construction.md).
      if (!document.hidden && previous !== null && !bulldoze.pendingRef.current && !heldMessages.current && !mapStroke.current) simulation.tick(Math.min(250, Math.max(0, now - previous)));
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [simulation,bulldoze.pendingRef]);
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
    // Choosing any other palette action ends examining: the Examine window closes.
    if (tool !== 'View object') windows.close('examine');
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null); setFieldMenu(null); setFieldMapTool(null);
    if (tool === 'View object') { windows.show(null); }
    else if (tool === 'Move object') { objectMove.start();setSelection(null);setToolPointer(null);windows.show(null);viewportRef.current?.focus({preventScroll:true}); }
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
  // Depressed palette button: the running action, else the default View object (examine) mode.
  const paletteAction:EditPaletteAction = objectMove.active ? 'Move object' : bulldoze.active ? 'Bulldoze'
    : construction.tool ? CONSTRUCTION_TOOLS[construction.tool] : fieldMenu==='plant'||fieldMapTool?.kind==='plant' ? 'Plant' : fieldMenu||fieldMapTool ? 'Spray' : 'View object';
  const data = resource.status === 'ready' && snapshot ? { tiles: resource.value.tiles, scenario: snapshot.scenario } : null;
  const field = data?.scenario.fields.find(f => f.slot === fieldSlot && f.active);
  const position = buyPlacement || fieldMapTool || objectMove.active || construction.tool || bulldoze.active ? toolPointer : selection !== null ? worldPosition(selection) : null;
  // Source mode11 uses only hand cursors; other tools draw their footprint
  // regardless of placement validity. Canonical commands validate actual clicks.
  const preview = objectMove.active ? undefined : bulldoze.active ? bulldoze.preview(position)
    : !toolPointer||fieldMenu ? undefined
    : fieldMapTool?.kind==='plant' ? {...toolPointer,width:8,height:8}
    : buyPlacement&&data&&buyPlacement.type<8 ? {...toolPointer,
      width:data.scenario.equipmentDefinitions[buyPlacement.type].width,height:data.scenario.equipmentDefinitions[buyPlacement.type].height}
    : buyPlacement&&data&&buyPlacement.type>=64&&buyPlacement.type<=72 ? {...toolPointer,
      width:data.scenario.buildingDefinitions[buyPlacement.type-64].width,height:data.scenario.buildingDefinitions[buyPlacement.type-64].height}
    : {...toolPointer,width:1,height:1};
  function beginPurchase(product: Pick<ShopProduct, 'type' | 'name'>) {
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setFieldMenu(null);setFieldMapTool(null);
    if (!simulation || !snapshot || snapshot.pendingTown || snapshot.townEvent.pending || snapshot.finances.defaultDecision || snapshot.aircraftFlight) return;
    if (product.type === 8) { simulation.dispatch({ type: 'buy-aircraft' }); return; }
    setBuyPlacement({ type:product.type, name:product.name }); setToolPointer(null); setSelection(null);

    windows.show(null); viewportRef.current?.focus({ preventScroll: true });
  }
  function placePurchase(x: number, y: number) {
    if (!simulation || !buyPlacement || !snapshot || snapshot.pendingTown || snapshot.townEvent.pending || snapshot.finances.defaultDecision || snapshot.aircraftFlight) return;
    const type = buyPlacement.type;
    if (type < 8) simulation.dispatch({ type: 'buy-equipment', equipmentType: type, x, y });
    else if (type < 128) simulation.dispatch({ type: 'build', buildingType: type, x, y });
    else if (type < 192) simulation.dispatch({ type: 'buy-livestock', productType: type, x, y });
    else simulation.dispatch({ type: 'buy-crop-supply', productType: type, x, y });
  }
  function openFieldMenu(kind:'plant'|'spray') {
    objectMove.cancel();construction.cancel();bulldoze.cancel();
    setBuyPlacement(null);setFieldMapTool(null);setToolPointer(null);setNavigation(null);
    windows.close('examine');windows.show(null);setFieldMenu(kind);
  }
  function cancelFieldTool(){setFieldMenu(null);setFieldMapTool(null);setToolPointer(null);}
  function applyFieldTool(x:number,y:number){
    if(!simulation||!snapshot||!fieldMapTool||snapshot.pendingTown||snapshot.townEvent.pending||snapshot.finances.defaultDecision||snapshot.aircraftFlight)return;
    const selected=data?.scenario.fields.find(f=>f.contains(x,y));
    simulation.dispatch(fieldMapTool.kind==='plant'?{type:'create-field',x,y,cropSlot:fieldMapTool.cropSlot}
      :{type:'treat-field',fieldSlot:selected?.slot??0,treatment:fieldMapTool.kind});
    const next=simulation.getSnapshot(),result=fieldMapTool.kind==='plant'?next.lastNewFieldResult:next.lastTreatmentResult;
    if(!result)return;
    if(result.ok){
      const slot=fieldMapTool.kind==='plant'&&'slot' in result?result.slot:selected?.slot;
      // Plant, like Spray, stays armed for repeated field clicks until another control is chosen (user request).
      if(slot!==undefined)setFieldSlot(slot);
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
  function cancelPurchase() { setBuyPlacement(null); setToolPointer(null); }
  function enterMapWindow(index:number){
    if(!simulation)return false;
    const current=simulation.getSnapshot();
    if(current.pendingTown||current.townEvent.pending||current.finances.defaultDecision||current.aircraftFlight)return false;
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
    if(current.pendingTown||current.townEvent.pending||current.finances.defaultDecision||current.aircraftFlight)return;
    const {x,y}=worldPosition(index),command=mapObjectInteraction(current.scenario,x,y);
    if(command)simulation.dispatch(command);
  }
  function selectField(slot: number | null, navigate: boolean) {
    const selected = data?.scenario.fields.find(f => f.slot === slot && f.active);
    setFieldSlot(selected?.slot ?? null);
    if (selected) {
      if (navigate) setFocus({ x: selected.x + selected.width / 2, y: selected.y + selected.height / 2 });
    }
  }
  const mapCursor=snapshot?.aircraftFlight?null:bulldoze.active||construction.tool?'bulldoze':objectMove.active?(objectMove.selected?'drop':'pick'):
    fieldMapTool?(fieldMapTool.kind==='plant'?'bulldoze':'spray'):buyPlacement?'buy':'view';
  const cursorHotspot=mapCursor==='pick'||mapCursor==='drop'?8:0;
  return <>
    {simulation && <SaveControls debug={{
      checked:[],
      disabled:Boolean(snapshot?.pendingTown||snapshot?.townEvent.pending||snapshot?.finances.defaultDecision||snapshot?.aircraftFlight),
      disabledItems:[
        !snapshot?.finances.town.recreationCount||Boolean(snapshot.townEvent.mode||snapshot.townEvent.weeksRemaining)||snapshot.scenario.farm.cash<1000,
        !snapshot?.finances.town.recreationCount||Boolean(snapshot.townEvent.mode||snapshot.townEvent.weeksRemaining),
        !snapshot?.townEvent.mode||!snapshot.townEvent.weeksRemaining,
        !snapshot||!findTownExpansionSite(snapshot.scenario),
        !snapshot||!growableTownSites(snapshot.scenario).length,
        !snapshot?.disasters.enabled||Boolean(snapshot.disasters.flags&64)||!snapshot.scenario.fields.some(f=>f.slot&&f.active),
        !snapshot?.disasters.enabled||Boolean(snapshot.disasters.flags&128),
        false,
        false,((snapshot?.scenario.farm.cash??0)|0)<CHEAT_DONATION,false,
      ],
      hints:['Requires a recreation district, $1,000 and no active event.','Requires a recreation district and no active event.','Advances only the active event countdown; the farm date stays unchanged.','Opens the town expansion choice now (requires a free site; skips the town fund). Not kept in saves.','Raises every unfinished town district one level now (requires one below level 13; no town revenue spent).','Original debug Shift+A (mode7): picks a random field; only wheat, barley, oats or sorghum get circles, otherwise nothing happens. Requires disasters enabled.','Unreachable original mode8 (SF-179): shows message51 and sets a flag that never clears, so it works once per farm. No damage or fine. Requires disasters enabled.','Arms Buy placement for machinery type6 ("Not a Llama.", $250, 1x1), which the original Buy catalog omits. Click the map to buy it through the ordinary machinery purchase.','Original typed code LLAMA: shows the Will Wright quote with the otherwise unused llama photograph. No other effect.','Original typed code FUND: donates $10,000 of your cash to the town expansion fund, which pays for town expansions and maintenance shortfalls. Requires $10,000 cash. (The original never charged you; SF-180.)','Original typed code CORN: silently adds $10,000 to your cash.'],
      choose:index=>{if(index===3){simulation.dispatch({type:'debug-town-expansion'});return;}if(index===4){simulation.dispatch({type:'debug-town-grow'});return;}if(index===5){simulation.dispatch({type:'start-disaster',kind:'crop-circles'});return;}if(index===6){simulation.dispatch({type:'start-disaster',kind:'toxic-land'});return;}if(index===7){beginPurchase({type:6,name:'Not a Llama.'});return;}const cheat=(['LLAMA','FUND','CORN'] as const)[index-8];if(cheat){simulation.dispatch({type:'debug-cheat',code:cheat});return;}const action=(['rodeo','fair','advance-week'] as const)[index];if(action)simulation.dispatch({type:'debug-town-event',action});},
    }} speed={speedMenu(snapshot, command => simulation.dispatch(command))} options={{
      checked: [audioOptions.music, audioOptions.sound, ...FARM_OPTIONS.map(key=>simulation.getSnapshot().scenario.farm[key]),audioOptions.buttonClicks],
      extraLabels:['Button Click Sounds'],
      separated:true,actions:[{label:'Settings…',choose:()=>windows.show('options')}],
      choose: index=>{
        if(index===0)audioOptions.toggleMusic();else if(index===1)audioOptions.toggleSound();else if(index===8)audioOptions.toggleButtonClicks();
        else {const option=FARM_OPTIONS[index-2];if(option){const enabled=!simulation.getSnapshot().scenario.farm[option];simulation.dispatch({type:'set-option',option,enabled});rememberPreference(option,enabled);}}
      },
    }} disasters={{
      checked: disasterMenuChecks(simulation.getSnapshot().disasters),
      disabled: Boolean(snapshot?.pendingTown || snapshot?.townEvent.pending || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight),
      choose: index=>{
        const action=index===6?'disable':DISASTER_MENU_KINDS[index]; if(!action)return;
        simulation.dispatch({type:'disaster-menu',action});
      },
    }} simulation={simulation} scenarioId={id} tiles={data?.tiles??null} assets={assets} loaded={Boolean(loaded)} startMessage={startMessage} onSaveGame={() => autosave.save()} onLoad={onLoad} onNewGame={() => setNewFarmOpen(true)} onWindow={openWindow} />}
    <GameWindow windowKey="options" title="Settings" framed><section className="native-window browser-settings" aria-label="View and audio settings">
      <label className="native-row"><span className="native-label">Zoom</span><select id="zoom" className="chrome-select" value={zoom} onChange={e => onZoomChange(Number(e.target.value))}>
        <option value={0.5}>50%</option><option value={1}>100%</option><option value={2}>200%</option>
      </select></label>
      {audioControls}
    </section></GameWindow>
    <GameWindow windowKey="newgame" title="New Game" framed forced={newFarmOpen} onClose={() => setNewFarmOpen(false)}>
    {simulation && <NewFarmControls assets={assets} simulation={simulation} open={newFarmOpen} onOpenChange={setNewFarmOpen} onCreate={onLoad} />}
    </GameWindow>
    <span id="map-status" className="file-status" role="status">{resource.status === 'ready' ? (id === null ? `${snapshot?.scenario.origin === 'original' ? 'Imported' : 'Generated'} farm · original terrain` : `Scenario ${id + 1} · original terrain`)
          : resource.status === 'error' ? resource.error : 'Loading map…'}</span>
    {snapshot && <TimeStatus snapshot={snapshot} />}
    <GameWindow windowKey="town" title="Town development" framed titleArtwork={assets.townChoiceArtwork.src} forced={Boolean(snapshot?.pendingTown)}>
    {simulation && snapshot && <TownChoicePanel assets={assets} snapshot={snapshot} onCommand={command => simulation.dispatch(command)} />}
    </GameWindow>
    <GameWindow windowKey="bank" title="Bank" framed>
    {simulation && snapshot && <LoanPanel snapshot={snapshot} onCommand={command => simulation.dispatch(command)}
      onClose={() => windows.close('bank')} panelRef={loansRef} />}
    </GameWindow>
    {snapshot && simulation && <AircraftWindow assets={assets} selectedSlot={aircraftSlot} snapshot={snapshot} onCommand={command => simulation.dispatch(command)}
      onFly={slot => { simulation.dispatch({ type: 'start-flight', slot, ...mapSize.current }); if (simulation.getSnapshot().aircraftFlight) windows.show(null); return Boolean(simulation.getSnapshot().aircraftFlight); }} />}
    {data && snapshot && <ScheduleWindow inspection={fieldInspection} assets={assets} snapshot={snapshot} tiles={data.tiles} field={field} focusRef={plannerRef}
      onCommand={command=>simulation?.dispatch(command)}/>}
    {data && <ExpertWindow assets={assets} cropFiles={data.scenario.cropFiles} tiles={data.tiles} focusRef={expertRef} onEvent={onGameEvent}/>}
    {data && snapshot && <MarketWindow assets={assets} snapshot={snapshot} tiles={data.tiles}/>}
    {snapshot && <BalanceWindow assets={assets} snapshot={snapshot} focusRef={balanceRef}/>}
    {data && snapshot && <EvaluationWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={evaluationRef}/>}
    {data && snapshot && <WeatherWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={weatherRef}/>}
    {data && snapshot && <MapWindow assets={assets} snapshot={snapshot} onCommand={command=>simulation?.dispatch(command)} viewportRef={viewportRef} zoom={zoom}
      onLocate={(x,y)=>setFocus({x:x+(viewportRef.current?.clientWidth??0)/(32*zoom),y:y+(viewportRef.current?.clientHeight??0)/(32*zoom)})} />}
    {data && snapshot && <SellWindow assets={assets} snapshot={snapshot} tiles={data.tiles} focusRef={sellRef} onCommand={command=>simulation?.dispatch(command)} />}
    {data && snapshot && simulation && <ExamineWindow assets={assets} snapshot={snapshot} tiles={data.tiles} position={position}/>}
    {data && snapshot && <BuyWindow assets={assets} snapshot={snapshot} tiles={data.tiles} onBuy={beginPurchase} />}
    {resource.status !== 'ready' && <div className="loading"><p role="status">{resource.status === 'error' ? resource.error : 'Loading farm…'}</p>
      {resource.status === 'error' && <button onClick={onRetry}>Retry loading farm</button>}
      </div>}
      {simulation&&snapshot?.finances.defaultDecision&&!messages.length&&!newFarmOpen&&<DefaultDialog
        decision={snapshot.finances.defaultDecision} assets={assets} onCommand={command=>simulation.dispatch(command)}
        onRestart={()=>setNewFarmOpen(true)}/>}
    {data && <main className="edit-workspace" aria-label="Edit" onPointerDownCapture={activateEdit} onFocusCapture={activateEdit} onKeyDown={event => { if(objectMove.active&&event.key==='Escape'){event.preventDefault();cancelObjectMove();} if ((fieldMenu||fieldMapTool) && event.key==='Escape') {event.preventDefault();cancelFieldTool();} if (buyPlacement && event.key === 'Escape') { event.preventDefault(); cancelPurchase(); } }}>
      <EditPalette artwork={assets.editPalette} active={paletteAction} disabled={Boolean(snapshot?.pendingTown || snapshot?.townEvent.pending || snapshot?.finances.defaultDecision || snapshot?.aircraftFlight)} onTool={editTool}
        onField={() => openFieldMenu('plant')} onSpray={() => openFieldMenu('spray')} />
      {fieldMenu&&snapshot&&<FieldToolMenu kind={fieldMenu} assets={assets} world={data.scenario} tiles={data.tiles}
        onClose={()=>{setFieldMenu(null);viewportRef.current?.focus({preventScroll:true});}}
        onChoose={tool=>{simulation?.dispatch({type:'edit-status',code:tool.kind==='plant'?17:SPRAY_STATUSES[tool.kind]});setFieldMenu(null);setFieldMapTool(tool);setSelection(null);viewportRef.current?.focus({preventScroll:true});}}/>}
      {/* Message bar above the terrain viewport; both fill the column right of the palette. */}
      <div className="edit-main">
      {snapshot&&<EditStatus codes={snapshot.editStatuses} text={assets.editStatusText}/>}
      <section className={`map-panel${snapshot?.aircraftFlight ? ' is-flying' : ''}`} data-object-move={objectMove.active?(objectMove.selected?'drop':'pick'):undefined}>
        <FarmMap cursor={mapCursor?`url("${assets.editCursors[mapCursor].src}") ${cursorHotspot} ${cursorHotspot}, crosshair`:undefined} animateWorkers={Boolean(snapshot && !snapshot.paused && !snapshot.pendingTown && !snapshot.townEvent.pending && !snapshot.finances.defaultDecision && !snapshot.aircraftFlight)} autoScroll={Boolean(snapshot?.scenario.farm.autoScroll && !windows.active && !fieldMenu && !bulldoze.pending && !messages.length && !snapshot.pendingTown && !snapshot.townEvent.pending && !snapshot.finances.defaultDecision)} viewportRef={viewportRef} disasters={snapshot?.disasters ?? null} disasterSprites={assets.disasterSprites} flight={snapshot?.aircraftFlight ?? null} flightSprites={assets.flightSprites} onViewportSize={onViewportSize} scenario={data.scenario} tiles={tilesForWeather(data.tiles,snapshot?.weather)} townEventTiles={tilesForWeather(assets.townEventTiles[snapshot?.townEvent.artworkMode ?? 0],snapshot?.weather)} maskedTiles={assets.maskedTiles} zoom={zoom} focus={focus}
          onStroke={active=>{mapStroke.current=active;}} stopPaintingOutside={bulldoze.active} paintTool={bulldoze.enabled?'bulldoze':construction.enabled?construction.tool:undefined} onPaint={(index,initial)=>{if(initial&&!bulldoze.active&&enterMapWindow(index))return false;const {x,y}=worldPosition(index);return bulldoze.active?bulldoze.paint(x,y):construction.paint(x,y,initial);}}
          preview={preview} onPointer={onMapPointer} onSecondarySelect={interactWithMap} onSelect={index => {
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
            // Examining anything other than a field replaces the field's Schedule window.
            if(!selected)windows.close('schedule');
            windows.show(selected?'schedule':'examine');
          }} />
      </section>
      </div>
      {bulldoze.pending&&<BulldozeDialog pending={bulldoze.pending} assets={assets} onConfirm={bulldoze.confirm} onCancel={bulldoze.dismiss}/>}
      {simulation&&snapshot?.townEvent.pending&&!messages.length&&!newFarmOpen&&<TownEventMessage state={snapshot.townEvent} assets={assets} onResolve={accept=>simulation.dispatch({type:'resolve-town-event',accept})}/>}
      {messages[0]&&(messages[0].type==='finance-notice'
        ? <FinanceMessage key={messages[0].serial} id={messages[0].id} assets={assets} onClose={closeMessage}/>
        : messages[0].type==='field-notice' ? <FieldMessage key={messages[0].serial} assets={assets} onClose={closeMessage}/>
        : messages[0].type==='building-notice' ? <BuildingMessage key={messages[0].serial} assets={assets} onClose={closeMessage}/>
        : messages[0].type==='cheat-notice' ? <CheatMessage key={messages[0].serial} id={messages[0].id} assets={assets} onClose={closeMessage}/>
        : <DisasterMessage key={messages[0].serial} id={messages[0].id} assets={assets} onClose={closeMessage}/>)}
    </main>}
  </>;
}
