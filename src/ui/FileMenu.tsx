import {AboutDialog} from './AboutDialog';
import type {AboutAssets} from '../assets/game-assets';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MainMenus } from '../formats/main-menus';
import { useWindows } from './GameWindow';
import { GAME_WINDOWS, type GameWindow } from './ControlBar';

function MenuDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="file-dialog" aria-labelledby="file-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id="file-dialog-title">{title}</h2>{children}
  </dialog>;
}

export interface MenuChoices { actions?:readonly {label:string;choose:()=>void}[]; extraLabels?:readonly string[]; checked: readonly boolean[]; choose: (index: number) => void; disabled?: boolean }

/** Recovered File/Options/Windows/Disasters chains; file-system/exit operations use browser policies. */
export function FileMenu({ about, data, palette, busy, filename, error, onSave, onLoad, onNewGame, onQuit, onWindow, options, disasters }: {
  about:AboutAssets; options: MenuChoices; disasters: MenuChoices;
  data: MainMenus; palette: number[][]; busy: boolean; filename: string; error: string | null;
  onSave: (filename?: string) => Promise<boolean>; onLoad: () => void; onNewGame: () => void; onQuit: () => void; onWindow: (window: GameWindow) => void;
}) {
  const windows = useWindows();
  const [open, setOpen] = useState<number | null>(null), [dialog, setDialog] = useState<'about' | 'save-as' | 'quit' | null>(null);
  const [name, setName] = useState(filename);
  const button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null);
  const file = data.menus[0], active = open === null ? null : data.menus[open];
  const choices:MenuChoices|null = open === 1 ? options : open === 4 ? disasters : open === 3
    ? {checked:GAME_WINDOWS.map(key=>key==='edit'||windows.order.includes(key)),choose:index=>onWindow(GAME_WINDOWS[index])} : null;
  function closeMenu(focus = true) { if (focus && active) root.current?.querySelector<HTMLButtonElement>(`#${active.title.toLowerCase()}-menu-button`)?.focus(); setOpen(null); }
  function closeDialog() { setDialog(null); button.current?.focus(); }
  useEffect(() => {
    if (open === null) return;
    (menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? menu.current)?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function select(index: number) {
    closeMenu();
    if (index === 0) setDialog('about');
    else if (index === 1) onNewGame();
    else if (index === 2) void onSave();
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
        style={{ left: entry.header.x, width: entry.header.width, paddingLeft: index === 0 ? 8 : 0 }}
        title={undefined}
        aria-haspopup={index !== 2 ? 'menu' : undefined} aria-expanded={index !== 2 ? open === index : undefined}
        aria-controls={index !== 2 ? `original-${entry.title.toLowerCase()}-menu` : undefined}
        onClick={() => { if (index !== 2) setOpen(value => value === index ? null : index); else { setOpen(null); windows.show('speed'); } }} onKeyDown={event => {
          if ((index !== 2) && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setOpen(index); }
        }}>{entry.title}</button>)}
      {active && <div ref={menu} id={`original-${active.title.toLowerCase()}-menu`} className="original-menu-popup" role="menu" tabIndex={-1} aria-label={active.title}
        style={{ left: active.popup.x, width: choices?.extraLabels?.length || choices?.actions?.length ? Math.max(160,active.popup.width) : active.popup.width, ...(choices ? { height: active.popup.height+12*((choices.extraLabels?.length??0)+(choices.actions?.length??0)), padding: '1px 0' } : {}) }} onKeyDown={event => {
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
        {[...active.items,...(choices?.extraLabels??[]).map((label,i)=>({label,offset:-i-1}))].map((item, index) => open === 0 && index === 5 ? null : <button key={item.offset} role={choices ? 'menuitemcheckbox' : 'menuitem'} aria-checked={choices?.checked[index]} tabIndex={-1}
          disabled={busy || choices?.disabled}
          onPointerMove={event=>{if(event.pointerType==='mouse'&&document.activeElement!==event.currentTarget)event.currentTarget.focus({preventScroll:true});}}
          onClick={() => { if (open === 0) select(index); else if (choices) { closeMenu(); choices.choose(index); } else { closeMenu(); onWindow(GAME_WINDOWS[index]); } }}>{choices && <span className="menu-check" aria-hidden="true">{choices.checked[index] ? '✓' : ''}</span>}{item.label}</button>)}
        {choices?.actions?.map(action=><button key={action.label} role="menuitem" tabIndex={-1} disabled={busy || choices.disabled}
          onPointerMove={event=>{if(event.pointerType==='mouse'&&document.activeElement!==event.currentTarget)event.currentTarget.focus({preventScroll:true});}}
          onClick={()=>{closeMenu();action.choose();}}><span className="menu-check" aria-hidden="true" />{action.label}</button>)}
      </div>}
    </nav>
    {dialog === 'about' && <AboutDialog assets={about} onClose={closeDialog} />}
    {dialog === 'save-as' && <MenuDialog title={file.items[3].label} onClose={closeDialog}>
      <form onSubmit={async event => { event.preventDefault(); if (await onSave(name)) closeDialog(); }}>
        <label>Filename <input autoFocus value={name} required maxLength={120} pattern={String.raw`[^\/\\]+`} onChange={event => setName(event.target.value)} /></label>
        <p>Saves a native checkpoint as a browser download. Your existing files stay intact.</p>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>Download save</button> <button type="button" onClick={closeDialog}>Cancel</button>
      </form>
    </MenuDialog>}
    {dialog === 'quit' && <MenuDialog title="Quit SimFarm?" onClose={closeDialog}>
      <p>Quitting pauses and keeps your farm in this tab. Save a copy before closing the tab.</p>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={async () => { if (await onSave()) { onQuit(); closeDialog(); } }}>Save and pause</button>{' '}
      <button onClick={() => { onQuit(); closeDialog(); }}>Pause game</button>{' '}
      <button onClick={closeDialog}>Cancel</button>
    </MenuDialog>}
  </>;
}
