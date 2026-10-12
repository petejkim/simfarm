import { HarvestWorkerAnimation } from '../render/harvest-workers';
import { drawDisasters, type DisasterSprites } from '../render/disaster-renderer';
import type { MovingDisasterState } from '../simulation/moving-disasters';
import { drawAircraft, flightPixelPosition, type FlightSprites } from '../render/aircraft-renderer';
import type { AircraftFlight, FlightControl } from '../simulation/aircraft-flight';
import { flightKey } from './FlightControls';
import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { WORLD_SIZE, worldIndex, type Scenario } from '../formats/scenario';
import { drawWorld, type MapPreview } from '../render/world-renderer';

export interface MapFocus { x: number; y: number }
interface Props {
  cursor?:string;
  autoScroll: boolean;
  animateWorkers: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  scenario: Scenario;
  flight: AircraftFlight | null;
  flightSprites: FlightSprites;
  disasters: MovingDisasterState | null;
  disasterSprites: DisasterSprites;
  onViewportSize: (size: { columns: number; rows: number }) => void;
  onFlightControl: (control: FlightControl) => void;
  tiles: CanvasImageSource;
  townEventTiles?: CanvasImageSource;
  maskedTiles: CanvasImageSource;
  zoom: number;
  focus: MapFocus;
  preview?: MapPreview;
  onSelect: (index: number) => void;
  onSecondarySelect: (index: number) => void;
  paintTool?: string | null;
  stopPaintingOutside?: boolean;
  onPaint: (index:number,initial:boolean)=>boolean;
  onPointer: (pointer: MapFocus | null) => void;
}
function followAircraft(viewport: HTMLDivElement, flight: AircraftFlight, zoom: number): void {
  const p = flightPixelPosition(flight);
  viewport.scrollTo((p.x + 16) * zoom - viewport.clientWidth / 2, (p.y + 16) * zoom - viewport.clientHeight / 2);
}
const directions: Record<string, [number, number]> = {
  ArrowLeft: [-64, 0], ArrowRight: [64, 0], ArrowUp: [0, -64], ArrowDown: [0, 64],
};

export function FarmMap({ cursor, animateWorkers, autoScroll, viewportRef, scenario, tiles, townEventTiles, maskedTiles, zoom, focus, preview, onSelect,onSecondarySelect,paintTool,onPaint,stopPaintingOutside, onPointer, flight, flightSprites, disasters, disasterSprites, onViewportSize, onFlightControl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stroke=useRef<{pointer:number;last:number|null}|null>(null),suppressClick=useRef(false);
  const stopPainting=useCallback(()=>{
    const active=stroke.current;stroke.current=null;
    if(active&&canvasRef.current?.hasPointerCapture(active.pointer))canvasRef.current.releasePointerCapture(active.pointer);
  },[]);
  useEffect(()=>{stopPainting();},[paintTool,stopPainting]);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)stopPainting();};
    window.addEventListener('blur',stopPainting);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('blur',stopPainting);document.removeEventListener('visibilitychange',hidden);stopPainting();};
  },[stopPainting]);
  const flightRef = useRef(flight);
  useLayoutEffect(() => { flightRef.current = flight; }, [flight]);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const updatePointer = useCallback(() => {
    const p = pointerRef.current, canvas = canvasRef.current, viewport = viewportRef.current;
    if (!p || !canvas || !viewport) { onPointer(null); return; }
    const bounds = viewport.getBoundingClientRect(), rect = canvas.getBoundingClientRect();
    const x = Math.floor((p.clientX - rect.left) / (16 * zoom)), y = Math.floor((p.clientY - rect.top) / (16 * zoom));
    onPointer(p.clientX >= bounds.left && p.clientX < bounds.left + viewport.clientWidth &&
      p.clientY >= bounds.top && p.clientY < bounds.top + viewport.clientHeight &&
      document.elementFromPoint(p.clientX,p.clientY)===canvas &&
      x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE ? { x, y } : null);
  }, [zoom, onPointer]);
  const clearPointer = useCallback(() => { pointerRef.current = null; onPointer(null); }, [onPointer]);
  useEffect(() => {
    const hide = () => { if (document.hidden) clearPointer(); };
    window.addEventListener('blur', clearPointer); window.addEventListener('resize', updatePointer);
    // Capture document/ancestor scrolling as well as the map's own scroll.
    window.addEventListener('scroll', updatePointer, true); document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', clearPointer); window.removeEventListener('resize', updatePointer);
      window.removeEventListener('scroll', updatePointer, true); document.removeEventListener('visibilitychange', hide);
    };
  }, [clearPointer, updatePointer]);
  useEffect(() => () => clearPointer(), [clearPointer]);
  useEffect(() => {
    if (!autoScroll || flight) return;
    let frame: number, last: number | null = null;
    const step = (now: number) => {
      const p = pointerRef.current, viewport = viewportRef.current;
      if (!document.hidden && p && viewport && document.elementFromPoint(p.clientX, p.clientY) === canvasRef.current) {
        const bounds = viewport.getBoundingClientRect(), x = p.clientX - bounds.left, y = p.clientY - bounds.top;
        // Source c6a0 tests screen coordinate 0 on the left/top, where the DOS pointer stops at the screen
        // edge. The browser viewport edges border the palette and message bar instead, so every side uses
        // the same 16px band as the source's right/bottom (display minus 17).
        const band = 16;
        const dx = x < band ? -1 : x >= viewport.clientWidth - band ? 1 : 0;
        const dy = y < band ? -1 : y >= viewport.clientHeight - band ? 1 : 0;
        if (!dx && !dy) last = null;
        else if (last === null) last = now;
        else if (now - last >= 200) {
          // Source c6a0 moves two 16px cells. Browser cadence replaces DOS polling.
          viewport.scrollBy(dx * 32 * zoom, dy * 32 * zoom); updatePointer(); last = now;
        }
      } else last = null;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [autoScroll, flight, zoom, updatePointer, viewportRef]);
  const workerAnimation=useRef(new HarvestWorkerAnimation()),paint=useRef(()=>{});
  const hasWorkers=scenario.cells.some(cell=>(cell.terrain&0x0800)!==0&&((cell.overlay&0x07ff)===1036||(cell.overlay&0x07ff)===1037));
  useEffect(()=>{
    const clock=workerAnimation.current;
    if(!hasWorkers){clock.reset();return;}
    if(!animateWorkers)return;
    let frame:number;
    const step=(now:number)=>{
      if(document.hidden)clock.suspend();
      else if(clock.advance(now))paint.current();
      frame=requestAnimationFrame(step);
    };
    const visibility=()=>clock.suspend();
    document.addEventListener('visibilitychange',visibility);
    frame=requestAnimationFrame(step);
    return()=>{cancelAnimationFrame(frame);clock.suspend();document.removeEventListener('visibilitychange',visibility);};
  },[hasWorkers,animateWorkers]);
  const previousZoom = useRef(zoom), previousFocus = useRef<MapFocus | null>(null);
  useLayoutEffect(() => {
    paint.current=()=>{
      const context = canvasRef.current!.getContext('2d')!;
      drawWorld(context, scenario, tiles, maskedTiles, flight ? undefined : preview,workerAnimation.current.phase,townEventTiles);
      if (flight) drawAircraft(context, flight, flightSprites);
      if (disasters) drawDisasters(context, disasters, disasterSprites);
    };paint.current();
  }, [scenario, tiles, townEventTiles, maskedTiles, preview, flight, flightSprites, disasters, disasterSprites]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current!;
    const measure = () => {
      const cells = (pixels: number) => Math.max(8, Math.min(80, Math.floor(pixels / (16 * zoom))));
      onViewportSize({ columns: cells(viewport.clientWidth), rows: cells(viewport.clientHeight) });
      if (flightRef.current) followAircraft(viewport, flightRef.current, zoom);
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(viewport);
    return () => observer.disconnect();
  }, [zoom, onViewportSize]);
  const flying = Boolean(flight);
  useLayoutEffect(() => {
    if (flying) { viewportRef.current!.focus({ preventScroll: true }); viewportRef.current!.scrollIntoView({ block: 'nearest' }); }
  }, [flying]);
  useLayoutEffect(updatePointer); // Panel layout changes can move the map beneath a stationary cursor.
  useLayoutEffect(() => {
    const viewport = viewportRef.current!;
    if (flight) {
      followAircraft(viewport, flight, zoom);
    } else if (focus !== previousFocus.current) {
      viewport.scrollTo(focus.x * 16 * zoom - viewport.clientWidth / 2, focus.y * 16 * zoom - viewport.clientHeight / 2);
    } else if (zoom !== previousZoom.current) {
      const ratio = zoom / previousZoom.current;
      viewport.scrollTo((viewport.scrollLeft + viewport.clientWidth / 2) * ratio - viewport.clientWidth / 2,
        (viewport.scrollTop + viewport.clientHeight / 2) * ratio - viewport.clientHeight / 2);
    }
    previousFocus.current = focus; previousZoom.current = zoom;
    updatePointer();
  }, [focus, zoom, updatePointer, flight]);
  function selectTile(event: MouseEvent<HTMLCanvasElement>,secondary=false) {
    if (flight) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (16 * zoom)), y = Math.floor((event.clientY - rect.top) / (16 * zoom));
    if (x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE) (secondary?onSecondarySelect:onSelect)(worldIndex(x, y));
  }
  function paintTile(event:MouseEvent<HTMLCanvasElement>,initial:boolean){
    const active=stroke.current;if(!active||!paintTool||flight)return;
    const viewport=viewportRef.current!,bounds=viewport.getBoundingClientRect(),rect=event.currentTarget.getBoundingClientRect();
    // Captured pointers can leave the canvas/viewport; never paint beneath controls.
    if(event.clientX<bounds.left||event.clientY<bounds.top||event.clientX>=bounds.left+viewport.clientWidth||event.clientY>=bounds.top+viewport.clientHeight){if(stopPaintingOutside)stopPainting();return;}
    const x=Math.floor((event.clientX-rect.left)/(16*zoom)),y=Math.floor((event.clientY-rect.top)/(16*zoom));
    if(x<0||y<0||x>=WORLD_SIZE||y>=WORLD_SIZE)return;
    const index=worldIndex(x,y);if(active.last===index)return;
    active.last=index;
    if(!onPaint(index,initial))stopPainting();
  }
  return <div id="viewport" ref={viewportRef} tabIndex={0} aria-label={flight ? "Farm map. Left and right arrows steer the aircraft. Home toggles spraying; End ends flight." : "Farm map. Scroll or use arrow keys to explore."}
    onKeyDown={event => {
      if (flight) { flightKey(event, onFlightControl); return; }
      const offset = directions[event.key];
      if (offset) { event.preventDefault(); event.currentTarget.scrollBy(...offset); }
    }}>
    <canvas id="world" ref={canvasRef} width={1536} height={1536} data-paint-tool={paintTool??undefined} style={{ cursor, width: 1536 * zoom, height: 1536 * zoom,touchAction:paintTool?'none':undefined }}
      aria-label="Original scenario terrain"
      onClick={event=>{if(suppressClick.current){suppressClick.current=false;return;}if(!paintTool)selectTile(event);}}
      onPointerDown={event=>{
        if(!event.isPrimary)return;
        if(event.button===2){stopPainting();event.preventDefault();selectTile(event,true);return;}
        if(event.button!==0)return;
        suppressClick.current=false;
        if(paintTool&&!flight&&event.buttons===1){
          event.preventDefault();viewportRef.current?.focus({preventScroll:true});
          suppressClick.current=true;stroke.current={pointer:event.pointerId,last:null};
          event.currentTarget.setPointerCapture(event.pointerId);paintTile(event,true);
        }
      }}
      onContextMenu={event=>event.preventDefault()}
      onPointerMove={event => {
        pointerRef.current = { clientX: event.clientX, clientY: event.clientY }; updatePointer();
        if(stroke.current?.pointer===event.pointerId){if(event.buttons===1)paintTile(event,false);else stopPainting();}
      }}
      onPointerLeave={clearPointer} onPointerCancel={()=>{stopPainting();clearPointer();}} onLostPointerCapture={stopPainting}
      onPointerUp={event => { if(stroke.current?.pointer===event.pointerId)stopPainting();if (event.pointerType === 'touch') clearPointer(); }} />
  </div>;
}
