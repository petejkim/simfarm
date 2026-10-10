import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MainMenus } from '../formats/main-menus';

function MenuDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="file-dialog" aria-labelledby="file-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id="file-dialog-title">{title}</h2>{children}
  </dialog>;
}

/** The recovered File chain; file-system/exit operations use explicit browser policies. */
export function FileMenu({ data, palette, busy, filename, error, onSave, onLoad, onNewGame, onQuit }: {
  data: MainMenus; palette: number[][]; busy: boolean; filename: string; error: string | null;
  onSave: (filename?: string) => boolean; onLoad: () => void; onNewGame: () => void; onQuit: () => void;
}) {
  const [open, setOpen] = useState(false), [dialog, setDialog] = useState<'about' | 'save-as' | 'quit' | null>(null);
  const [name, setName] = useState(filename);
  const button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null);
  const file = data.menus[0];
  function closeMenu(focus = true) { setOpen(false); if (focus) button.current?.focus(); }
  function closeDialog() { setDialog(null); button.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
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
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      {data.menus.map((entry, index) => <button key={entry.offset} ref={index === 0 ? button : undefined}
        id={index === 0 ? 'file-menu-button' : undefined} disabled={index !== 0 || busy}
        style={{ left: `${entry.header.x / 4}%`, width: `${entry.header.width / 4}%`, paddingLeft: index === 0 ? '2%' : 0 }}
        title={index === 0 ? undefined : 'This original menu is still being reconstructed; use the farm controls below.'}
        aria-haspopup={index === 0 ? 'menu' : undefined} aria-expanded={index === 0 ? open : undefined}
        aria-controls={index === 0 ? 'original-file-menu' : undefined}
        onClick={() => setOpen(value => !value)} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
        }}>{entry.title}</button>)}
      {open && <div ref={menu} id="original-file-menu" role="menu" aria-label={file.title}
        style={{ width: `${file.popup.width * 2}px` }} onKeyDown={event => {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
          else if (event.key === 'Tab') setOpen(false);
          else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }
        }}>
        {file.items.map((item, index) => index === 5 ? null : <button key={item.offset} role="menuitem" tabIndex={-1}
          disabled={busy}
          onClick={() => select(index)}>{item.label}</button>)}
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
