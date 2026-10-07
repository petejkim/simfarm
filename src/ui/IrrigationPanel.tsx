import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkIrrigationPlacement, type IrrigationTool } from '../simulation/irrigation-placement';
import { terrainTile, worldIndex } from '../formats/scenario';

const messages = {
  'outside-map': 'Choose a tile inside the map.', 'town-land': 'Town land cannot be edited.',
  'blocked-terrain': 'Choose grass or a road for a ditch. Automatic clearing can remove trees.',
  'straight-ditch-required': 'Place a valve on a straight ditch, away from corners and junctions.',
  'valve-required': 'Select an existing valve on the map.', 'insufficient-cash': 'There is not enough cash for this work.',
};
const labels: Record<IrrigationTool, string> = { ditch: 'Dig ditch', valve: 'Install valve', 'open-valve': 'Open valve', 'close-valve': 'Close valve' };
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
export function IrrigationPanel({ snapshot, position, tool, onToolChange, onCommand }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null; tool: IrrigationTool;
  onToolChange: (tool: IrrigationTool) => void; onCommand: (command: GameCommand) => void;
}) {
  const world = snapshot.scenario, definitions = snapshot.finances.accounts.otherDefinitions;
  const quote = position ? checkIrrigationPlacement(world, snapshot.finances, tool, position.x, position.y, snapshot.weather.soilMoisture) : null;
  const tile = position ? terrainTile(world.cells[worldIndex(position.x, position.y)]) : -1;
  const valve = tile >= 122 && tile <= 125, result = snapshot.lastIrrigationResult;
  return <section className="land-panel" id="irrigation-panel">
    <span className="eyebrow">IRRIGATION</span>
    <p>Choose an action, click a tile on the map, then use the button below.</p>
    <label className="crop-label">Water tool <select id="irrigation-tool" value={tool} onChange={e => onToolChange(e.target.value as IrrigationTool)}>
      {(Object.keys(labels) as IrrigationTool[]).map(t => <option key={t} value={t}>{labels[t]}</option>)}
    </select></label>
    <p>Ditch: {money(definitions[1].price)} per grass tile · Road crossing: {money(definitions[13].price)} · Valve: {money(definitions[16].price)}.</p>
    <p>Connect ditches to a water pump or wind-powered building using the Build tool. Lay them along field edges to supply water.</p>
    <label className="clearing"><input id="irrigation-auto-clear" type="checkbox" checked={world.farm.autoClear}
      onChange={e => onCommand({ type: 'set-auto-clear', enabled: e.target.checked })} /> Automatically clear trees</label>
    {valve && <p id="valve-state">Selected valve is {tile & 1 ? 'closed' : 'open'}. Closing stops new water passing through; water already downstream drains with the next dry pass.</p>}
    <p id="irrigation-placement-status">{quote ? quote.ok
      ? `Ready at ${position!.x}, ${position!.y} · ${money(quote.price + quote.clearingCost)}${quote.clearingCost ? ` (${money(quote.clearingCost)} clearing)` : ''}.`
      : messages[quote.reason] : 'Select a location on the map.'}</p>
    <button id="apply-irrigation" disabled={!quote?.ok} onClick={() => position && onCommand({ type: 'irrigation', tool, ...position })}>{labels[tool]}</button>
    {result && <p id="irrigation-result" role="status">{result.ok
      ? `Waterworks updated for ${money(result.price + result.clearingCost)}.` : messages[result.reason]}</p>}
  </section>;
}
