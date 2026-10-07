import { Binary } from './binary';
import { readAssetSaleState, type AssetSaleState } from './asset-sale';
import { readOtherGoodsDefinitions, type GoodsDefinition } from './inventory';

/** Explicit financial state until calendar/checkpoint integration. */
export interface DefaultState {
  assets: AssetSaleState;
  otherDefinitions: GoodsDefinition[];
  buildingBookValue: number;
  landIncome: number;
  equipmentExpenses: number;
  balancePayments: number;
  taxExpenses: number;
  homeRegionX: number;
  homeRegionY: number;
}

/** Loader 0x45d1e/0x45d7e/0x45e0e/0x45e3e and 0x45ece..0x45efb.
 * Building book value is deliberately supplied, not assigned a guessed SSM
 * offset: original initialization/persistence is unresolved (SF-065). */
export function readDefaultState(bytes: Uint8Array, buildingBookValue: number): DefaultState {
  const b = new Binary(bytes), homeRegionX = b.u16(0x216e0), homeRegionY = b.u16(0x216e2);
  if (homeRegionX >= 12 || homeRegionY >= 12) throw new Error('Invalid protected home region');
  if (!Number.isInteger(buildingBookValue) || buildingBookValue < 0 || buildingBookValue > 0xffffffff) throw new Error('Invalid building book value');
  return { assets: readAssetSaleState(bytes), otherDefinitions: readOtherGoodsDefinitions(bytes), buildingBookValue,
    homeRegionX, homeRegionY, landIncome: b.u32(0x21698), equipmentExpenses: b.u32(0x216a8),
    balancePayments: b.u32(0x216c0), taxExpenses: b.u32(0x216c8) };
}
