import type { Scenario } from '../formats/scenario';
import type { FinancialState } from '../formats/finance';
import type { CropDefinition } from '../formats/crop';
import { cropPlantTile } from '../formats/crop-slots';
import { readItemText, type BuyCatalog } from '../formats/buy-window';
export interface ShopProduct {
  type: number; name: string; description: string; price: number; count: number;
  width: number; height: number; tile: number | null; card: number | null; cropId: string | null;
}
/** Read-only presentation of the source-selected definition (47fa4/4789a).
 * The browser's 24 seed slots use their actual CRP text/card, never stale slot art. */
export function shopProduct(world: Scenario, finances: FinancialState, crops: readonly CropDefinition[], source: BuyCatalog, itemText: Uint8Array, type: number): ShopProduct {
  const seed = type >= 192 && type < 192 + world.cropFiles.length;
  const definition = type >= 0 && type <= 8 ? world.equipmentDefinitions[type]
    : type >= 64 && type <= 72 ? world.buildingDefinitions[type - 64]
    : type >= 160 && type <= 163 ? finances.accounts.assets.animalDefinitions[type - 160]
    : seed ? world.seedDefinitions[type - 192] : type >= 220 && type <= 223 ? world.chemicalDefinitions[type - 220] : null;
  if (!definition) throw new Error('Unsupported Buy item');
  const crop = seed ? crops.find(c => `${c.id}.crp` === world.cropFiles[type - 192]) : undefined;
  const graphic = definition.graphic & 255;
  const description = crop?.description ?? (graphic * 128 + 128 <= itemText.length ? readItemText(itemText, graphic) : `Item ${type}`);
  const card = definition.bytes[11]; // Original48001 sign-extends this byte; native access is bounded.
  return { type, name: crop?.name ?? description.split('\n')[0].trim(), description, price: (definition.price << 16 >> 16) >>> 0,
    count: 'ownedCount' in definition ? definition.ownedCount : definition.count,
    width: definition.width, height: definition.height, tile: seed ? cropPlantTile(type - 192) : source.tileBases[graphic] ?? null,
    card: crop ? null : card < 80 ? card : null, cropId: crop?.id ?? null };
}
