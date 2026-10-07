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
}
/** Loader file 0x45f0e..0x45ffe and 0x461c6..0x461de. */
export function readFarmState(bytes: Uint8Array): SavedFarmState {
  const b = new Binary(bytes);
  const calendar = { day: b.u16(CALENDAR_OFFSET), season: b.u16(CALENDAR_OFFSET + 2), week: b.u16(CALENDAR_OFFSET + 4),
    year: b.u16(CALENDAR_OFFSET + 6), month: b.u16(CALENDAR_OFFSET + 8) };
  validateCalendar(calendar);
  return { cash: b.u32(CASH_OFFSET), calendar, timerTicks: b.u16(0x216f7), animationTicks: b.u16(0x216f9),
    dayDelayTicks: b.u16(0x2171a), speed: b.u16(0x2171c) };
}
