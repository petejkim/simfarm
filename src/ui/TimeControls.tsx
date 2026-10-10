import type { GameCommand, GameSnapshot } from '../simulation/game';
import { SIMULATION_SPEEDS } from '../simulation/game';
import { calendarDayPeriod } from '../simulation/calendar-clock';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const skies = ['Clear', 'Partly cloudy', 'Cloudy', 'Rain', 'Snow'];
export function TimeControls({ snapshot, onCommand }: { snapshot: GameSnapshot; onCommand: (command: GameCommand) => void }) {
  const { scenario, weather, paused } = snapshot, date = scenario.farm.calendar;
  const scheduleResult = snapshot.lastScheduleResult;
  const calendarBlocked = calendarDayPeriod(scenario.farm.dayDelayTicks) === null;
  const scheduleFailures = { 'no-seeds': 'no seed in stock and automatic seed buying is disabled',
    'insufficient-funds': 'not enough cash for seed', 'invalid-field': 'field unavailable',
    'invalid-crop': 'crop unavailable', 'field-busy': 'equipment is still assigned' };
  return <section className="toolbar time-controls" aria-label="Farm time">
    <div><strong id="farm-date">{months[date.month]} {date.week * 7 + date.day + 1}, {date.year}</strong>
      <span id="farm-weather">{skies[weather.current]} · {weather.displayTemperature}°F · wind {weather.wind} mph</span>
      <span id="farm-cash">${scenario.farm.cash.toLocaleString('en-US')}</span>
      <span id="schedule-status" role="status">{scheduleResult && !scheduleResult.ok
        ? `Weekly orders stopped at field ${scenario.fields[scheduleResult.fieldSlot].number}: ${scheduleFailures[scheduleResult.reason]}.`
        : 'Field plans run automatically each week.'}</span></div>
    <div><span role="status" id="time-status">{paused ? 'Paused' : 'Running'} · {snapshot.daysAdvanced} days advanced</span>
      <label className="simulation-speed" htmlFor="simulation-speed"><span id="simulation-speed-label">Speed</span>
        <input id="simulation-speed" type="range" min="0" max={SIMULATION_SPEEDS.length - 1} step="1"
          disabled={Boolean(snapshot.finances.defaultDecision || snapshot.pendingTown)}
          aria-labelledby="simulation-speed-label"
          value={SIMULATION_SPEEDS.findIndex(speed => speed === snapshot.speed)} aria-valuetext={`${snapshot.speed}× simulation speed`}
          onChange={event => onCommand({ type: 'set-speed', speed: SIMULATION_SPEEDS[Number(event.target.value)] })} />
        <output id="simulation-speed-value" htmlFor="simulation-speed" title={calendarBlocked ? 'This save’s calendar cannot advance.' : 'At 1×, one full game day takes four real seconds.'}>{snapshot.speed}×</output>
      </label>
      <button id="play-pause" disabled={Boolean(snapshot.finances.defaultDecision || snapshot.pendingTown)} onClick={() => onCommand({ type: 'set-paused', paused: !paused })}>{paused ? 'Play' : 'Pause'}</button>
      <button id="next-day" disabled={calendarBlocked || !paused || Boolean(snapshot.finances.defaultDecision || snapshot.pendingTown || snapshot.aircraftFlight)} onClick={() => onCommand({ type: 'advance-day' })}>Next day</button>
      {calendarBlocked && <span id="calendar-delay-status" role="status">This save cannot advance the calendar. Load a different save or start a new farm.</span>}</div>
  </section>;
}
