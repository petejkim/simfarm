import { Binary } from './binary';
import { validateCalendar, type FarmCalendar } from '../simulation/calendar';

export const CASH_OFFSET = 0x216e4;
export const CALENDAR_OFFSET = 0x216ed;
export interface SavedFarmState {
  cash: number;
  calendar: FarmCalendar;
  timerTicks: number;
  animationTicks: number;
  dayDelayTicks: number;
  speed: number;
  paceEquipment: boolean;
  /** Full DSa8a0 / SSM21718. Legacy checkpoints retain only the boolean gate. */
  equipmentPacingByte: number | null;
  precipitationDays: number;
  autoRent: boolean;
  autoBuySeeds: boolean;
  autoClear: boolean;
  seedExpenses: number;
  rentalExpenses: number;
  cropIncome: number;
  contractGains: number;
  contractLosses: number;
  salesAccumulator: number;
  workerExpenses: number;
  landExpenses: number;
  chemicalExpenses: number;
  townRegionX: number;
  townRegionY: number;
}
/** Loader file 0x45f0e..0x45ffe and 0x461c6..0x461de. */
export function readFarmState(bytes: Uint8Array, workerExpenses = 0): SavedFarmState {
  if (!Number.isInteger(workerExpenses) || workerExpenses < 0 || workerExpenses > 0xffffffff) throw new Error('Invalid retained worker expenses');
  const b = new Binary(bytes);
  const calendar = { day: b.u16(CALENDAR_OFFSET), season: b.u16(CALENDAR_OFFSET + 2), week: b.u16(CALENDAR_OFFSET + 4),
    year: b.u16(CALENDAR_OFFSET + 6), month: b.u16(CALENDAR_OFFSET + 8) };
  validateCalendar(calendar);
  const townRegionX = b.u16(0x2170b), townRegionY = b.u16(0x2170d);
  if (townRegionX >= 12 || townRegionY >= 12) throw new Error('Invalid town region');
  return { cash: b.u32(CASH_OFFSET), calendar, timerTicks: b.u16(0x216f9), animationTicks: b.u16(0x216f7),
    dayDelayTicks: b.u16(0x2171a), speed: b.u16(0x2171c), precipitationDays: b.u16(0x216e8),
    autoRent: Boolean(bytes[0x21731]), rentalExpenses: b.u32(0x216c4), townRegionX, townRegionY,
    cropIncome: b.u32(0x21690), contractGains: b.u32(0x2169c), contractLosses: b.u32(0x216b0),
    salesAccumulator: b.u32(0x21722), workerExpenses, // SF-014: original loader never restores 6190:3e88.
    landExpenses: b.u32(0x216b4), // SF-014: second 3e80 read overwrites the entry at 0x216ac.
    chemicalExpenses: b.u32(0x216bc), // 0x45e06 -> 6190:3ea0.
    autoBuySeeds: Boolean(bytes[0x2173b]), autoClear: Boolean(bytes[0x21737]),
    seedExpenses: b.u32(0x216a4), paceEquipment: Boolean(b.slice(0x21718, 1)[0]), equipmentPacingByte: b.slice(0x21718, 1)[0] };
}

/** Verified source stores update both the byte and its nonzero machinery gate. */
export function setEquipmentPacingByte(farm: SavedFarmState, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error('Invalid equipment pacing byte');
  farm.equipmentPacingByte = value; farm.paceEquipment = value !== 0;
}
