import type { CSSProperties } from 'react';
import type { GameAssets } from '../assets/game-assets';
import type { TownEventCheckpoint } from '../formats/town-event-save';
import { townEventMessage } from './town-event-message';
import { GameWindow } from './GameWindow';

/** Source0636:10f4 frame with real text and canonical simulation decisions. */
export function TownEventMessage({ state, assets, onResolve }: {
  state: TownEventCheckpoint; assets: GameAssets; onResolve: (accept: boolean) => void;
}) {
  const message = townEventMessage(state, assets.eventText);
  if (!message) return null;
  const choice = message.buttons.length === 2;
  return <div style={{ '--message-artwork': `url("${assets.messageArtwork.src}")`,
    '--message-button': `url("${assets.messageButton.src}")` } as CSSProperties}>
    <GameWindow windowKey="town-event-message" title="Message" forced modal descriptionId="town-event-message-text"
      onClose={() => onResolve(!choice)}>
      <div className="original-message-body" data-town-event={state.pending!.kind}>
        <div className="message-portrait"><img src={assets.buyCards.src} alt="" draggable={false}
          style={{ left: -(message.portrait % 8) * 112, top: -Math.floor(message.portrait / 8) * 64 }}/></div>
        <p id="town-event-message-text">{message.text}</p>
        {message.buttons.map((button, i) => <button key={button.caption} id={`town-event-${i}`}
          className={choice ? i === 0 ? 'message-yes' : 'message-cancel' : 'message-ok'}
          onClick={() => onResolve(button.accept)}>{button.caption}</button>)}
      </div>
    </GameWindow>
  </div>;
}
