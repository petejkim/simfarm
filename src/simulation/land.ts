import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';

export interface LandQuote { price: number; ownership: number; fertility: number }
export type LandPurchaseResult = { ok: true; regionX: number; regionY: number; price: number }
  | { ok: false; reason: 'outside-map' | 'not-for-sale' | 'insufficient-cash' };

const validRegion = (x: number, y: number) => [x, y].every(n => Number.isInteger(n) && n >= 0 && n < 12);
const ownership = (world: Scenario, x: number, y: number) => world.regionalConditions[(x * 12 + y) * 7 + 1];

/** Overlay 15, file 0x3c766. Initialized base price at DS 6190:7516 is 15000.
 * The terrain surcharge tests the FIRST map word's bit 12, not ownership in the second word. */
export function quoteLand(world: Scenario, regionX: number, regionY: number, soilMoisture: number): LandQuote | null {
  if (!validRegion(regionX, regionY)) return null;
  let occupied = 0, surcharge = 0;
  for (let i = 0; i < 144; i++) if (world.regionalConditions[i * 7 + 1] !== 0) occupied++;
  for (let x = regionX * 8; x < regionX * 8 + 8; x++) for (let y = regionY * 8; y < regionY * 8 + 8; y++) {
    if (world.cells[worldIndex(x, y)].terrain & 0x1000) surcharge += 500;
  }
  const fertility = world.regionalConditions[(regionX * 12 + regionY) * 7 + 6] >> 4;
  const price = (15000 + occupied * 100 + fertility * 16 + (soilMoisture << 24 >> 24) * 16 + surcharge) & 0xffff;
  return { price, ownership: ownership(world, regionX, regionY), fertility };
}

// DS 6190:59c4, indexed by N/E/S/W bits 1/2/4/8. DS 56c6 connects fences (177..187)
// and gates (188..191); its gate flags 0x24 prevent rewriting gate graphics.
const fenceShapes = [0, 0, 1, 2, 0, 0, 3, 4, 1, 5, 1, 6, 7, 8, 9, 10];
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < 96 && y < 96;
function fenceMask(world: Scenario, x: number, y: number): number {
  let mask = 0;
  directions.forEach(([dx, dy], bit) => {
    if (!inMap(x + dx, y + dy)) return;
    const tile = terrainTile(world.cells[worldIndex(x + dx, y + dy)]);
    if (tile >= 177 && tile < 192) mask |= 1 << bit;
  });
  return mask;
}

/** Fence specialization of 21c2:1578 (file 0x25398), with mask helper 0x24b54. */
function connectFence(world: Scenario, x: number, y: number): void {
  const mask = fenceMask(world, x, y), cell = world.cells[worldIndex(x, y)];
  cell.terrain = (cell.terrain & 0xf800) | (177 + fenceShapes[mask]);
  directions.forEach(([dx, dy], bit) => {
    if (!(mask & (1 << bit))) return;
    const neighbor = world.cells[worldIndex(x + dx, y + dy)];
    if (terrainTile(neighbor) >= 188) return; // Gates connect but retain their orientation.
    neighbor.terrain = (neighbor.terrain & 0xf800) | (177 + fenceShapes[fenceMask(world, x + dx, y + dy)]);
  });
}

/** 0x3cd0a..0x3d692: top, bottom, left, right, skipping sides adjoining owned regions.
 * Only grass, 535..538 and 131..146 become fences. Existing obstacles remain. */
function fencePurchasedLand(world: Scenario, regionX: number, regionY: number): void {
  const x = regionX * 8, y = regionY * 8;
  const sides = [
    { neighbor: [regionX, regionY - 1], start: [x, y], step: [1, 0] },
    { neighbor: [regionX, regionY + 1], start: [x, y + 7], step: [1, 0] },
    { neighbor: [regionX - 1, regionY], start: [x, y], step: [0, 1] },
    { neighbor: [regionX + 1, regionY], start: [x + 7, y], step: [0, 1] },
  ];
  for (const side of sides) {
    const [nx, ny] = side.neighbor;
    if (validRegion(nx, ny) && ownership(world, nx, ny) === 1) continue;
    for (let i = 0; i < 8; i++) {
      const px = side.start[0] + i * side.step[0], py = side.start[1] + i * side.step[1];
      const tile = terrainTile(world.cells[worldIndex(px, py)]);
      if ((tile >= 15 && tile < 31) || (tile >= 535 && tile < 539) || (tile >= 131 && tile < 147)) connectFence(world, px, py);
    }
  }
}

/** Original buy command 0x35698 -> overlay 15:1d1a/file 0x3c8ba, fence flag 1.
 * Cash debit category 2000 posts to 6190:3e80 (0x1c88e); ownership lives in region channel 1. */
export function purchaseLand(world: Scenario, regionX: number, regionY: number, soilMoisture: number): LandPurchaseResult {
  const quote = quoteLand(world, regionX, regionY, soilMoisture);
  if (!quote) return { ok: false, reason: 'outside-map' };
  if (quote.ownership !== 0) return { ok: false, reason: 'not-for-sale' };
  if (!quote.price || world.farm.cash < quote.price) return { ok: false, reason: 'insufficient-cash' };
  world.farm.cash -= quote.price;
  world.farm.landExpenses = (world.farm.landExpenses + quote.price) >>> 0;
  world.regionalConditions[(regionX * 12 + regionY) * 7 + 1] = 1;
  for (let x = regionX * 8; x < regionX * 8 + 8; x++) for (let y = regionY * 8; y < regionY * 8 + 8; y++) {
    world.cells[worldIndex(x, y)].overlay |= 0x0800;
  }
  fencePurchasedLand(world, regionX, regionY);
  return { ok: true, regionX, regionY, price: quote.price };
}
