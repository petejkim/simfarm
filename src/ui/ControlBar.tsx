import {useEffect,useRef,type CSSProperties,type ReactNode} from 'react';
import {drawToolbarWeather} from '../render/toolbar-weather';
import {WEATHER_SKIES} from '../simulation/weather-view';
import {CONTROL_BAR_LAUNCHER} from '../formats/control-bar';
import type { GameSnapshot } from '../simulation/game';
import type { MainMenus } from '../formats/main-menus';

export type GameWindow = 'buy' | 'sell' | 'evaluation' | 'map' | 'weather' | 'balance' | 'bank' | 'edit' | 'market' | 'expert';
export const GAME_WINDOWS: readonly GameWindow[] = ['buy', 'sell', 'evaluation', 'map', 'weather', 'balance', 'bank', 'edit', 'market', 'expert'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Launchers whose source face carries lettering (erased from the sprite, rebuilt as text). */
const CAPTIONED = new Set<GameWindow>(['buy', 'sell', 'edit']);

/** Source toolbar at screen (0,16): nine 32×32 window launchers, forecast inset and Date/Funds readouts.
 * Bevels are CSS borders; cntlbtnh.bmp only supplies each launcher's 26×26 picture face. */
export function ControlBar({ artwork, menus, snapshot, tiles, onWindow }: {
  artwork: HTMLImageElement; menus: MainMenus; snapshot: GameSnapshot; tiles: CanvasImageSource | null; onWindow: (window: GameWindow) => void;
}) {
  const date = snapshot.scenario.farm.calendar;
  const forecast=[...snapshot.weather.forecast,...snapshot.weather.nextForecast].slice(date.day,date.day+3);
  return <div className="original-control-bar" aria-label="Game toolbar" role="toolbar"
    style={{ '--control-bar-sprite': `url("${artwork.src}")` } as CSSProperties}>
    {GAME_WINDOWS.slice(0, 9).map((window, index) => <WindowLauncher key={window} window={window} index={index}
      label={menus.menus[3].items[index].label} captioned={CAPTIONED.has(window)} onWindow={onWindow} />)}
    <ToolbarForecast forecast={forecast} tiles={tiles} />
    <ToolbarReadout id="farm-date" label="Date" top={2}>{months[date.month]} {date.week * 7 + date.day + 1}, {date.year}</ToolbarReadout>
    <ToolbarReadout id="farm-cash" label="Funds" top={17}>${snapshot.scenario.farm.cash.toLocaleString('en-US')}</ToolbarReadout>
  </div>;
}

/** One 32×32 launcher: 1px black frame, 2px raised bevel, source picture face at sprite (index×32+3, 3). */
export function WindowLauncher({ window, index, label, captioned, onWindow }: {
  window: GameWindow; index: number; label: string; captioned: boolean; onWindow: (window: GameWindow) => void;
}) {
  const { size, inset } = CONTROL_BAR_LAUNCHER;
  return <button id={`window-${window}`} className="window-launcher" style={{ left: index * size }}
    aria-label={label} title={label} onClick={() => onWindow(window)}>
    <span className="window-launcher-face" style={{ backgroundPosition: `${-(index * size + inset)}px ${-inset}px` }}>
      {captioned && <span className="toolbar-caption">{label.toUpperCase()}</span>}
    </span>
  </button>;
}

/** Sunken 2px bevel used by the forecast and Date/Funds boxes. Coordinates are the outer edge in bar pixels. */
export function ToolbarInset({ left, top, width, height, className, children }: {
  left: number; top: number; width: number; height: number; className?: string; children: ReactNode;
}) {
  return <span className={`toolbar-inset${className ? ` ${className}` : ''}`} style={{ left, top, width, height }}>{children}</span>;
}

/** Source2a518..2a552: three forecast tiles inside the inset whose interior is (328,8) 48×16. */
export function ToolbarForecast({ forecast, tiles }: { forecast: readonly number[]; tiles: CanvasImageSource | null }) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{if(canvas.current&&tiles)drawToolbarWeather(canvas.current.getContext('2d')!,tiles,forecast);},[tiles,...forecast]);
  const weatherLabel=forecast.map((code,i)=>`${['Today','Tomorrow','Day 3'][i]}: ${WEATHER_SKIES[code]}`).join('; ');
  return <ToolbarInset left={326} top={6} width={52} height={20} className="toolbar-forecast">
    <canvas ref={canvas} className="toolbar-weather" width={48} height={16} role="img" aria-label={weatherLabel} title={weatherLabel}/>
  </ToolbarInset>;
}

/** Right-aligned bold caption ending at x457, then a 176×13 sunken value box at x461. */
export function ToolbarReadout({ id, label, top, children }: { id: string; label: string; top: number; children: ReactNode }) {
  return <>
    <span id={`${id}-label`} className="toolbar-readout-label" style={{ top }}>{label}</span>
    <ToolbarInset left={461} top={top} width={176} height={13} className="toolbar-readout">
      <span id={id}>{children}</span>
    </ToolbarInset>
  </>;
}
