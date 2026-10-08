import { useState } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { findBuilding } from '../simulation/building-storage';
import { checkEquipmentMove, checkEquipmentPickup, type EquipmentMoveTarget } from '../simulation/manual-equipment-move';

const reasons = {
  'outside-map': 'Choose a tile inside the map.', 'no-equipment': 'There is no machine on this tile.',
  'equipment-busy': 'This machine is in use or already moving.', 'building-closed': 'Open the building below to select its machinery.',
  'use-aircraft-controls': 'Use Aircraft → Fly aircraft to move this plane.',
  'inconsistent-equipment': 'The machine or its storage contents are inconsistent.',
  'target-changed': 'The selected machine has changed. Select it again.', 'not-owned': 'Choose a destination on your land.',
};
interface Props {
  snapshot: GameSnapshot; position: { x: number; y: number } | null; onCommand: (command: GameCommand) => void;
}

export function EquipmentMovePanel({ snapshot, position, onCommand, onPicked }: Props & { onPicked: () => void }) {
  const [selected, setSelected] = useState<EquipmentMoveTarget | null>(null);
  const quote = position ? selected ? checkEquipmentMove(snapshot.scenario, selected, position.x, position.y)
    : checkEquipmentPickup(snapshot.scenario, position.x, position.y) : null;
  const result = snapshot.lastEquipmentMoveResult;
  return <section id="equipment-move-panel" className="land-panel">
    <h2>Move machinery</h2>
    <p>{selected ? `Machine ${selected.slot} selected. Click its destination on the map.` : 'Click a machine on the map, then select it here. Open a building to access stored machinery.'}</p>
    <p id="equipment-move-quote" role="status">{quote ? quote.ok
      ? selected ? `Destination: ${position!.x}, ${position!.y}.` : `Machine ${quote.slot} at ${quote.x}, ${quote.y}.`
      : reasons[quote.reason] : selected ? 'Choose a destination.' : 'Choose a machine.'}</p>
    {selected ? <>
      <p>Machinery travels while the simulation runs. Towed equipment needs a tractor; automatic rental may cost money. Farm work can take priority over this move.</p>
      <button id="move-equipment" disabled={!quote?.ok} onClick={() => {
        if (!position || !quote?.ok) return;
        onCommand({ type: 'move-equipment', selected, ...position }); setSelected(null); onPicked();
      }}>Move here</button>
      <button id="cancel-equipment-move" onClick={() => { setSelected(null); onPicked(); }}>Cancel selection</button>
    </> : <button id="select-equipment-move" disabled={!quote?.ok} onClick={() => {
      if (!quote?.ok) return; setSelected({ ...quote }); onPicked();
    }}>Select machine</button>}
    {result && <p id="equipment-move-result" role="status">{result.ok
      ? `Movement ordered for machine ${result.slot}. Resume the simulation or advance a day to move it.` : reasons[result.reason]}</p>}
  </section>;
}

export function BuildingInteriorControls({ snapshot, position, onCommand }: Props) {
  const building = position && findBuilding(snapshot.scenario, position.x, position.y);
  if (!building || building.type === 70 || building.type === 71) return null;
  const open = Boolean(building.flags & 1);
  return <section id="building-interior-panel" className="land-panel">
    <h2>Building {building.slot}</h2>
    <p id="building-interior-status">{open ? 'Interior visible' : 'Building closed'}</p>
    <button id="toggle-building-interior" onClick={() => onCommand({ type: 'toggle-building-interior', ...position!, slot: building.slot })}>
      {open ? 'Close building' : 'Open building'}</button>
  </section>;
}
