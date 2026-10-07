import { worldIndex, type Scenario } from '../formats/scenario';

export interface TownSite { regionX: number; regionY: number }
export interface TownFunds { townRevenue: number; expansionFunds: number }

/** 0x3b21a -> 0x3c5c8. The first saved regional byte is level:type,
 * not a generic condition. Original debug text calls the sum residential level. */
export function townStatistics(world: Pick<Scenario, 'regionalConditions'>): { regions: number; residentialLevels: number } {
  let regions = 0, residentialLevels = 0;
  for (let i = 0; i < 144; i++) if (world.regionalConditions[i * 7 + 1] === 2) {
    regions++;
    residentialLevels += world.regionalConditions[i * 7] >>> 4;
  }
  return { regions, residentialLevels };
}

/** 0x3c3e6..0x3c4f7: expanding square scans, x then y, radius 1..11.
 * The first unowned region without terrain bits 0x3000 wins, including inland
 * regions; no guessed adjacency or Euclidean-nearest rule is added. */
export function findTownExpansionSite(world: Pick<Scenario, 'regionalConditions' | 'cells' | 'farm'>): TownSite | null {
  const { townRegionX: centerX, townRegionY: centerY } = world.farm;
  if (![centerX, centerY].every(n => Number.isInteger(n) && n >= 0 && n < 12)) throw new Error('Invalid town origin');
  for (let radius = 1; radius < 12; radius++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) for (let y = centerY - radius; y <= centerY + radius; y++) {
      if (x < 0 || x >= 12 || y < 0 || y >= 12 || world.regionalConditions[(x * 12 + y) * 7 + 1] !== 0) continue;
      let blocked = false;
      for (let tx = x * 8; tx < x * 8 + 8; tx++) for (let ty = y * 8; ty < y * 8 + 8; ty++) {
        if (world.cells[worldIndex(tx, ty)].terrain & 0x3000) blocked = true;
      }
      if (!blocked) return { regionX: x, regionY: y };
    }
  }
  return null;
}

/** 0x3bf7a..0x3c04a. Town quote 0x3c840 returns base 15000: both
 * averaged locals are zero. Ownership/payment precede the district chooser.
 * Caller must retain the returned pending site until that choice is resolved. */
export function beginTownExpansion(world: Scenario, funds: TownFunds): TownSite | null {
  if (!Number.isInteger(funds.expansionFunds) || funds.expansionFunds < 0 || funds.expansionFunds > 0xffffffff) throw new Error('Invalid expansion funds');
  const site = findTownExpansionSite(world);
  if (!site || (funds.expansionFunds | 0) < 15000) return null;
  funds.expansionFunds = (funds.expansionFunds - 15000) >>> 0;
  world.regionalConditions[(site.regionX * 12 + site.regionY) * 7 + 1] = 2;
  return site;
}
