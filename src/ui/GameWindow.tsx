import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import type { WindowArtwork } from '../assets/game-assets';

interface Windows { active: string | null; order: readonly string[]; show: (key: string | null) => void; close:(key:string)=>void; raise:(key:string)=>void }
const Context = createContext<Windows | null>(null);
export function useWindows() { const value = useContext(Context); if (!value) throw new Error('Missing game windows'); return value; }
export function WindowDesktop({ children, artwork }: { children: ReactNode; artwork: WindowArtwork }) {
  const [order,setOrder]=useState<string[]>([]);
  const show=useCallback((key:string|null)=>setOrder(old=>key===null?[]:old.at(-1)===key?old:[...old.filter(k=>k!==key),key]),[]);
  const close=useCallback((key:string)=>setOrder(old=>old.filter(k=>k!==key)),[]);
  const raise=useCallback((key:string)=>setOrder(old=>!old.includes(key)||old.at(-1)===key?old:[...old.filter(k=>k!==key),key]),[]);
  const active=order.at(-1)??null;
  return <Context value={{ active, order, show, close, raise }}><div className="game-desktop" style={{
    '--window-title': `url("${artwork.title.src}")`, '--window-inactive': `url("${artwork.inactive.src}")`, '--window-close': `url("${artwork.close.src}")`,
    '--window-title-end': `url("${artwork.end.src}")`, '--window-title-end-inactive': `url("${artwork.endInactive.src}")`,
  } as CSSProperties}>{children}</div></Context>;
}
interface Position { left: number; top: number }
/** Shared movable frame; optional native modal dialog keeps Edit mounted. */
export function GameWindow({ windowKey, title, children, forced = false, modal = false, descriptionId, onClose, titleArtwork }: {
  windowKey: string; title: string; children: ReactNode; forced?: boolean; modal?: boolean; descriptionId?: string; onClose?: () => void; titleArtwork?: string;
}) {
  const { active, order, close:closeWindow, raise } = useWindows(), open = forced || order.includes(windowKey);
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; origin: Position } | null>(null);
  function currentPosition(): Position {
    const box = frame.current!.getBoundingClientRect(), desktop = frame.current!.closest('.game-desktop')!.getBoundingClientRect();
    return { left: box.left - desktop.left, top: box.top - desktop.top };
  }
  function bounded(next: Position): Position {
    const box = frame.current!.getBoundingClientRect(), desktop = frame.current!.closest('.game-desktop')!.getBoundingClientRect();
    // Oversized legacy dialogs may slide horizontally to expose either edge.
    // Keep the title below the menus and the entire window in bounds when it fits.
    const right = desktop.width - box.width;
    return { left: Math.round(Math.max(Math.min(0, right), Math.min(Math.max(0, right), next.left))),
      top: Math.round(Math.max(48, Math.min(Math.max(48, desktop.height - box.height), next.top))) };
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
    const observer = new ResizeObserver(() => setPosition(old => {
      if (!old) return old;
      const next = bounded(old); return next.left === old.left && next.top === old.top ? old : next;
    }));
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
  return <Frame ref={element=>{frame.current=element;}} data-window={windowKey} data-front={forced||active===windowKey} hidden={!open} role="dialog" aria-modal={modal||undefined} aria-label={title} aria-describedby={descriptionId} className="game-window"
    style={{zIndex:forced?90:30+order.indexOf(windowKey),...(position?{left:position.left,top:position.top,right:'auto'}:{})}}
    onPointerDownCapture={()=>{if(!forced)raise(windowKey);}} onFocusCapture={()=>{if(!forced)raise(windowKey);}}
    onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <div className="game-window-title" data-title-artwork={Boolean(titleArtwork)} style={titleArtwork?{backgroundImage:`url("${titleArtwork}")`}:undefined} tabIndex={0} ref={ref} aria-label={`${title} window titlebar`}
      title="Drag to move; arrow keys move a focused titlebar (Shift for one pixel)"
      onPointerDown={startDrag} onPointerMove={event => {
        const start = drag.current; if (!start || start.pointer !== event.pointerId) return;
        move({ left: start.origin.left + event.clientX - start.x, top: start.origin.top + event.clientY - start.y });
      }} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const start = currentPosition(), step = event.shiftKey ? 1 : 10;
        move({ left: start.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
          top: start.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
      }}><span>{title}</span>
      <button aria-label={`Close ${title}`} title={`Close ${title}`} disabled={forced && !onClose} onClick={close} /></div>
    <div className="game-window-body">{children}</div>
  </Frame>;
}
