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
  precipitationDays: number;
  autoRent: boolean;
  rentalExpenses: number;
  townRegionX: number;
  townRegionY: number;
}
/** Loader file 0x45f0e..0x45ffe and 0x461c6..0x461de. */
export function readFarmState(bytes: Uint8Array): SavedFarmState {
  const b = new Binary(bytes);
  const calendar = { day: b.u16(CALENDAR_OFFSET), season: b.u16(CALENDAR_OFFSET + 2), week: b.u16(CALENDAR_OFFSET + 4),
    year: b.u16(CALENDAR_OFFSET + 6), month: b.u16(CALENDAR_OFFSET + 8) };
  validateCalendar(calendar);
  const townRegionX = b.u16(0x2170b), townRegionY = b.u16(0x2170d);
  if (townRegionX >= 12 || townRegionY >= 12) throw new Error('Invalid town region');
  return { cash: b.u32(CASH_OFFSET), calendar, timerTicks: b.u16(0x216f9), animationTicks: b.u16(0x216f7),
    dayDelayTicks: b.u16(0x2171a), speed: b.u16(0x2171c), precipitationDays: b.u16(0x216e8),
    autoRent: Boolean(bytes[0x21731]), rentalExpenses: b.u32(0x216c4), townRegionX, townRegionY };
}
