import type { AssetSaleState } from '../formats/asset-sale';
import type { GoodsDefinition } from '../formats/inventory';
import { worldIndex, type Scenario } from '../formats/scenario';
import { clearAircraftHome, validAircraftHome } from './aircraft-home';
import { toggleBuildingInterior } from './building-storage';
import { queueClearingEffect, validateClearingEffects, type ClearingEffects } from './clearing-effects';
import { removeIrrigationSource, validateIrrigation } from '../formats/irrigation';

/** Explicit runtime ledger: its original startup/load lifecycle is still under
 * investigation. Do not manufacture a saved offset or a reconstructed total. */
export interface BuildingDemolitionState {
  assets: AssetSaleState;
  buildingBookValue: number;
  otherDefinitions: GoodsDefinition[];
}

/** Cleanup 0x19f6a then generic building deletion 0x3a0aa, as composed by
 * land sale 0x3caa1..0x3cab9. Stored assets are destroyed without proceeds.
 * Prevalidate references/counts before any writes (SF-064). */
export function demolishBuilding(world: Scenario, state: BuildingDemolitionState, slot: number,
  effects: ClearingEffects, soilMoisture: number): boolean {
  const b = world.buildings[slot];
  if (!Number.isInteger(slot) || slot <= 0 || !b?.active) return false;
  prepareBuildingDemolitions(world, state, [slot], effects, soilMoisture).get(slot)!();
  return true;
}

interface Preparation {
  removed: Set<object>;
  removedMachines: Set<number>;
  counts: Map<object, number>;
}

/** Plan a synchronous transaction before cash/ownership changes. The caller
 * applies each callback once, in source map-scan order, without intervening commands. */
export function prepareBuildingDemolitions(world: Scenario, state: BuildingDemolitionState, slots: readonly number[],
  effects: ClearingEffects, soilMoisture: number): Map<number, () => void> {
  const preparation: Preparation = { removed: new Set(), removedMachines: new Set(), counts: new Map() };
  const result = new Map<number, () => void>();
  for (const slot of new Set(slots)) result.set(slot, prepareBuilding(world, state, slot, effects, soilMoisture, preparation));
  for (const e of world.equipment) if (e.active && !preparation.removedMachines.has(e.slot) &&
    (preparation.removedMachines.has(e.attachment) || (e.type !== 7 && preparation.removedMachines.has(e.parent)))) throw new Error('Demolition would break equipment links');
  return result;
}

function prepareBuilding(world: Scenario, state: BuildingDemolitionState, slot: number,
  effects: ClearingEffects, soilMoisture: number, preparation: Preparation): () => void {
  const b = world.buildings[slot];
  if (!Number.isInteger(slot) || slot <= 0 || !b?.active) throw new Error('Invalid demolished building');
  validateClearingEffects(effects, soilMoisture);
  if (b.type === 70 || b.type === 71) validateIrrigation(world.irrigation);
  const def = world.buildingDefinitions[b.type - 64];
  if (!def || def.width < 1 || def.width > 4 || def.height < 1 || def.height > 3 ||
    b.x + def.width > 96 || b.y + def.height > 96 || !def.count ||
    ![state.buildingBookValue, state.assets.equipmentBookValue].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) {
    throw new Error('Invalid building demolition state');
  }
  const actions: (() => void)[] = [];
  const { removed, removedMachines, counts } = preparation;
  const reserve = (definition: object, count: number, decrement = true) => {
    const available = count - (counts.get(definition) ?? 0);
    if (available <= 0) throw new Error('Demolition definition count mismatch');
    if (decrement) counts.set(definition, (counts.get(definition) ?? 0) + 1);
  };
  reserve(def, def.count);
  const contains = (x: number, y: number) => x >= b.x && y >= b.y && x < b.x + def.width && y < b.y + def.height;
  for (let x = 0; x < def.width; x++) for (let y = 0; y < def.height; y++) {
    const item = b.content(x * 3 + y), type = item.type;
    if (type === -1 || type === -2) continue; // -2 falls through generic deletion without a matching category.
    if (type >= 0 && type <= 8) {
      const e = world.equipment[item.slot], d = world.equipmentDefinitions[type];
      if (!item.slot || !e || !d || e.type !== type || !contains(e.x, e.y)) throw new Error('Invalid demolished equipment');
      if (!e.active || removed.has(e)) continue;
      reserve(d, d.ownedCount, !(e.flags & 0x40));
      if (type === 8 && !validAircraftHome(e)) throw new Error('Invalid demolished aircraft home');
      removed.add(e); removedMachines.add(e.slot);
      actions.push(() => {
        if (!(e.flags & 0x40)) { d.ownedCount--; state.assets.equipmentBookValue = (state.assets.equipmentBookValue - d.price) >>> 0; }
        if (type === 8) clearAircraftHome(world, e);
        e.flags &= ~0x20;
      });
    } else if (type >= 160 && type <= 164) {
      const a = world.animals[item.slot], d = state.assets.animalDefinitions[type - 160];
      if (!item.slot || !a || !d || a.type !== type || !contains(a.x, a.y)) throw new Error('Invalid demolished animal');
      if (!a.active || removed.has(a)) continue;
      reserve(d, d.count); removed.add(a);
      if (a.flags & 4) {
        if (a.buildingSlot !== slot || d.width < 1 || d.height < 1 || a.x + d.width > b.x + def.width || a.y + d.height > b.y + def.height ||
          ![6, 7, 8, 9, 10, 11, 61, 104, 103].includes(def.graphic)) throw new Error('Invalid demolished animal storage');
        for (let dx = 0; dx < d.width; dx++) for (let dy = 0; dy < d.height; dy++) {
          const c = b.content((a.x - b.x + dx) * 3 + a.y - b.y + dy);
          if (c.type !== type || c.slot !== a.slot) throw new Error('Demolished animal footprint mismatch');
        }
      }
      actions.push(() => {
        d.count--;
        if (a.flags & 4) {
          for (let dx = 0; dx < d.width; dx++) for (let dy = 0; dy < d.height; dy++) b.clearContent((a.x - b.x + dx) * 3 + a.y - b.y + dy);
          toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
        }
        a.flags &= ~0x20;
      });
    } else if ((type >= 168 && type < 184) || (type >= 192 && type < 208) || type === 299 || type === 300) {
      const i = world.inventory[item.slot], d = type < 184 ? world.harvestDefinitions[type - 168]
        : type < 208 ? world.seedDefinitions[type - 192] : state.otherDefinitions[type - 288];
      if (!item.slot || !i || !d || i.type !== type || !contains(i.x, i.y)) throw new Error('Invalid demolished inventory');
      if (!i.active || removed.has(i)) continue;
      reserve(d, d.count); removed.add(i);
      actions.push(() => { d.count--; i.bytes[10] &= ~0x20; });
    } else if (type >= 220 && type <= 223) {
      const c = world.chemicals[item.slot], d = world.chemicalDefinitions[type - 220];
      if (!item.slot || !c || !d || c.type !== type || !contains(c.x, c.y)) throw new Error('Invalid demolished chemical');
      if (!c.active || removed.has(c)) continue;
      reserve(d, d.count); removed.add(c);
      actions.push(() => { d.count--; c.bytes[2] &= ~0x20; });
    } else if ((type >= 128 && type < 152) || (type >= 288 && type <= 304)) {
      const d = type < 152 ? world.cropDefinitions[type - 128] : state.otherDefinitions[type - 288];
      if (!d) throw new Error('Invalid demolished goods definition');
      reserve(d, d.count); actions.push(() => { d.count--; });
    } else throw new Error('Unsupported demolished content type');
  }
  return () => {
    for (const action of actions) action();
    // SF-093: generic land-sale cleanup omitted the source removal performed
    // by the original manual bulldozer. Do not retain a destroyed wind source.
    if (b.type === 70 || b.type === 71) removeIrrigationSource(world.irrigation, b.x, b.y);
    for (let x = b.x; x < b.x + def.width; x++) for (let y = b.y; y < b.y + def.height; y++) {
      const cell = world.cells[worldIndex(x, y)];
      cell.terrain = (((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0xf7ff);
      queueClearingEffect(world, effects, x, y, soilMoisture);
    }
    def.count--; state.buildingBookValue = (state.buildingBookValue - (def.price << 16 >> 16)) >>> 0;
    b.flags &= ~0x20;
  };
}
