import type { GameSnapshot } from '../simulation/game';
import type { MainMenus } from '../formats/main-menus';

export type GameWindow = 'buy' | 'sell' | 'evaluation' | 'map' | 'weather' | 'balance' | 'bank' | 'edit' | 'market' | 'expert';
export const GAME_WINDOWS: readonly GameWindow[] = ['buy', 'sell', 'evaluation', 'map', 'weather', 'balance', 'bank', 'edit', 'market', 'expert'];
export const windowAvailable = (window: GameWindow) => window !== 'market';
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Source toolbar at screen (0,16); nine 32×32 window launchers. */
export function ControlBar({ artwork, menus, snapshot, onWindow }: {
  artwork: HTMLImageElement; menus: MainMenus; snapshot: GameSnapshot; onWindow: (window: GameWindow) => void;
}) {
  const date = snapshot.scenario.farm.calendar;
  return <div className="original-control-bar" aria-label="Game toolbar" role="toolbar">
    <img src={artwork.src} width="640" height="32" alt="" draggable={false} />
    {GAME_WINDOWS.slice(0, 9).map((window, index) => <button key={window} id={`window-${window}`} className="window-launcher"
      style={{ left: index * 32 }} disabled={!windowAvailable(window)}
      aria-label={menus.menus[3].items[index].label} title={windowAvailable(window) ? menus.menus[3].items[index].label : 'Market Value window is still being reconstructed.'}
      onClick={() => onWindow(window)}>
      {(index === 0 || index === 1 || index === 7) && <span className="toolbar-caption">{menus.menus[3].items[index].label.toUpperCase()}</span>}
    </button>)}
    <span className="toolbar-date-label">Date</span>
    <span className="toolbar-funds-label">Funds</span>
    <strong id="farm-date">{months[date.month]} {date.week * 7 + date.day + 1}, {date.year}</strong>
    <span id="farm-cash">${snapshot.scenario.farm.cash.toLocaleString('en-US')}</span>
  </div>;
}
