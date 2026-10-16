import { createContext, memo, useCallback, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { cssZoom } from './css-zoom';
import type { WindowArtwork } from '../assets/game-assets';

interface Windows {
  active: string | null; order: readonly string[];
  show: (key: string | null) => void; close:(key:string)=>void; raise:(key:string)=>void;
  reset:()=>void;
}
const Context = createContext<Windows | null>(null);
export function useWindows() { const value = useContext(Context); if (!value) throw new Error('Missing game windows'); return value; }
/** Keep the last rendered subtree mounted while closed. This preserves form/selection/scroll and frame
 * placement state, but avoids passing each simulation snapshot through expensive hidden report/catalog
 * components. Window context still reaches GameWindow to hide it, clean up observers and hand off focus.
 * Initial contents render once; reopening always passes the latest props. */
const RetainedContents = memo(function RetainedContents({ children }: { open: boolean; children: ReactNode }) {
  return children;
}, (_previous, next) => !next.open);
export function WindowContents({ windowKey, children }: { windowKey: string; children: ReactNode }) {
  const { order } = useWindows();
  return <RetainedContents open={order.includes(windowKey)}>{children}</RetainedContents>;
}
export function WindowDesktop({ children, artwork, onButtonClick }: { children: ReactNode; artwork: WindowArtwork; onButtonClick?:()=>undefined|(()=>void) }) {
  const [state,setState]=useState<{order:string[];active:string|null}>({order:[],active:null});
  const buttonFeedback=useRef(new WeakMap<Event,()=>void>());
  // null focuses the permanent map; it is never a window or a stack entry.
  const show=useCallback((key:string|null)=>setState(old=>key===null
    ? old.active===null?old:{...old,active:null}
    : old.active===key?old:{order:[...old.order.filter(k=>k!==key),key],active:key}),[]);
  const close=useCallback((key:string)=>setState(old=>{
    const order=old.order.filter(k=>k!==key);return {order,active:old.active===key?order.at(-1)??null:old.active};
  }),[]);
  const raise=useCallback((key:string)=>setState(old=>!old.order.includes(key)||old.active===key?old:
    {order:[...old.order.filter(k=>k!==key),key],active:key}),[]);
  const reset=useCallback(()=>setState({order:[],active:null}),[]);
  const {order,active}=state;
  return <Context value={{ active, order, show, close, raise, reset }}><div className="game-desktop" onClickCapture={event=>{
    const button=event.target instanceof Element?event.target.closest('button'):null;
    if(button&&!button.matches(':disabled')&&button.getAttribute('aria-disabled')!=='true'){
      const finish=onButtonClick?.();if(finish)buttonFeedback.current.set(event.nativeEvent,finish);
    }
  }} onClick={event=>{
    const finish=buttonFeedback.current.get(event.nativeEvent);buttonFeedback.current.delete(event.nativeEvent);finish?.();
  }} style={{
    '--window-title': `url("${artwork.title.src}")`, '--window-inactive': `url("${artwork.inactive.src}")`, '--window-close': `url("${artwork.close.src}")`,
    '--window-frame': `url("${artwork.frame.src}")`, '--window-title-end': `url("${artwork.end.src}")`, '--window-title-end-inactive': `url("${artwork.endInactive.src}")`,
  } as CSSProperties}>{children}</div></Context>;
}
interface Position { left: number; top: number }
/** Bounding box in layout px: rects are in zoomed screen px when #app is CSS-zoomed (touch screens). */
function layoutRect(element: Element) {
  const r = element.getBoundingClientRect(), z = cssZoom(element);
  return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z };
}
/** Windows keep their titlebars below the menu and control bars (48px at desktop width; taller when they wrap). */
function topLimit(element: Element): number {
  const desktop = element.closest('.game-desktop')!, workspace = desktop.querySelector('.edit-workspace');
  return workspace ? Math.round(layoutRect(workspace).top - layoutRect(desktop).top) : 48;
}
/** Windows also keep clear of anything left of the terrain (the landscape phone menu column, side safe areas). */
function leftLimit(element: Element): number {
  const desktop = element.closest('.game-desktop')!, workspace = desktop.querySelector('.edit-workspace');
  return workspace ? Math.round(layoutRect(workspace).left - layoutRect(desktop).left) : 0;
}
/** Shared movable frame; optional native modal dialog keeps Edit mounted. */
export function GameWindow({ windowKey, title, children, forced = false, modal = false, framed = false, descriptionId, onClose, titleArtwork }: {
  windowKey: string; title: string; children: ReactNode; forced?: boolean; modal?: boolean; descriptionId?: string; onClose?: () => void; titleArtwork?: string;
  /** Shared wooden frame (border-image) around the body; the window sizes to its client. */
  framed?: boolean;
}) {
  const { active, order, close:closeWindow, raise } = useWindows(), open = forced || order.includes(windowKey);
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  // Responsive fit (native, user request): a window larger than the desktop below the bars is shown scaled down
  // around its top-left corner; it keeps its original 1x layout wherever it fits.
  const [scale, setScale] = useState(1);
  const drag = useRef<{ pointer: number; x: number; y: number; origin: Position } | null>(null);
  function currentPosition(): Position {
    const box = layoutRect(frame.current!), desktop = layoutRect(frame.current!.closest('.game-desktop')!);
    return { left: box.left - desktop.left, top: box.top - desktop.top };
  }
  function bounded(next: Position): Position {
    const box = layoutRect(frame.current!), desktop = layoutRect(frame.current!.closest('.game-desktop')!);
    // Oversized legacy dialogs may slide horizontally to expose either edge.
    // Keep the title below the menus and the entire window in bounds when it fits.
    const right = desktop.width - box.width, top = topLimit(frame.current!), left = leftLimit(frame.current!);
    return { left: Math.round(Math.max(Math.min(left, right), Math.min(Math.max(left, right), next.left))),
      top: Math.round(Math.max(top, Math.min(Math.max(top, desktop.height - box.height), next.top))) };
  }
  /** Scales an oversized window to fit, then moves it back in bounds if it sticks out. */
  function fit() {
    const element = frame.current!, desktop = layoutRect(element.closest('.game-desktop')!);
    // offsetWidth/Height are the untransformed layout size.
    const next = Math.min(1, (desktop.width - leftLimit(element)) / element.offsetWidth, (desktop.height - topLimit(element)) / element.offsetHeight);
    const value = next >= 1 ? 1 : Math.floor(next * 1000) / 1000;
    setScale(value); element.style.transform = value < 1 ? `scale(${value})` : '';
    const box = layoutRect(element), current = currentPosition();
    if (box.right > desktop.right || box.bottom > desktop.bottom || current.top < topLimit(element) || current.left < leftLimit(element)) move(current);
    else setPosition(old => { if (!old) return old; const bound = bounded(old); return bound.left === old.left && bound.top === old.top ? old : bound; });
  }
  function move(next: Position) {
    const value = bounded(next);
    setPosition(old => old?.left === value.left && old.top === value.top ? old : value);
  }
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || (event.target as Element).closest('button')) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, origin: currentPosition() };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement, currentFrame=frame.current!, desktop=currentFrame.closest('.game-desktop')!;
    if(modal)(frame.current as HTMLDialogElement).showModal();
    ref.current?.focus({ preventScroll: true });
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame.current!); observer.observe(frame.current!.closest('.game-desktop')!);
    return () => {
      observer.disconnect(); drag.current = null;
      if(modal)(frame.current as HTMLDialogElement)?.close();
      queueMicrotask(()=>{
        if(!desktop.isConnected)return;
        // Respect an explicit handoff (Edit, a newly opened dialog or a control).
        const focused=document.activeElement;
        if(focused instanceof HTMLElement&&focused!==document.body&&focused.getClientRects().length&&!currentFrame.contains(focused))return;
        const next=desktop.querySelector<HTMLElement>('.game-window[data-front=true]:not([hidden]) .game-window-title');
        if(next)next.focus({preventScroll:true});
        else if(previous instanceof HTMLElement&&previous.isConnected&&previous.getClientRects().length)previous.focus({preventScroll:true});
      });
    };
  }, [open,modal]);
  function close() { if (onClose) onClose(); else if (!forced) closeWindow(windowKey); }
  const Frame = modal ? 'dialog' : 'section';
  return <Frame ref={element=>{frame.current=element;}} data-window={windowKey} data-front={forced||active===windowKey} hidden={!open} role="dialog" aria-modal={modal||undefined} aria-label={title} aria-describedby={descriptionId} className="game-window" data-framed={framed || undefined}
    data-scale={scale < 1 ? scale : undefined}
    style={{zIndex:forced?90:30+order.indexOf(windowKey),...(position?{left:position.left,top:position.top,right:'auto'}:{}),...(scale<1?{transform:`scale(${scale})`}:{})}}
    onPointerDownCapture={()=>{if(!forced)raise(windowKey);}} onFocusCapture={()=>{if(!forced)raise(windowKey);}}
    onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <div className="game-window-title" data-title-artwork={Boolean(titleArtwork)} style={titleArtwork?{backgroundImage:`url("${titleArtwork}")`}:undefined} tabIndex={0} ref={ref} aria-label={`${title} window titlebar`}
      title="Drag to move; arrow keys move a focused titlebar (Shift for one pixel)"
      onPointerDown={startDrag} onPointerMove={event => {
        const start = drag.current; if (!start || start.pointer !== event.pointerId) return;
        const z = cssZoom(frame.current!); move({ left: start.origin.left + (event.clientX - start.x) / z, top: start.origin.top + (event.clientY - start.y) / z });
      }} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const start = currentPosition(), step = event.shiftKey ? 1 : 10;
        move({ left: start.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
          top: start.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
      }}><span>{title}</span>
      <button type="button" aria-label={`Close ${title}`} title={`Close ${title}`} disabled={forced && !onClose} onClick={close} /></div>
    <div className={`game-window-body${framed ? ' window-frame' : ''}`}>{children}</div>
  </Frame>;
}
