import { Binary } from './binary';
import type { SavedFarmState } from './scenario-state';
import type { FinancialState } from './finance';
import type { DefaultState } from './default-state';

type AccountDefaults = Omit<DefaultState, 'assets' | 'otherDefinitions'> & {
  assets: Omit<DefaultState['assets'], 'animalDefinitions'>;
};
type FinancialDefaults = Omit<FinancialState, 'accounts' | 'town' | 'clearing' | 'defaultDecision'> & {
  accounts: AccountDefaults;
  town: Omit<FinancialState['town'], 'recreationCoordinates'> & { recreationCoordinates: number[] };
};
export interface NewFarmRuntimeDefaults {
  farm: SavedFarmState;
  irrigation: { sources: number[]; sourceCount: number; delay: number; lastTick: number };
  finances: FinancialDefaults;
  /** Unexplained reset targets retain address-based names. */
  raw: { ds3e4c: number; ds3eb8: number; ds4468: number[]; ds64c5: number; s4d9fFedd: number };
}

/** Initialized overlay29, before setup/finalization. In particular, town X is
 * the unset word65535 and cash is20000, not the later property grant40000.
 * No SSM image, DOS execution or synthesized accounting totals are used. */
export function readNewFarmRuntimeDefaults(executable: Uint8Array): NewFarmRuntimeDefaults {
  const b = new Binary(executable);
  if (executable.length !== 0x917b9 || b.u16(0) !== 0x5a4d) throw new Error('Unsupported new-farm executable');
  const address = (offset: number, segment = 0x6190) => 0x4ec60 + (segment - 0x2be7) * 16 + offset;
  const byte = (offset: number, segment?: number) => b.slice(address(offset, segment), 1)[0];
  const word = (offset: number, segment?: number) => b.u16(address(offset, segment));
  const dword = (offset: number, segment?: number) => b.u32(address(offset, segment));
  const bytes = (offset: number, count: number) => Array.from(b.slice(address(offset), count));
  const words = (offset: number, count: number) => Array.from({ length: count }, (_, i) => word(offset + i * 2));
  return {
    farm: {
      cash: dword(0x3e48), calendar: { day: word(0x124e), season: word(0x1250), week: word(0x1252), year: word(0x1254), month: word(0x1256) },
      timerTicks: word(0x139e), animationTicks: word(0x13a0), dayDelayTicks: word(0x1f8c), speed: word(0x1f90),
      paceEquipment: Boolean(byte(0x187)), precipitationDays: word(0x2412),
      autoRent: Boolean(byte(0xa89d)), autoBuySeeds: Boolean(byte(0xa89c)), autoClear: Boolean(byte(0xa89f)),
      seedExpenses: dword(0x3e78), rentalExpenses: dword(0x3ea8), cropIncome: dword(0x3e60), contractGains: dword(0x3e6c),
      contractLosses: dword(0x3e84), salesAccumulator: dword(0x3e44), workerExpenses: dword(0x3e88), landExpenses: dword(0x3e80),
      chemicalExpenses: dword(0x3ea0), townRegionX: word(0x7592), townRegionY: word(0xd530, 0x2d9f),
    },
    irrigation: { sources: Array.from(b.slice(address(0xf954, 0x2d9f), 192)), sourceCount: byte(0x240f),
      delay: word(0x2402), lastTick: word(0xf7d2, 0x2d9f) },
    finances: {
      accounts: {
        assets: { equipmentBookValue: dword(0x3e50), equipmentIncome: dword(0x3e64), livestockIncome: dword(0x3e74) },
        buildingBookValue: dword(0x3e54), landIncome: dword(0x3e68), equipmentExpenses: dword(0x3e7c),
        balancePayments: dword(0x3ea4), taxExpenses: dword(0x3eb4), homeRegionX: word(0x10, 0x2d9f), homeRegionY: word(0x12, 0x2d9f),
      },
      annual: { priorTaxExpenses: dword(0x3e40), ds3e70: dword(0x3e70), ds3e8c: dword(0x3e8c), ds3e90: dword(0x3e90),
        ds3e94: dword(0x3e94), ds3e9c: dword(0x3e9c), livestockExpenses: dword(0x3e98), otherExpenses: dword(0x3eac),
        reportIncome: dword(0x3ebc), reportExpenses: dword(0x3ec0), reportNet: dword(0xfa18, 0x2d9f) },
      statistics: { ds3e58: dword(0x3e58), ds3e5c: dword(0x3e5c), regions: bytes(0x750d, 4), words: words(0x444c, 14),
        fieldPresence: bytes(0x448e, 8), distinctFieldStatuses: byte(0x4560),
        nutrientDeficientFields: word(0xfa1c, 0x2d9f), chemicallyStressedFields: word(0xfa1e, 0x2d9f) },
      homestead: { x: word(0xc, 0x2d9f), y: word(0xe, 0x2d9f), rank: byte(0x462e) },
      debt: { balanceDue: dword(0xd5ba, 0x2d9f), balanceCountdown: byte(0xfed6, 0x4d9f),
        unpaidTaxes: dword(0x7518), taxCountdown: byte(0xfed7, 0x4d9f) },
      loan: { principal: dword(0xb3ae), scheduledPayment: dword(0xb3b2), availableCredit: dword(0xb394), selectedAmount: dword(0xb398) },
      loanRate: word(0xb3a4), taxFailures: byte(0x3eed),
      town: { airportCount: byte(0x64c6), recreationCount: byte(0x9cbc),
        recreationCoordinates: Array.from({ length: 16 }, (_, i) => byte((i & 1 ? 0xf7b2 : 0xf7aa) + (i >>> 1), 0x2d9f)),
        activeSite: { regionX: byte(0xfedb, 0x4d9f), regionY: byte(0xfedc, 0x4d9f) },
        townRevenue: dword(0x758a), expansionFunds: dword(0x758e), developmentSpent: word(0x7514) },
    },
    raw: { ds3e4c: dword(0x3e4c), ds3eb8: dword(0x3eb8), ds4468: words(0x4468, 19), ds64c5: byte(0x64c5),
      s4d9fFedd: byte(0xfedd, 0x4d9f) },
  };
}
