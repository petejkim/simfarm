import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { connectTerrain, repairTerrainNeighbors } from './terrain-removal';

export type NetworkTool = 'road-161' | 'road-150' | 'fence' | 'gate';
export type NetworkAction = NetworkTool | 'open-gate' | 'close-gate';
export type NetworkPlacementResult = { ok: true; price: number; clearingCost: number; tile: number }
  | { ok: false; reason: 'outside-map' | 'town-land' | 'blocked-terrain' | 'not-owned'
    | 'straight-fence-required' | 'gate-required' | 'insufficient-cash' };
const inMap = (x: number, y: number) => [x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96);

/** Shop branches0x244e8..0x249a7. Only fences require ownership. Native
 * preflight keeps automatic clearing/payment atomic (SF-095). */
export function checkNetworkPlacement(world: Scenario, finances: FinancialState, tool: NetworkAction,
  x: number, y: number, soilMoisture: number): NetworkPlacementResult {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  const cell = world.cells[worldIndex(x, y)];
  if (tool === 'open-gate' || tool === 'close-gate') {
    const tile = terrainTile(cell);
    return tile >= 188 && tile <= 191
      ? { ok: true, price: 0, clearingCost: 0, tile: (tile & ~1) | Number(tool === 'open-gate') }
      : { ok: false, reason: 'gate-required' };
  }
  if (cell.overlay & 0x4000) return { ok: false, reason: 'town-land' };
  if (cell.terrain & 0x800) return { ok: false, reason: 'blocked-terrain' };
  if (![world.farm.cash, world.farm.workerExpenses, finances.annual.otherExpenses]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
    !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid network placement state');
  let tile = terrainTile(cell), clearingCost = 0;
  if (world.farm.autoClear && ((tile >= 535 && tile <= 538) || (tile >= 131 && tile <= 146))) {
    if (world.farm.cash < 25) return { ok: false, reason: 'insufficient-cash' };
    clearingCost = tile >= 535 ? 25 : 0;
    tile = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0x7ff;
  }
  let type: number;
  if (tool === 'road-161' || tool === 'road-150') {
    if (tile >= 15 && tile <= 31) {
      type = tool === 'road-161' ? 288 : 293; tile = tool === 'road-161' ? 161 : 150;
    } else if ((tile >= 87 && tile <= 109) || (tile >= 39 && tile <= 69)) {
      type = 301; tile = 172; // Inclusive source bounds, including the next category's first image.
    } else return { ok: false, reason: 'blocked-terrain' };
  } else if (tool === 'fence') {
    if (tile < 15 || tile > 31) return { ok: false, reason: 'blocked-terrain' };
    if (!(cell.overlay & 0x800)) return { ok: false, reason: 'not-owned' };
    type = 297; tile = 177;
  } else if (tool === 'gate') {
    if (tile !== 177 && tile !== 178) return { ok: false, reason: 'straight-fence-required' };
    type = 303; tile = tile === 177 ? 188 : 190;
  } else throw new Error('Invalid network tool');
  const definition = finances.accounts.otherDefinitions[type - 288];
  if (!definition || definition.type !== type || !Number.isInteger(definition.price)
    || definition.price < 0 || definition.price > 65535) throw new Error('Invalid network purchase definition');
  const price = definition.price; // Unsigned word, debit category−1 -> annual DS3eac.
  if (world.farm.cash < price + clearingCost) return { ok: false, reason: 'insufficient-cash' };
  return { ok: true, price, clearingCost, tile };
}

export function placeNetwork(world: Scenario, finances: FinancialState, tool: NetworkAction,
  x: number, y: number, soilMoisture: number): NetworkPlacementResult {
  const result = checkNetworkPlacement(world, finances, tool, x, y, soilMoisture);
  if (!result.ok) return result;
  if (tool === 'open-gate' || tool === 'close-gate') {
    setGateOpen(world, x, y, tool === 'open-gate');
    return result;
  }
  world.farm.cash -= result.price + result.clearingCost;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  finances.annual.otherExpenses = (finances.annual.otherExpenses + result.price) >>> 0;
  const cell = world.cells[worldIndex(x, y)], tile = result.tile;
  if (tile === 150 || tile === 161 || tile === 177) connectTerrain(world, x, y, tile);
  else {
    cell.terrain = (cell.terrain & 0xf800) | tile;
    if (tile === 172) repairTerrainNeighbors(world, x, y, 'road');
  }
  return { ...result, tile: terrainTile(cell) };
}

/** Gate branch of map interaction0x25708..0x257ad. No ownership, occupancy,
 * payment or connection repair; callers own modal/input checks. Explicit
 * open/close is native idempotent UI over the source's paired tile toggle. */
export function setGateOpen(world: Scenario, x: number, y: number, open: boolean):
  { ok: true; tile: number } | { ok: false; reason: 'outside-map' | 'gate-required' } {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
  if (tile < 188 || tile > 191) return { ok: false, reason: 'gate-required' };
  const next = (tile & ~1) | Number(open);
  cell.terrain = (cell.terrain & 0xf800) | next;
  return { ok: true, tile: next };
}
