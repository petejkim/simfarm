import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Windows { active: string | null; show: (key: string | null) => void }
const Context = createContext<Windows | null>(null);
export function useWindows() { const value = useContext(Context); if (!value) throw new Error('Missing game windows'); return value; }
export function WindowDesktop({ children }: { children: ReactNode }) {
  const [active, show] = useState<string | null>(null);
  return <Context value={{ active, show }}><div className="game-desktop">{children}</div></Context>;
}
/** Nonmodal windows leave the permanent Edit canvas mounted and running. */
export function GameWindow({ windowKey, title, children, forced = false, onClose }: {
  windowKey: string; title: string; children: ReactNode; forced?: boolean; onClose?: () => void;
}) {
  const { active, show } = useWindows(), open = forced || active === windowKey;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement; ref.current?.focus({ preventScroll: true });
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);
  function close() { if (onClose) onClose(); else if (!forced) show(null); }
  return <section data-window={windowKey} hidden={!open} role="dialog" aria-label={title} className="game-window"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <div className="game-window-title" tabIndex={-1} ref={ref}><span>{title}</span>
      <button aria-label={`Close ${title}`} disabled={forced && !onClose} onClick={close}>×</button></div>
    <div className="game-window-body">{children}</div>
  </section>;
}
