import type { GameCommand, GameSnapshot } from '../simulation/game';
import { SIMULATION_SPEEDS } from '../simulation/game';
import { calendarDayPeriod } from '../simulation/calendar-clock';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';

const skies = ['Clear', 'Partly cloudy', 'Cloudy', 'Rain', 'Snow'];
/** Speed window on shared chrome: a sunken status box, the speed slider with its value inset, and Play/Pause
 * and Next day caption buttons. Native pacing only (1× = one game day per four seconds). */
export function TimeControls({ snapshot, onCommand }: { snapshot: GameSnapshot; onCommand: (command: GameCommand) => void }) {
  const { scenario, weather, paused } = snapshot;
  const scheduleResult = snapshot.lastScheduleResult;
  const calendarBlocked = calendarDayPeriod(scenario.farm.dayDelayTicks) === null;
  const scheduleFailures = { 'no-seeds': 'no seed in stock and automatic seed buying is disabled',
    'insufficient-funds': 'not enough cash for seed', 'invalid-field': 'field unavailable',
    'invalid-crop': 'crop unavailable', 'field-busy': 'equipment is still assigned' };
  const blocked = Boolean(snapshot.finances.defaultDecision || snapshot.pendingTown || snapshot.townEvent.pending);
  return <section className="native-window time-controls" aria-label="Farm time">
    <SunkenInset as="div" className="native-status">
      <span id="farm-weather">{skies[weather.current]} · {weather.displayTemperature}°F · wind {weather.wind} mph</span>
      <span id="time-status" role="status">{paused ? 'Paused' : 'Running'} · {snapshot.daysAdvanced} days advanced</span>
      <span id="schedule-status" role="status">{scheduleResult && !scheduleResult.ok
        ? `Weekly orders stopped at field ${scenario.fields[scheduleResult.fieldSlot].number}: ${scheduleFailures[scheduleResult.reason]}.`
        : 'Field plans run automatically each week.'}</span>
    </SunkenInset>
    <label className="native-row simulation-speed" htmlFor="simulation-speed"><span id="simulation-speed-label" className="native-label">Speed</span>
      <input id="simulation-speed" className="chrome-range" type="range" min="0" max={SIMULATION_SPEEDS.length - 1} step="1" disabled={blocked}
        aria-labelledby="simulation-speed-label"
        value={SIMULATION_SPEEDS.findIndex(speed => speed === snapshot.speed)} aria-valuetext={`${snapshot.speed}× simulation speed`}
        onChange={event => onCommand({ type: 'set-speed', speed: SIMULATION_SPEEDS[Number(event.target.value)] })} />
      <SunkenInset className="native-value"><output id="simulation-speed-value" htmlFor="simulation-speed" title={calendarBlocked ? 'This save’s calendar cannot advance.' : 'At 1×, one full game day takes four real seconds.'}>{snapshot.speed}×</output></SunkenInset>
    </label>
    <div className="native-actions">
      <BevelButton id="play-pause" className="native-button" disabled={blocked} onClick={() => onCommand({ type: 'set-paused', paused: !paused })}>{paused ? 'Play' : 'Pause'}</BevelButton>
      <BevelButton id="next-day" className="native-button" disabled={calendarBlocked || !paused || blocked || Boolean(snapshot.aircraftFlight)} onClick={() => onCommand({ type: 'advance-day' })}>Next day</BevelButton>
    </div>
    {calendarBlocked && <span id="calendar-delay-status" className="native-note" role="status">This save cannot advance the calendar. Load a different save or start a new farm.</span>}
  </section>;
}
