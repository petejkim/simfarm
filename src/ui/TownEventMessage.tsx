import type { GameAssets } from '../assets/game-assets';
import type { TownEventCheckpoint } from '../formats/town-event-save';
import { townEventMessage } from './town-event-message';
import { MessageDialog } from './MessageDialog';

/** Source 0636:10f4 frame with real text and canonical simulation decisions. */
export function TownEventMessage({ state, assets, onResolve }: {
  state: TownEventCheckpoint; assets: GameAssets; onResolve: (accept: boolean) => void;
}) {
  const message = townEventMessage(state, assets.eventText);
  if (!message) return null;
  const choice = message.buttons.length === 2;
  return <MessageDialog windowKey="town-event-message" assets={assets} portrait={message.portrait} textId="town-event-message-text" text={message.text}
    data={{ 'data-town-event': state.pending!.kind }} onClose={() => onResolve(!choice)}
    buttons={message.buttons.map((button, i) => ({ caption: button.caption, id: `town-event-${i}`, onClick: () => onResolve(button.accept) }))}/>;
}
