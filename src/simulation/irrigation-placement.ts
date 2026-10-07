import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';

export type IrrigationTool = 'ditch' | 'valve' | 'open-valve' | 'close-valve';
export type IrrigationPlacementResult = { ok: true; price: number; clearingCost: number; tile: number }
  | { ok: false; reason: 'outside-map' | 'town-land' | 'blocked-terrain' | 'straight-ditch-required'
    | 'valve-required' | 'insufficient-cash' };
const inMap = (x: number, y: number) => [x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96);
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// DS59c4, N/E/S/W bits. Helper0x24b54 scans only the first FOUR DS56ae
// entries: dry, wet, crossing, valve. The fifth pump entry is not visited.
const shapes = [0, 0, 1, 2, 0, 0, 3, 4, 1, 5, 1, 6, 7, 8, 9, 10];
function connectionBase(world: Scenario, x: number, y: number): number | null {
  if (!inMap(x, y)) return null;
  const t = terrainTile(world.cells[worldIndex(x, y)]);
  return t >= 87 && t < 98 ? 87 : t >= 98 && t < 109 ? 98
    : t >= 172 && t < 174 ? 172 : t >= 122 && t < 126 ? 122 : null;
}
function mask(world: Scenario, x: number, y: number): number {
  return directions.reduce((bits, [dx, dy], i) => bits | (connectionBase(world, x + dx, y + dy) === null ? 0 : 1 << i), 0);
}
/** 0x24e9e grass placement; 0x25398 with repaint=0 for road crossings. */
function connect(world: Scenario, x: number, y: number, crossing: boolean): void {
  const neighbors = directions.map(([dx, dy]) => connectionBase(world, x + dx, y + dy));
  const cell = world.cells[worldIndex(x, y)];
  cell.terrain = (cell.terrain & 0xf800) | (crossing ? 172 : 87 + shapes[mask(world, x, y)]);
  neighbors.forEach((base, i) => {
    if (base !== 87 && base !== 98) return; // Source table flag0x20: retain crossing/valve orientation.
    const [dx, dy] = directions[i], nx = x + dx, ny = y + dy;
    const neighbor = world.cells[worldIndex(nx, ny)];
    neighbor.terrain = (neighbor.terrain & 0xf800) | (base + shapes[mask(world, nx, ny)]);
  });
}

/** Source click path0x2424e..0x24a94. Its ditch/valve branches do not require
 * ownership. Native preflight makes auto-clearing and payment atomic (SF-095).
 * Open/close is an explicit native command over verified flow states; original
 * input dispatch and any additional toggle side effects remain untraced. */
export function checkIrrigationPlacement(world: Scenario, finances: FinancialState, tool: IrrigationTool,
  x: number, y: number, soilMoisture: number): IrrigationPlacementResult {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  const cell = world.cells[worldIndex(x, y)];
  if (cell.overlay & 0x4000) return { ok: false, reason: 'town-land' };
  if ((cell.terrain & 0x800) && tool !== 'ditch') return { ok: false, reason: 'blocked-terrain' };
  if (![world.farm.cash, world.farm.workerExpenses, finances.annual.otherExpenses]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
    !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid irrigation placement state');
  let tile = terrainTile(cell), clearingCost = 0;
  if (tool === 'open-valve' || tool === 'close-valve') {
    if (tile < 122 || tile > 125) return { ok: false, reason: 'valve-required' };
    return { ok: true, price: 0, clearingCost: 0, tile: (tile & ~1) | Number(tool === 'close-valve') };
  }
  // Click caller clears before debiting the purchase. Both tree families need
  // $25 available; only535..538 charge it. Masked tiles never auto-clear.
  if (world.farm.autoClear && !(cell.terrain & 0x800) && ((tile >= 535 && tile < 539) || (tile >= 131 && tile < 147))) {
    if (world.farm.cash < 25) return { ok: false, reason: 'insufficient-cash' };
    clearingCost = tile >= 535 ? 25 : 0;
    tile = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0x7ff;
  }
  let type: number;
  if (tool === 'ditch') {
    if (tile >= 15 && tile <= 31) { type = 289; tile = 87; } // Inclusive source upper comparison.
    else if (tile >= 150 && tile < 172) { type = 301; tile = 172; }
    else return { ok: false, reason: 'blocked-terrain' };
  } else if (tool === 'valve') {
    if (tile === 87 || tile === 98) tile = 124;
    else if (tile === 88 || tile === 99) tile = 122;
    else return { ok: false, reason: 'straight-ditch-required' };
    type = 304;
  } else throw new Error('Invalid irrigation tool');
  const definition = finances.accounts.otherDefinitions[type - 288];
  if (!definition || definition.type !== type) throw new Error('Invalid irrigation purchase definition');
  const price = definition.price; // Source zero-extends, unlike signed building purchases.
  if (world.farm.cash < price + clearingCost) return { ok: false, reason: 'insufficient-cash' };
  return { ok: true, price, clearingCost, tile };
}

export function placeIrrigation(world: Scenario, finances: FinancialState, tool: IrrigationTool,
  x: number, y: number, soilMoisture: number): IrrigationPlacementResult {
  const result = checkIrrigationPlacement(world, finances, tool, x, y, soilMoisture);
  if (!result.ok) return result;
  world.farm.cash -= result.price + result.clearingCost;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  finances.annual.otherExpenses = (finances.annual.otherExpenses + result.price) >>> 0; // Debit category−1 -> DS3eac.
  const cell = world.cells[worldIndex(x, y)];
  if (tool === 'ditch') connect(world, x, y, result.tile === 172);
  else cell.terrain = (cell.terrain & 0xf800) | result.tile;
  return { ...result, tile: terrainTile(cell) };
}
