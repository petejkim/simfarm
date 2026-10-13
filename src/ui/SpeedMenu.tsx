import type { GameCommand, GameSnapshot } from '../simulation/game';
import { SIMULATION_SPEEDS } from '../simulation/game';
import { calendarDayPeriod } from '../simulation/calendar-clock';
import type { MenuChoices } from './FileMenu';

/** Speed menu labels for SIMULATION_SPEEDS, in the same order (user-specified wording). */
export const SPEED_MENU_LABELS = ['Very Slow (0.25x)', 'Slow (0.5x)', 'Normal (1x)', 'Fast (2x)', 'Faster (4x)', 'Even Faster (8x)', 'Fastest (16x)'] as const;

const calendarBlocked = (snapshot: GameSnapshot) => calendarDayPeriod(snapshot.scenario.farm.dayDelayTicks) === null;
const timeBlocked = (snapshot: GameSnapshot) => Boolean(snapshot.finances.defaultDecision || snapshot.pendingTown || snapshot.townEvent.pending);

/** Speed menu, replacing the former native Speed window: checkable multiplier presets (1× = one game day per
 * four real seconds), between Pause/Resume and Next Day, with separators (user layout). A blocking decision disables the whole menu, as it
 * disabled the window's slider and buttons. */
export function speedMenu(snapshot: GameSnapshot | null, onCommand: (command: GameCommand) => void): MenuChoices {
  const calendar = snapshot ? calendarBlocked(snapshot) : false;
  return {
    labels: SPEED_MENU_LABELS,
    checked: SIMULATION_SPEEDS.map(speed => speed === snapshot?.speed),
    disabled: !snapshot || timeBlocked(snapshot),
    choose: index => { const speed = SIMULATION_SPEEDS[index]; if (speed !== undefined) onCommand({ type: 'set-speed', speed }); },
    separated: true,
    leadingActions: [{ id: 'play-pause', label: snapshot?.paused ? 'Resume' : 'Pause', choose: () => onCommand({ type: 'set-paused', paused: !snapshot?.paused }) }],
    actions: [
      { id: 'next-day', label: 'Next Day', disabled: calendar || !snapshot?.paused || Boolean(snapshot?.aircraftFlight),
        hint: calendar ? 'This save cannot advance the calendar.' : 'Advances one game day while paused.', choose: () => onCommand({ type: 'advance-day' }) },
    ],
  };
}

const scheduleFailures = { 'no-seeds': 'no seed in stock and automatic seed buying is disabled',
  'insufficient-funds': 'not enough cash for seed', 'invalid-field': 'field unavailable',
  'invalid-crop': 'crop unavailable', 'field-busy': 'equipment is still assigned' };

/** Screen-reader status formerly shown in the Speed window: run state, days advanced, weekly order result
 * and the unadvanceable-calendar notice. */
export function TimeStatus({ snapshot }: { snapshot: GameSnapshot }) {
  const { scenario } = snapshot, scheduleResult = snapshot.lastScheduleResult;
  return <div className="file-status">
    <span id="time-status" role="status">{snapshot.paused ? 'Paused' : 'Running'} · {snapshot.daysAdvanced} days advanced</span>
    <span id="schedule-status" role="status">{scheduleResult && !scheduleResult.ok
      ? `Weekly orders stopped at field ${scenario.fields[scheduleResult.fieldSlot].number}: ${scheduleFailures[scheduleResult.reason]}.`
      : 'Field plans run automatically each week.'}</span>
    {calendarBlocked(snapshot) && <span id="calendar-delay-status" role="status">This save cannot advance the calendar. Load a different save or start a new farm.</span>}
  </div>;
}
