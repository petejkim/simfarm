import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkManualRemoval } from '../simulation/manual-removal';

const messages = {
  'outside-map': 'Select a tile inside the map.',
  'town-owned': 'Town-owned land cannot be cleared.',
  'insufficient-cash': 'You need $25 to remove a field or building.',
  'no-target': 'No field or building at this tile. Select one on the map.',
  'field-busy': 'Equipment is working in this field. Wait until it is Waiting or Growing before removing it.',
  'target-changed': 'The selected object has changed. Select it again before removing it.',
};

export function RemovalPanel({ snapshot, position, onCommand, onCancel }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null;
  onCommand: (command: GameCommand) => void; onCancel: () => void;
}) {
  const quote = position ? checkManualRemoval(snapshot.scenario, position.x, position.y) : null;
  const result = snapshot.lastRemovalResult;
  return <section className="land-panel" id="removal-panel" aria-label="Remove field or building">
    <span className="eyebrow">REMOVE FIELD / BUILDING</span>
    <p>Click any tile of a field or building, then confirm its removal. Each removal costs $25.</p>
    <p id="removal-selection">{quote?.ok ? `${quote.kind === 'field' ? 'Field' : 'Building'} ${quote.slot} at ${quote.x}, ${quote.y} · ${quote.width} × ${quote.height} tiles.`
      : quote ? messages[quote.reason] : 'Select a field or building on the map.'}</p>
    {quote?.ok && <p id="removal-consequences">{quote.kind === 'field'
      ? 'Removing this field destroys its growing crop. You receive no harvest or sale income.'
      : 'Demolition destroys the building and everything stored inside, including machinery, animals and supplies. You receive no sale income.'}</p>}
    <button id="confirm-removal" disabled={!quote?.ok} onClick={() => {
      if (position && quote?.ok) onCommand({ type: 'remove-object', ...position, kind: quote.kind, slot: quote.slot });
    }}>Confirm removal · $25</button>{' '}
    <button id="cancel-removal" disabled={!position} onClick={onCancel}>Cancel selection</button>
    {result && <p id="removal-result" role="status">{result.ok
      ? `${result.kind === 'field' ? 'Field' : 'Building'} ${result.slot} removed for $25.` : messages[result.reason]}</p>}
  </section>;
}
