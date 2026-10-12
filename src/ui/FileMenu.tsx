import {AboutDialog} from './AboutDialog';
import type {AboutAssets} from '../assets/game-assets';
import { useEffect, useRef, useState } from 'react';
import type { MainMenus } from '../formats/main-menus';
import { useWindows } from './GameWindow';
import { GAME_WINDOWS, type GameWindow } from './ControlBar';

/** Native File menu over the source item order (About, New Game, Save, Save As, Load Game, Load Crop, Quit):
 * Save writes the browser-stored game; the Save As slot becomes Save to File... and Load Game becomes
 * Load from File... (user decisions); Load Crop and Quit are omitted. The decoded source labels are unchanged. */
const FILE_LABELS: Record<number, string> = { 3: 'Save to File...', 4: 'Load from File...' };
const FILE_HIDDEN = new Set([5, 6]);

export interface MenuChoices { actions?:readonly {label:string;choose:()=>void}[]; extraLabels?:readonly string[]; checked: readonly boolean[]; choose: (index: number) => void; disabled?: boolean; disabledItems?:readonly boolean[]; hints?:readonly string[] }

/** Recovered File/Options/Windows/Disasters chains; file-system/exit operations use browser policies. */
export function FileMenu({ about, data, busy, onSave, onSaveToFile, onLoad, onNewGame, onWindow, options, disasters, debug }: {
  about:AboutAssets; options: MenuChoices; disasters: MenuChoices; debug: MenuChoices;
  data: MainMenus; busy: boolean;
  onSave: () => Promise<boolean>; onSaveToFile: () => Promise<boolean>; onLoad: () => void; onNewGame: () => void; onWindow: (window: GameWindow) => void;
}) {
  const windows = useWindows();
  const [open, setOpen] = useState<number | null>(null), [dialog, setDialog] = useState<'about' | null>(null);
  const button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null);
  const last=data.menus.at(-1)!,debugX=last.header.x+last.header.width;
  const menus=[...data.menus,{offset:-1,title:'Debug',header:{x:debugX,width:48},popup:{x:debugX,width:192,height:38},
    items:['Start rodeo','Start fair (carnival)','Advance event week','Start town expansion'].map((label,i)=>({label,offset:-100-i}))}];
  const active = open === null ? null : menus[open];
  const choices:MenuChoices|null = open === 5 ? debug : open === 1 ? options : open === 4 ? disasters : open === 3
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
    else if (index === 3) void onSaveToFile();
    else if (index === 4) onLoad();
  }
  const popup = (active: typeof menus[number]) =>
    <div ref={menu} id={`original-${active.title.toLowerCase()}-menu`} className="original-menu-popup" role="menu" tabIndex={-1} aria-label={active.title}
      data-checks={choices && open!==5 ? true : undefined} onKeyDown={event => {
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
        {[...active.items,...(choices?.extraLabels??[]).map((label,i)=>({label,offset:-i-1}))].map((item, index) => open === 0 && FILE_HIDDEN.has(index) ? null : <button key={item.offset} role={choices && open!==5 ? 'menuitemcheckbox' : 'menuitem'} aria-checked={open===5?undefined:choices?.checked[index]} tabIndex={-1}
          disabled={busy || choices?.disabled || choices?.disabledItems?.[index]} title={choices?.hints?.[index]}
          onPointerMove={event=>{if(event.pointerType==='mouse'&&document.activeElement!==event.currentTarget)event.currentTarget.focus({preventScroll:true});}}
          onClick={() => { if (open === 0) select(index); else if (choices) { closeMenu(); choices.choose(index); } else { closeMenu(); onWindow(GAME_WINDOWS[index]); } }}>{choices && open!==5 && <span className="menu-check" aria-hidden="true">{choices.checked[index] ? '✓' : ''}</span>}{open === 0 ? FILE_LABELS[index] ?? item.label : item.label}</button>)}
        {choices?.actions?.map(action=><button key={action.label} role="menuitem" tabIndex={-1} disabled={busy || choices.disabled}
          onPointerMove={event=>{if(event.pointerType==='mouse'&&document.activeElement!==event.currentTarget)event.currentTarget.focus({preventScroll:true});}}
          onClick={()=>{closeMenu();action.choose();}}><span className="menu-check" aria-hidden="true" />{action.label}</button>)}
      </div>;
  return <>
    <nav ref={root} className="original-menu-bar" aria-label="Original game menus"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }}>
      {menus.map((entry, index) => <div key={entry.offset} className="original-menu">
        <button ref={index === 0 ? button : undefined} className="original-menu-heading"
          id={`${entry.title.toLowerCase()}-menu-button`} disabled={busy}
          aria-haspopup={index !== 2 ? 'menu' : undefined} aria-expanded={index !== 2 ? open === index : undefined}
          aria-controls={index !== 2 ? `original-${entry.title.toLowerCase()}-menu` : undefined}
          onClick={() => { if (index !== 2) setOpen(value => value === index ? null : index); else { setOpen(null); windows.show('speed'); } }} onKeyDown={event => {
            if ((index !== 2) && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setOpen(index); }
          }}>{entry.title}</button>
        {active && open === index && popup(active)}
      </div>)}
    </nav>
    {dialog === 'about' && <AboutDialog assets={about} onClose={closeDialog} />}
  </>;
}
