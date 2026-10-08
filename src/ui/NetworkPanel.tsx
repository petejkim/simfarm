import type { RefObject } from 'react';
import type { GameCommand, GameSnapshot } from '../simulation/game';
import { checkNetworkPlacement, type NetworkAction } from '../simulation/network-placement';
import { terrainTile, worldIndex } from '../formats/scenario';

const labels: Record<NetworkAction, string> = { 'road-161': 'Lay dirt road', 'road-150': 'Lay paved road', fence: 'Build fence', gate: 'Install gate', 'open-gate': 'Open gate', 'close-gate': 'Close gate' };
const messages = {
  'outside-map': 'Choose a tile inside the map.', 'town-land': 'Town land cannot be built on.',
  'blocked-terrain': 'Choose clear grass for a road or fence, or a ditch or water tile for a road crossing.',
  'not-owned': 'Buy this land before building a fence.',
  'straight-fence-required': 'Place a gate on a straight fence, away from corners and junctions.',
  'gate-required': 'Select an existing gate on the map.', 'insufficient-cash': 'There is not enough cash for this work.',
};
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
export function NetworkPanel({ snapshot, position, tool, onToolChange, onCommand, headingRef, onChooseMap }: {
  snapshot: GameSnapshot; position: { x: number; y: number } | null; tool: NetworkAction;
  onToolChange: (tool: NetworkAction) => void; onCommand: (command: GameCommand) => void;
  headingRef: RefObject<HTMLHeadingElement | null>; onChooseMap: () => void;
}) {
  const world = snapshot.scenario, definitions = snapshot.finances.accounts.otherDefinitions;
  const quote = position ? checkNetworkPlacement(world, snapshot.finances, tool, position.x, position.y, snapshot.weather.soilMoisture) : null;
  const tile = position ? terrainTile(world.cells[worldIndex(position.x, position.y)]) : -1;
  const result = snapshot.lastNetworkResult;
  return <section className="land-panel" id="network-panel">
    <h2 ref={headingRef} tabIndex={-1}>Roads &amp; fences</h2>
    <p>Choose an action and a map tile, then confirm the work below. Adjacent roads and fences connect automatically.</p>
    <label className="crop-label">Construction action <select id="network-tool" value={tool} onChange={e => onToolChange(e.target.value as NetworkAction)}>
      {(Object.keys(labels) as NetworkAction[]).map(t => <option key={t} value={t}>{labels[t]}</option>)}
    </select></label>
    <p>Dirt road: {money(definitions[0].price)} · Paved road: {money(definitions[5].price)} · Crossing: {money(definitions[13].price)} per tile.</p>
    <p>Fence: {money(definitions[9].price)} · Gate: {money(definitions[15].price)}. Fences need owned land. Open gates let livestock pass; closing is free.</p>
    <button onClick={onChooseMap}>Choose on map</button>
    <label className="clearing"><input id="network-auto-clear" type="checkbox" checked={world.farm.autoClear}
      onChange={e => onCommand({ type: 'set-auto-clear', enabled: e.target.checked })} /> Automatically clear trees</label>
    {tile >= 188 && tile <= 191 && <p id="gate-state">Selected gate is {tile & 1 ? 'open' : 'closed'}.</p>}
    <p id="network-placement-status">{quote ? quote.ok
      ? `Ready at ${position!.x}, ${position!.y} · ${money(quote.price + quote.clearingCost)}${quote.clearingCost ? ` (${money(quote.clearingCost)} clearing)` : ''}.`
      : messages[quote.reason] : 'Select a location on the map.'}</p>
    <button id="apply-network" disabled={!quote?.ok} onClick={() => position && onCommand({ type: 'network', tool, ...position })}>{labels[tool]}</button>
    {result && <p id="network-result" role="status">{result.ok
      ? `${labels[result.tool]} completed for ${money(result.price + result.clearingCost)}.` : messages[result.reason]}</p>}
  </section>;
}
