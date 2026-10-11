import type { GameCommand, GameSnapshot } from '../simulation/game';
import { findBuilding } from '../simulation/building-storage';

interface Props {
  snapshot: GameSnapshot; position: { x: number; y: number } | null; onCommand: (command: GameCommand) => void;
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
