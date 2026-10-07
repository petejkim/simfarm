/** Original 6190:124e..1256. Months and weeks are zero-based; years have 336 days. */
export interface FarmCalendar { day: number; season: number; week: number; year: number; month: number }
export interface CalendarAdvance {
  calendar: FarmCalendar;
  weekEnded: boolean;
  monthEnded: boolean;
  yearEnded: boolean;
}
export function validateCalendar(value: FarmCalendar): void {
  for (const [key, max] of Object.entries({ day: 6, season: 3, week: 3, year: 65535, month: 11 })) {
    const n = value[key as keyof FarmCalendar];
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`Invalid farm calendar ${key}`);
  }
}
/** Calendar arithmetic from file 0xc88e..0xcfa1; subsystem callbacks are handled by the game scheduler. */
export function advanceCalendarDay(value: FarmCalendar): CalendarAdvance {
  validateCalendar(value);
  const calendar = { ...value, day: value.day + 1 };
  const weekEnded = calendar.day === 7;
  let monthEnded = false, yearEnded = false;
  if (weekEnded) {
    calendar.day = 0;
    calendar.week++;
    // The executable evaluates seasons BEFORE month rollover. Week 22 deliberately retains the previous season.
    const weekOfYear = calendar.month * 4 + calendar.week;
    if ((weekOfYear >= 45 && weekOfYear <= 47) || weekOfYear < 10) calendar.season = 0;
    if (weekOfYear >= 10 && weekOfYear < 22) calendar.season = 1;
    if (weekOfYear >= 23 && weekOfYear < 34) calendar.season = 2;
    if (weekOfYear >= 34 && weekOfYear < 45) calendar.season = 3;
    monthEnded = calendar.week === 4;
    if (monthEnded) {
      calendar.week = 0;
      calendar.month++;
      yearEnded = calendar.month === 12;
      if (yearEnded) { calendar.month = 0; calendar.year = (calendar.year + 1) & 0xffff; }
    }
  }
  return { calendar, weekEnded, monthEnded, yearEnded };
}
