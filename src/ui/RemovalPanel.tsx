import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkManualRemoval, type RemovalTarget } from '../simulation/manual-removal';

const messages = {
  'outside-map': 'Select a tile inside the map.',
  'town-owned': 'Town-owned land cannot be cleared.',
  'insufficient-cash': 'You need $25 to bulldoze this location.',
  'no-target': 'Nothing removable at this tile. Select a field, building, supply, chemical or removable terrain.',
  'field-busy': 'Equipment is working in this field. Wait until it is Waiting or Growing before removing it.',
  'target-changed': 'The selected object has changed. Select it again before removing it.',
};
const label = (target: RemovalTarget) => target.kind === 'terrain' ? 'Terrain' : `${({ building: 'Building', field: 'Field', inventory: 'Supply', chemical: 'Chemical' })[target.kind]} ${target.slot}`;

export function RemovalPanel({ snapshot, position, onCommand, onCancel }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null;
  onCommand: (command: GameCommand) => void; onCancel: () => void;
}) {
  const quote = position ? checkManualRemoval(snapshot.scenario, position.x, position.y) : null;
  const result = snapshot.lastRemovalResult;
  return <section className="land-panel" id="removal-panel" aria-label="Bulldoze">
    <span className="eyebrow">BULLDOZE</span>
    <p>Click a field, building, supply, chemical or removable terrain, then confirm its removal. Each removal costs $25.</p>
    <p id="removal-selection">{quote?.ok ? `${label(quote)} at ${quote.x}, ${quote.y} · ${quote.width} × ${quote.height} tiles.`
      : quote ? messages[quote.reason] : 'Select a location on the map.'}</p>
    {quote?.ok && <p id="removal-consequences">{quote.kind === 'field'
      ? 'Removing this field destroys its growing crop. You receive no harvest or sale income.'
      : quote.kind === 'building' ? 'Demolition destroys the building and everything stored inside, including machinery, animals and supplies. You receive no sale income.'
      : quote.kind === 'terrain' ? 'Removes this terrain tile and updates connected roads, fences, ditches or shoreline. You receive no sale income.'
      : 'Destroys this supply and all its remaining contents. You receive no sale income.'}</p>}
    <button id="confirm-removal" disabled={!quote?.ok} onClick={() => {
      if (position && quote?.ok) onCommand({ type: 'remove-object', ...position, kind: quote.kind, slot: quote.slot, tile: quote.tile });
    }}>Confirm removal · $25</button>{' '}
    <button id="cancel-removal" disabled={!position} onClick={onCancel}>Cancel selection</button>
    {result && <p id="removal-result" role="status">{result.ok
      ? `${label(result)} removed for $25.` : messages[result.reason]}</p>}
  </section>;
}
