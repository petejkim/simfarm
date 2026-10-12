import type {ReactNode} from 'react';
import {BevelButton} from './chrome/BevelButton';
import {SunkenInset} from './chrome/SunkenInset';
import {spriteFace} from './chrome/Sprite';
import {TileSprite} from './chrome/TileSprite';
import {WEATHER_SKIES} from '../simulation/weather-view';
import {CONTROL_BAR_LAUNCHER} from '../formats/control-bar';
import {useWindows} from './GameWindow';
import type { GameSnapshot } from '../simulation/game';
import type { MainMenus } from '../formats/main-menus';

export type GameWindow = 'buy' | 'sell' | 'evaluation' | 'map' | 'weather' | 'balance' | 'bank' | 'edit' | 'market' | 'expert';
export const GAME_WINDOWS: readonly GameWindow[] = ['buy', 'sell', 'evaluation', 'map', 'weather', 'balance', 'bank', 'edit', 'market', 'expert'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Launchers whose source face carries lettering (erased from the sprite, rebuilt as text). */
const CAPTIONED = new Set<GameWindow>(['buy', 'sell']);

/** Source launcher order (cntlbtnh.bmp faces 0..8). Edit (face7) is omitted by user request:
 * the terrain is the permanent background, reached from the Windows menu or by focusing the map. */
const LAUNCHERS = GAME_WINDOWS.slice(0, 9).map((window, face) => ({ window, face })).filter(({ window }) => window !== 'edit');

/** Source toolbar at screen (0,16): window launchers, forecast inset and Date/Funds readouts, laid out with flexbox.
 * Bevels are CSS borders; cntlbtnh.bmp only supplies each launcher's 26×26 picture face. */
export function ControlBar({ artwork, menus, snapshot, tiles, onWindow }: {
  artwork: HTMLImageElement; menus: MainMenus; snapshot: GameSnapshot; tiles: HTMLImageElement | null; onWindow: (window: GameWindow) => void;
}) {
  const date = snapshot.scenario.farm.calendar, windows = useWindows();
  const forecast=[...snapshot.weather.forecast,...snapshot.weather.nextForecast].slice(date.day,date.day+3);
  return <div className="original-control-bar" aria-label="Game toolbar" role="toolbar">
    <div className="toolbar-launchers">
      {LAUNCHERS.map(({ window, face }) => <WindowLauncher key={window} window={window} face={face} artwork={artwork.src}
        label={menus.menus[3].items[face].label} captioned={CAPTIONED.has(window)} pressed={windows.order.includes(window)} onWindow={onWindow} />)}
    </div>
    <div className="toolbar-forecast-area"><ToolbarForecast forecast={forecast} tiles={tiles} /></div>
    <div className="toolbar-readouts">
      <ToolbarReadout id="farm-date" label="Date">{months[date.month]} {date.week * 7 + date.day + 1}, {date.year}</ToolbarReadout>
      <ToolbarReadout id="farm-cash" label="Funds">${snapshot.scenario.farm.cash.toLocaleString('en-US')}</ToolbarReadout>
    </div>
  </div>;
}

/** One 32×32 launcher: black button background shows as a 1px frame around the 2px raised bevel;
 * the source picture face comes from sprite (face×32+3, 3). It stays depressed while its window is open. */
export function WindowLauncher({ window, face, artwork, label, captioned, pressed, onWindow }: {
  window: GameWindow; face: number; artwork: string; label: string; captioned: boolean; pressed: boolean; onWindow: (window: GameWindow) => void;
}) {
  const { size, inset } = CONTROL_BAR_LAUNCHER;
  return <BevelButton id={`window-${window}`} className="window-launcher" faceClassName="window-launcher-face" pressed={pressed}
    faceStyle={spriteFace(artwork, face * size + inset, inset)} aria-label={label} title={label} onClick={() => onWindow(window)}>
    {captioned && <span className="toolbar-caption">{label.toUpperCase()}</span>}
  </BevelButton>;
}

/** Source2a518..2a552: three 16×16 forecast tiles (204+code from the current day) inside a 52×20 inset. */
export function ToolbarForecast({ forecast, tiles }: { forecast: readonly number[]; tiles: HTMLImageElement | null }) {
  const weatherLabel=forecast.map((code,i)=>`${['Today','Tomorrow','Day 3'][i]}: ${WEATHER_SKIES[code]}`).join('; ');
  return <SunkenInset className="toolbar-forecast">
    <span className="toolbar-weather" role="img" aria-label={weatherLabel} title={weatherLabel}>
      {tiles&&forecast.slice(0,3).map((code,i)=><TileSprite key={i} tile={204+code} atlas={tiles.src} masked={tiles.src}/>)}
    </span>
  </SunkenInset>;
}

/** Right-aligned bold caption, then a 176×13 sunken value box. */
export function ToolbarReadout({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="toolbar-readout-row">
    <span id={`${id}-label`} className="toolbar-readout-label">{label}</span>
    <SunkenInset className="toolbar-readout"><span id={id}>{children}</span></SunkenInset>
  </div>;
}
