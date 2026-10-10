import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MainMenus } from '../formats/main-menus';
import { useWindows } from './GameWindow';
import { GAME_WINDOWS, windowAvailable, type GameWindow } from './ControlBar';

function MenuDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="file-dialog" aria-labelledby="file-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id="file-dialog-title">{title}</h2>{children}
  </dialog>;
}

/** Recovered File/Windows chains; file-system/exit operations use browser policies. */
export function FileMenu({ data, palette, busy, filename, error, onSave, onLoad, onNewGame, onQuit, onWindow }: {
  data: MainMenus; palette: number[][]; busy: boolean; filename: string; error: string | null;
  onSave: (filename?: string) => boolean; onLoad: () => void; onNewGame: () => void; onQuit: () => void; onWindow: (window: GameWindow) => void;
}) {
  const windows = useWindows();
  const [open, setOpen] = useState<number | null>(null), [dialog, setDialog] = useState<'about' | 'save-as' | 'quit' | null>(null);
  const [name, setName] = useState(filename);
  const button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null);
  const file = data.menus[0], active = open === null ? null : data.menus[open];
  function closeMenu(focus = true) { if (focus && active) root.current?.querySelector<HTMLButtonElement>(`#${active.title.toLowerCase()}-menu-button`)?.focus(); setOpen(null); }
  function closeDialog() { setDialog(null); button.current?.focus(); }
  useEffect(() => {
    if (open === null) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function select(index: number) {
    closeMenu();
    if (index === 0) setDialog('about');
    else if (index === 1) onNewGame();
    else if (index === 2) onSave();
    else if (index === 3) { setName(filename); setDialog('save-as'); }
    else if (index === 4) onLoad();
    else if (index === 6) setDialog('quit');
  }
  const color = (index: number) => `rgb(${palette[index].join(',')})`;
  return <>
    <nav ref={root} className="original-menu-bar" aria-label="Original game menus"
      style={{ backgroundColor: color(data.background), color: color(data.foreground) }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }}>
      {data.menus.map((entry, index) => <button key={entry.offset} ref={index === 0 ? button : undefined}
        id={`${entry.title.toLowerCase()}-menu-button`} disabled={busy}
        style={{ left: entry.header.x * 2, width: entry.header.width * 2, paddingLeft: index === 0 ? 16 : 0 }}
        title={undefined}
        aria-haspopup={index === 0 || index === 3 ? 'menu' : undefined} aria-expanded={index === 0 || index === 3 ? open === index : undefined}
        aria-controls={index === 0 || index === 3 ? `original-${entry.title.toLowerCase()}-menu` : undefined}
        onClick={() => { if (index === 0 || index === 3) setOpen(value => value === index ? null : index); else { setOpen(null); windows.show(index === 1 ? 'options' : index === 2 ? 'speed' : 'disasters'); } }} onKeyDown={event => {
          if ((index === 0 || index === 3) && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setOpen(index); }
        }}>{entry.title}</button>)}
      {active && <div ref={menu} id={`original-${active.title.toLowerCase()}-menu`} className="original-menu-popup" role="menu" aria-label={active.title}
        style={{ left: active.popup.x * 2, width: active.popup.width * 2 }} onKeyDown={event => {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
          else if (event.key === 'Tab') setOpen(null);
          else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }
        }}>
        {active.items.map((item, index) => open === 0 && index === 5 ? null : <button key={item.offset} role="menuitem" tabIndex={-1}
          disabled={busy || (open === 3 && !windowAvailable(GAME_WINDOWS[index]))}
          title={open === 3 && !windowAvailable(GAME_WINDOWS[index]) ? 'This window is still being reconstructed.' : undefined}
          onClick={() => { if (open === 0) select(index); else { closeMenu(); onWindow(GAME_WINDOWS[index]); } }}>{item.label}</button>)}
      </div>}
    </nav>
    {dialog === 'about' && <MenuDialog title={file.items[0].label} onClose={closeDialog}>
      <p>SimFarm (1993), originally by Maxis.</p>
      <p>This native browser reconstruction uses the original game assets and recovered rules, with MIDI music and selectable text. Preservation is still in progress.</p>
      <button onClick={closeDialog}>Close</button>
    </MenuDialog>}
    {dialog === 'save-as' && <MenuDialog title={file.items[3].label} onClose={closeDialog}>
      <form onSubmit={event => { event.preventDefault(); if (onSave(name)) closeDialog(); }}>
        <label>Filename <input autoFocus value={name} required maxLength={120} pattern={String.raw`[^\/\\]+`} onChange={event => setName(event.target.value)} /></label>
        <p>Saves a native checkpoint as a browser download. Your existing files stay intact.</p>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Download save</button> <button type="button" onClick={closeDialog}>Cancel</button>
      </form>
    </MenuDialog>}
    {dialog === 'quit' && <MenuDialog title="Quit SimFarm?" onClose={closeDialog}>
      <p>Quitting pauses and keeps your farm in this tab. Save a copy before closing the tab.</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => { if (onSave()) { onQuit(); closeDialog(); } }}>Save and pause</button>{' '}
      <button onClick={() => { onQuit(); closeDialog(); }}>Pause game</button>{' '}
      <button onClick={closeDialog}>Cancel</button>
    </MenuDialog>}
  </>;
}
