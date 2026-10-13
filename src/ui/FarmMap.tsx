import { HarvestWorkerAnimation } from '../render/harvest-workers';
import { cssZoom } from './css-zoom';
import { drawDisasters, type DisasterSprites } from '../render/disaster-renderer';
import type { MovingDisasterState } from '../simulation/moving-disasters';
import { drawAircraft, flightPixelPosition, type FlightSprites } from '../render/aircraft-renderer';
import type { AircraftFlight } from '../simulation/aircraft-flight';
import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { WORLD_SIZE, worldIndex, type Scenario } from '../formats/scenario';
import { pinchView, settledZoom } from './pinch-zoom';
import { drawWorldBase, drawWorldPreview, type MapPreview } from '../render/world-renderer';

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
  /** A held paint stroke began (true) or ended (false). */
  onStroke?: (active:boolean)=>void;
  onPointer: (pointer: MapFocus | null) => void;
  /** Touch only: the first tap highlights the tool footprint, a second tap on the same tile commits it. */
  confirmTaps?: boolean;
  /** Identifies the armed tool; a change clears the highlighted touch tile. */
  toolKey?: string;
  /** A finished pinch settles on this zoom (the view already shows it, anchored under the fingers). */
  onZoom?: (zoom: number) => void;
  /** A touch drag (past the tap slop) or a pinch on the terrain started (true) or every finger lifted (false). */
  onDrag?: (active: boolean) => void;
}
/** Touch movement beyond this many CSS pixels pans instead of tapping. */
const TAP_SLOP = 8;
/** A touch held still this long acts as the right button (valves, gates, building interiors). */
export const LONG_PRESS_MS = 500;
function followAircraft(viewport: HTMLDivElement, flight: AircraftFlight, zoom: number): void {
  const p = flightPixelPosition(flight);
  viewport.scrollTo((p.x + 16) * zoom - viewport.clientWidth / 2, (p.y + 16) * zoom - viewport.clientHeight / 2);
}
const directions: Record<string, [number, number]> = {
  ArrowLeft: [-64, 0], ArrowRight: [64, 0], ArrowUp: [0, -64], ArrowDown: [0, 64],
};

export function FarmMap({ cursor, animateWorkers, autoScroll, viewportRef, scenario, tiles, townEventTiles, maskedTiles, zoom, focus, preview, onSelect,onSecondarySelect,paintTool,onPaint,onStroke,stopPaintingOutside, onPointer, flight, flightSprites, disasters, disasterSprites, onViewportSize, confirmTaps = false, toolKey, onZoom, onDrag }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stroke=useRef<{pointer:number;last:number|null}|null>(null),suppressClick=useRef(false);
  const strokeCallback=useRef(onStroke);strokeCallback.current=onStroke;
  const stopPainting=useCallback(()=>{
    const active=stroke.current;stroke.current=null;
    if(active&&canvasRef.current?.hasPointerCapture(active.pointer))canvasRef.current.releasePointerCapture(active.pointer);
    if(active)strokeCallback.current?.(false);
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
  // Touch has no hover (native, user request): a tapped tile stays highlighted as the tool pointer in world
  // coordinates, so it does not drift while the map pans. A mouse pointer, when present, takes precedence.
  const armed = useRef<MapFocus | null>(null);
  // The tile a touch went down on, highlighted before it is armed (user request); re-renders keep showing it.
  const touched = useRef<MapFocus | null>(null);
  const touch = useRef<{ pointer: number; x: number; y: number; left: number; top: number; moved: boolean; held: boolean; pan: boolean; paint: boolean; timer: number } | null>(null);
  const updatePointer = useCallback(() => {
    const p = pointerRef.current, canvas = canvasRef.current, viewport = viewportRef.current;
    if (!p || !canvas || !viewport) { onPointer(touched.current ?? armed.current); return; }
    const bounds = viewport.getBoundingClientRect(), rect = canvas.getBoundingClientRect(), s = cssZoom(canvas);
    const x = Math.floor((p.clientX - rect.left) / (16 * zoom * s)), y = Math.floor((p.clientY - rect.top) / (16 * zoom * s));
    onPointer(p.clientX >= bounds.left && p.clientX < bounds.left + viewport.clientWidth * s &&
      p.clientY >= bounds.top && p.clientY < bounds.top + viewport.clientHeight * s &&
      document.elementFromPoint(p.clientX,p.clientY)===canvas &&
      x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE ? { x, y } : null);
  }, [zoom, onPointer]);
  const clearPointer = useCallback(() => { pointerRef.current = null; onPointer(touched.current ?? armed.current); }, [onPointer]);
  useLayoutEffect(() => { armed.current = null; touched.current = null; }, [toolKey, confirmTaps]);
  const endTouch = useCallback(() => { if (touch.current) clearTimeout(touch.current.timer); touch.current = null; }, []);
  /** A touch that becomes something else (pan, long press, pinch, cancel) puts the highlight back on the armed tile. */
  const revertTouch = useCallback(() => {
    if (!touched.current) return;
    touched.current = null; onPointer(armed.current);
  }, [onPointer]);
  useEffect(() => endTouch, [endTouch]);
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
        const bounds = viewport.getBoundingClientRect(), s = cssZoom(viewport), x = (p.clientX - bounds.left) / s, y = (p.clientY - bounds.top) / s;
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
  const previewRef=useRef<HTMLCanvasElement>(null);
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
  // Pinch zoom (native, user request). Two touches take over from taps, strokes and native scrolling: the canvas is
  // resized and scrolled directly every move, so the gesture does not re-render the game, and the content point
  // under the fingers' midpoint stays beneath it (moving both fingers also pans). On release the zoom is kept as the
  // Zoom setting, without the usual recentring.
  const dragCallback = useRef(onDrag); dragCallback.current = onDrag;
  useEffect(() => {
    // Touch events keep arriving during native scrolling, unlike pointer events, which the browser cancels.
    const viewport = viewportRef.current!;
    let origin: { x: number; y: number } | null = null, dragging = false;
    const set = (active: boolean) => { if (dragging !== active) { dragging = active; dragCallback.current?.(active); } };
    const down = (event: TouchEvent) => { if (event.touches.length > 1) set(true); else origin = { x: event.touches[0].clientX, y: event.touches[0].clientY }; };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length > 1 || (origin && touch && Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > TAP_SLOP)) set(true);
    };
    const up = (event: TouchEvent) => { if (!event.touches.length) { origin = null; set(false); } };
    const options = { passive: true };
    viewport.addEventListener('touchstart', down, options); viewport.addEventListener('touchmove', move, options);
    viewport.addEventListener('touchend', up, options); viewport.addEventListener('touchcancel', up, options);
    return () => {
      viewport.removeEventListener('touchstart', down); viewport.removeEventListener('touchmove', move);
      viewport.removeEventListener('touchend', up); viewport.removeEventListener('touchcancel', up); set(false);
    };
  }, [viewportRef]);
  const zoomCallback = useRef(onZoom); zoomCallback.current = onZoom;
  useEffect(() => {
    const viewport = viewportRef.current!, canvas = canvasRef.current!;
    let pinch: { distance: number; zoom: number; contentX: number; contentY: number; current: number } | null = null;
    const measure = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]], rect = viewport.getBoundingClientRect(), s = cssZoom(viewport);
      return { distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
        x: ((a.clientX + b.clientX) / 2 - rect.left) / s - viewport.clientLeft, y: ((a.clientY + b.clientY) / 2 - rect.top) / s - viewport.clientTop };
    };
    const apply = (value: number, left: number, top: number) => {
      canvas.style.width = canvas.style.height = `${1536 * value}px`; viewport.scrollTo(left, top);
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2 || flightRef.current) return;
      if (event.cancelable) event.preventDefault();
      endTouch(); revertTouch(); stopPainting(); suppressClick.current = true;
      const m = measure(event.touches);
      pinch = { distance: m.distance, zoom, current: zoom,
        contentX: (viewport.scrollLeft + m.x) / zoom, contentY: (viewport.scrollTop + m.y) / zoom };
    };
    const move = (event: TouchEvent) => {
      if (!pinch || event.touches.length < 2) return;
      if (event.cancelable) event.preventDefault();
      const m = measure(event.touches), view = pinchView(pinch, m.distance / pinch.distance, m);
      pinch.current = view.zoom; apply(view.zoom, view.scrollLeft, view.scrollTop);
    };
    const end = (event: TouchEvent) => {
      if (!pinch || event.touches.length >= 2) return;
      const { current } = pinch; pinch = null;
      // Keep the zoom the fingers left (to whole percent) around the viewport centre's content point.
      const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / current, centerY = (viewport.scrollTop + viewport.clientHeight / 2) / current;
      const settled = settledZoom(current);
      apply(settled, centerX * settled - viewport.clientWidth / 2, centerY * settled - viewport.clientHeight / 2);
      if (settled !== zoom) { previousZoom.current = settled; zoomCallback.current?.(settled); }
    };
    // iOS Safari's own page pinch (gesture events) never applies to the map.
    const gesture = (event: Event) => event.preventDefault();
    viewport.addEventListener('touchstart', start, { passive: false }); viewport.addEventListener('touchmove', move, { passive: false });
    viewport.addEventListener('touchend', end); viewport.addEventListener('touchcancel', end);
    viewport.addEventListener('gesturestart', gesture); viewport.addEventListener('gesturechange', gesture);
    return () => {
      viewport.removeEventListener('touchstart', start); viewport.removeEventListener('touchmove', move);
      viewport.removeEventListener('touchend', end); viewport.removeEventListener('touchcancel', end);
      viewport.removeEventListener('gesturestart', gesture); viewport.removeEventListener('gesturechange', gesture);
      if (pinch) apply(zoom, viewport.scrollLeft, viewport.scrollTop);
    };
  }, [zoom, endTouch, revertTouch, stopPainting, viewportRef]);
  useLayoutEffect(() => {
    paint.current=()=>{
      const context = canvasRef.current!.getContext('2d')!;
      drawWorldBase(context, scenario, tiles, maskedTiles, workerAnimation.current.phase, townEventTiles);
      if (flight) drawAircraft(context, flight, flightSprites);
      if (disasters) drawDisasters(context, disasters, disasterSprites);
    };paint.current();
  }, [scenario, tiles, townEventTiles, maskedTiles, flight, flightSprites, disasters, disasterSprites]);
  // The placement preview (tool highlight) is a separate small canvas over the world, sized to the footprint plus a
  // cell of border (native, user suggestion). Highlight changes repaint and re-upload only that canvas, never the
  // 1536×1536 world, which made dragging in placement modes stutter on the iPhone; the look is the source's
  // inverted cells clipped to the footprint outline.
  const previewBox=preview&&!flight?{x:Math.max(0,preview.x-1),y:Math.max(0,preview.y-1),
    right:Math.min(WORLD_SIZE,preview.x+preview.width+1),bottom:Math.min(WORLD_SIZE,preview.y+preview.height+1)}:null;
  useLayoutEffect(()=>{
    const overlay=previewRef.current;if(!overlay||!previewBox||!preview)return;
    const context=overlay.getContext('2d')!;
    context.clearRect(0,0,overlay.width,overlay.height);context.save();context.translate(-previewBox.x*16,-previewBox.y*16);
    drawWorldPreview(context,scenario,tiles,maskedTiles,preview,workerAnimation.current.phase,townEventTiles);context.restore();
  });
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
  function tileAt(clientX: number, clientY: number): MapFocus | null {
    const rect = canvasRef.current!.getBoundingClientRect(), s = cssZoom(canvasRef.current!);
    const x = Math.floor((clientX - rect.left) / (16 * zoom * s)), y = Math.floor((clientY - rect.top) / (16 * zoom * s));
    return x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE ? { x, y } : null;
  }
  function tap(clientX: number, clientY: number) {
    const tile = tileAt(clientX, clientY); if (!tile || flight) return;
    if (confirmTaps && (armed.current?.x !== tile.x || armed.current?.y !== tile.y)) { armed.current = tile; touched.current = null; onPointer(tile); return; }
    onSelect(worldIndex(tile.x, tile.y));
  }
  function touchDown(event: PointerEvent<HTMLCanvasElement>) {
    endTouch(); suppressClick.current = true; // Taps are handled on pointerup; the compatibility click is ignored.
    const tile = tileAt(event.clientX, event.clientY), viewport = viewportRef.current!;
    // A paint tool owns touch-action: pressing its highlighted tile paints (a tap paints that tile once);
    // pressing anywhere else pans the map by hand or taps to move the highlight. Pressing the armed tile confirms at
    // touchdown (user request): a paint tool starts its stroke there, other two-tap tools act at once. A pinch whose
    // first finger lands on the armed tile therefore builds that tile; one starting elsewhere builds nothing.
    const onArmed = Boolean(confirmTaps && !flight && tile && armed.current?.x === tile.x && armed.current?.y === tile.y);
    const paint = Boolean(paintTool && !flight && tile && armed.current?.x === tile.x && armed.current?.y === tile.y);
    if (paint) viewport.focus({ preventScroll: true });
    const pan = Boolean(paintTool);
    if (pan) event.currentTarget.setPointerCapture(event.pointerId);
    const { clientX, clientY } = event;
    // Two-tap tools highlight the touched tile at once (user request); it is armed only when the touch ends as a tap.
    if (confirmTaps && tile && !flight) { touched.current = tile; onPointer(tile); }
    touch.current = { pointer: event.pointerId, x: clientX, y: clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false, held: false, pan, paint,
      timer: paint ? 0 : window.setTimeout(() => {
        const active = touch.current; if (!active || active.moved || flight) return;
        active.held = true; revertTouch(); const held = tileAt(clientX, clientY); if (held) onSecondarySelect(worldIndex(held.x, held.y));
      }, LONG_PRESS_MS) };
    if (paint) { beginTouchStroke(touch.current); return; }
    // A confirmed non-paint tool acts now; the lift is not another tap (held skips it).
    if (onArmed) { clearTimeout(touch.current.timer); touch.current.held = true; onSelect(worldIndex(tile!.x, tile!.y)); }
  }
  function touchMove(event: PointerEvent<HTMLCanvasElement>) {
    if (stroke.current?.pointer === event.pointerId) {
      paintTile(event, false);
      const tile = tileAt(event.clientX, event.clientY);
      if (tile && stroke.current) { armed.current = tile; touched.current = null; onPointer(tile); }
      return;
    }
    const active = touch.current; if (active?.pointer !== event.pointerId) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (active.paint && Math.hypot(dx, dy) > TAP_SLOP) { beginTouchStroke(active); touchMove(event); return; }
    if (!active.moved && Math.hypot(dx, dy) > TAP_SLOP) { active.moved = true; clearTimeout(active.timer); revertTouch(); }
    if (active.moved && active.pan) { const s = cssZoom(viewportRef.current!); viewportRef.current!.scrollTo(active.left - dx / s, active.top - dy / s); }
  }
  function touchUp(event: PointerEvent<HTMLCanvasElement>) {
    if (stroke.current?.pointer === event.pointerId) { stopPainting(); return; }
    const active = touch.current; if (active?.pointer !== event.pointerId) return;
    if (active.paint) { beginTouchStroke(active); stopPainting(); return; }
    endTouch();
    if (!active.moved && !active.held) tap(event.clientX, event.clientY);
  }
  /** A press on the highlighted tile becomes a stroke, painting the pressed tile first. */
  function beginTouchStroke(active: { pointer: number; x: number; y: number }) {
    endTouch(); stroke.current = { pointer: active.pointer, last: null }; onStroke?.(true);
    paintTile({ clientX: active.x, clientY: active.y }, true);
  }
  function selectTile(event: MouseEvent<HTMLCanvasElement>,secondary=false) {
    if (flight) return;
    const rect = event.currentTarget.getBoundingClientRect(), s = cssZoom(event.currentTarget);
    const x = Math.floor((event.clientX - rect.left) / (16 * zoom * s)), y = Math.floor((event.clientY - rect.top) / (16 * zoom * s));
    if (x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE) (secondary?onSecondarySelect:onSelect)(worldIndex(x, y));
  }
  function paintTile(event:{clientX:number;clientY:number},initial:boolean){
    const active=stroke.current;if(!active||!paintTool||flight)return;
    const viewport=viewportRef.current!,bounds=viewport.getBoundingClientRect(),rect=canvasRef.current!.getBoundingClientRect(),s=cssZoom(viewport);
    // Captured pointers can leave the canvas/viewport; never paint beneath controls.
    if(event.clientX<bounds.left||event.clientY<bounds.top||event.clientX>=bounds.left+viewport.clientWidth*s||event.clientY>=bounds.top+viewport.clientHeight*s){if(stopPaintingOutside)stopPainting();return;}
    const x=Math.floor((event.clientX-rect.left)/(16*zoom*s)),y=Math.floor((event.clientY-rect.top)/(16*zoom*s));
    if(x<0||y<0||x>=WORLD_SIZE||y>=WORLD_SIZE)return;
    const index=worldIndex(x,y);if(active.last===index)return;
    active.last=index;
    if(!onPaint(index,initial))stopPainting();
  }
  return <div id="viewport" ref={viewportRef} tabIndex={0} aria-label={flight ? "Farm map. Left and right arrows steer the aircraft. Home toggles spraying; End ends flight." : "Farm map. Scroll or use arrow keys to explore."}
    onKeyDown={event => {
      if (flight) return; // Flight keys are handled globally by FarmView; the camera follows the aircraft.
      const offset = directions[event.key];
      if (offset) { event.preventDefault(); event.currentTarget.scrollBy(...offset); }
    }}>
    <div className="world-stack">
    <canvas id="world" ref={canvasRef} width={1536} height={1536} data-paint-tool={paintTool??undefined} style={{ cursor, width: 1536 * zoom, height: 1536 * zoom,touchAction:paintTool?'none':undefined }}
      aria-label="Original scenario terrain"
      onClick={event=>{if(suppressClick.current){suppressClick.current=false;return;}if(!paintTool)selectTile(event);}}
      onPointerDown={event=>{
        if(!event.isPrimary){endTouch();revertTouch();if(event.pointerType==='touch')stopPainting();return;}
        if(event.pointerType==='touch'){touchDown(event);return;}
        if(event.button===2){stopPainting();event.preventDefault();selectTile(event,true);return;}
        if(event.button!==0)return;
        suppressClick.current=false;
        if(paintTool&&!flight&&event.buttons===1){
          event.preventDefault();viewportRef.current?.focus({preventScroll:true});
          suppressClick.current=true;stroke.current={pointer:event.pointerId,last:null};onStroke?.(true);
          event.currentTarget.setPointerCapture(event.pointerId);paintTile(event,true);
        }
      }}
      onContextMenu={event=>event.preventDefault()}
      onPointerMove={event => {
        if (event.pointerType === 'touch') { touchMove(event); return; }
        pointerRef.current = { clientX: event.clientX, clientY: event.clientY }; updatePointer();
        if(stroke.current?.pointer===event.pointerId){if(event.buttons===1)paintTile(event,false);else stopPainting();}
      }}
      onPointerLeave={event=>{if(event.pointerType!=='touch')clearPointer();}} onPointerCancel={event=>{stopPainting();if(event.pointerType==='touch'){endTouch();revertTouch();}else clearPointer();}} onLostPointerCapture={stopPainting}
      onPointerUp={event => { if (event.pointerType === 'touch') { touchUp(event); return; } if(stroke.current?.pointer===event.pointerId)stopPainting(); }} />
    {previewBox&&<canvas id="world-preview" ref={previewRef} className="world-preview" aria-hidden="true"
      width={(previewBox.right-previewBox.x)*16} height={(previewBox.bottom-previewBox.y)*16}
      style={{left:`${previewBox.x/WORLD_SIZE*100}%`,top:`${previewBox.y/WORLD_SIZE*100}%`,
        width:`${(previewBox.right-previewBox.x)/WORLD_SIZE*100}%`,height:`${(previewBox.bottom-previewBox.y)/WORLD_SIZE*100}%`}} />}
    </div>
  </div>;
}
