import { useState } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkSupplyMove, checkSupplyPickup, type SupplyMoveTarget } from '../simulation/manual-supply-move';

const names = { seed: 'Seed', harvest: 'Harvested crop', chemical: 'Chemical', trough: 'Water trough', feed: 'Feed' };
const reasons = {
  'outside-map': 'Choose a tile inside the map.', 'equipment-here': 'Use Move machinery for this tile.',
  'no-supply': 'No movable supply is visible here. Open a building below to reveal its contents.',
  'inconsistent-supply': 'The supply does not match its map or storage contents.',
  'target-changed': 'The selected supply has changed. Select it again.', 'not-owned': 'Choose a destination on your land.',
  'blocked-terrain': 'Choose clear grass for this supply.', 'incompatible-storage': 'This supply cannot move into that building.',
  'no-storage-space': 'There is no free space in this building.',
  'storage-slot-overflow': 'This supply can move outdoors, but cannot be placed in storage.',
};

export function SupplyMovePanel({ snapshot, position, onCommand, onPicked }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null;
  onCommand: (command: GameCommand) => void; onPicked: () => void;
}) {
  const [selected, setSelected] = useState<SupplyMoveTarget | null>(null);
  const pickup = position && !selected ? checkSupplyPickup(snapshot.scenario, snapshot.finances, position.x, position.y) : null;
  const quote = position && selected ? checkSupplyMove(snapshot.scenario, snapshot.finances, selected, position.x, position.y, snapshot.weather.soilMoisture) : null;
  const result = snapshot.lastSupplyMoveResult;
  return <section id="supply-move-panel" className="land-panel">
    <h2>Move supplies</h2>
    <p>{selected ? `${names[selected.kind]} selected. Click its destination on the map.`
      : 'Click seeds, harvested crops, chemicals, feed or a water trough, then select it here.'}</p>
    <p id="supply-move-quote" role="status">{quote ? quote.ok
      ? `${quote.deleted ? 'Discard empty feed' : 'Move immediately'} at ${quote.x}, ${quote.y}${quote.buildingSlot === null ? '' : ` in building ${quote.buildingSlot}`}. No fee.`
      : reasons[quote.reason] : pickup ? pickup.ok ? `${names[pickup.kind]} at ${pickup.x}, ${pickup.y}.` : reasons[pickup.reason]
      : selected ? 'Choose a destination.' : 'Choose a supply.'}</p>
    {selected ? <>
      <button id="move-supply" disabled={!quote?.ok} onClick={() => {
        if (!position || !quote?.ok) return;
        onCommand({ type: 'move-supply', selected, ...position }); setSelected(null); onPicked();
      }}>{quote?.ok && quote.deleted ? 'Discard empty feed here' : 'Move here'}</button>
      <button id="cancel-supply-move" onClick={() => { setSelected(null); onPicked(); }}>Cancel selection</button>
    </> : <button id="select-supply-move" disabled={!pickup?.ok} onClick={() => {
      if (!pickup?.ok) return; setSelected({ ...pickup }); onPicked();
    }}>Select supply</button>}
    {result && <p id="supply-move-result" role="status">{result.ok
      ? result.deleted ? 'Empty feed discarded.' : `${names[result.kind]} moved to ${result.x}, ${result.y}.` : reasons[result.reason]}</p>}
  </section>;
}
