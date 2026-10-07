import { Binary } from './binary';
import { readAnimalDefinitions } from './animal';
import type { GoodsDefinition } from './inventory';

/** Explicit sale state until finance/checkpoint integration. */
export interface AssetSaleState {
  animalDefinitions: GoodsDefinition[];
  equipmentBookValue: number;
  equipmentIncome: number;
  livestockIncome: number;
}
/** 0x45c76/0x45d06/0x45d4e: dwords -> 3e50/3e64/3e74. */
export function readAssetSaleState(bytes: Uint8Array): AssetSaleState {
  const b = new Binary(bytes);
  return { animalDefinitions: readAnimalDefinitions(bytes), equipmentBookValue: b.u32(0x2167c),
    equipmentIncome: b.u32(0x21694), livestockIncome: b.u32(0x216a0) };
}
