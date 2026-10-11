import {useEffect,useRef} from 'react';
import {drawToolbarWeather} from '../render/toolbar-weather';
import {WEATHER_SKIES} from '../simulation/weather-view';
import type { GameSnapshot } from '../simulation/game';
import type { MainMenus } from '../formats/main-menus';

export type GameWindow = 'buy' | 'sell' | 'evaluation' | 'map' | 'weather' | 'balance' | 'bank' | 'edit' | 'market' | 'expert';
export const GAME_WINDOWS: readonly GameWindow[] = ['buy', 'sell', 'evaluation', 'map', 'weather', 'balance', 'bank', 'edit', 'market', 'expert'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Source toolbar at screen (0,16); nine 32×32 window launchers. */
export function ControlBar({ artwork, menus, snapshot, tiles, onWindow }: {
  artwork: HTMLImageElement; menus: MainMenus; snapshot: GameSnapshot; tiles: CanvasImageSource | null; onWindow: (window: GameWindow) => void;
}) {
  const date = snapshot.scenario.farm.calendar;
  const canvas=useRef<HTMLCanvasElement>(null);
  const forecast=[...snapshot.weather.forecast,...snapshot.weather.nextForecast].slice(date.day,date.day+3);
  useEffect(()=>{if(canvas.current&&tiles)drawToolbarWeather(canvas.current.getContext('2d')!,tiles,forecast);},[tiles,...forecast]);
  const weatherLabel=forecast.map((code,i)=>`${['Today','Tomorrow','Day 3'][i]}: ${WEATHER_SKIES[code]}`).join('; ');
  return <div className="original-control-bar" aria-label="Game toolbar" role="toolbar">
    <img src={artwork.src} width="640" height="32" alt="" draggable={false} />
    {GAME_WINDOWS.slice(0, 9).map((window, index) => <button key={window} id={`window-${window}`} className="window-launcher"
      style={{ left: index * 32 }}
      aria-label={menus.menus[3].items[index].label} title={menus.menus[3].items[index].label}
      onClick={() => onWindow(window)}>
      {(index === 0 || index === 1 || index === 7) && <span className="toolbar-caption">{menus.menus[3].items[index].label.toUpperCase()}</span>}
    </button>)}
    <canvas ref={canvas} className="toolbar-weather" width={48} height={16} role="img" aria-label={weatherLabel} title={weatherLabel}/>
    <span className="toolbar-date-label">Date</span>
    <span className="toolbar-funds-label">Funds</span>
    <strong id="farm-date">{months[date.month]} {date.week * 7 + date.day + 1}, {date.year}</strong>
    <span id="farm-cash">${snapshot.scenario.farm.cash.toLocaleString('en-US')}</span>
  </div>;
}
