import { copyIrrigation, validateIrrigation, type IrrigationState } from '../formats/irrigation';
import type { WorldCell } from '../formats/scenario';
import { createTrafficState, snapshotTraffic, type TrafficDefaults } from '../formats/traffic';
import { validateMovingDisasters, type MovingDisasterState } from './moving-disasters';
import { resetTrafficRecords } from './starting-traffic';
import type { WeatherState } from './weather';

export interface SetupActivity {
  cells: WorldCell[];
  irrigation: IrrigationState;
  traffic: TrafficDefaults;
  disasters: MovingDisasterState;
  weather: WeatherState;
}

/** Direct activity writes in restart402a8..4094d, before chooser/setup3f854.
 * Detached intermediate state, not a playable restart or a cold constructor.
 * Full record/account reset and later terrain/town/forecast phases are separate.
 * Callers supply validated canonical weather; unknown/unassigned members survive. */
export function resetSetupActivity(previous: SetupActivity): SetupActivity {
  const word = (n: number) => Number.isInteger(n) && n >= 0 && n <= 65535;
  if (previous.cells.length !== 9216) throw new Error('Invalid restart map size');
  for (const cell of previous.cells) if (!cell || !word(cell.terrain) || !word(cell.overlay) ||
    !Number.isInteger(cell.attribute) || cell.attribute < 0 || cell.attribute > 255) throw new Error('Invalid restart map cell');
  validateIrrigation(previous.irrigation); validateMovingDisasters(previous.disasters);
  const traffic = createTrafficState(previous.traffic);
  for (const year of [previous.weather.windYear, previous.weather.temperatureYear, previous.weather.precipitationYear])
    if (!Number.isInteger(year) || year < 0 || year > 4) throw new Error('Invalid restart climate year');
  const irrigation = copyIrrigation(previous.irrigation);
  irrigation.sources.fill(0); irrigation.sourceCount = 0;
  irrigation.active = false; irrigation.phase = 0; irrigation.flow = [];
  // Delay and lastTick survive this reset. Setup3fa9c later synchronizes lastTick.
  resetTrafficRecords(traffic);
  return {
    cells: previous.cells.map(cell => ({ ...cell, terrain: cell.terrain & 0xc7ff, overlay: cell.overlay & 0x87ff })),
    irrigation, traffic: snapshotTraffic(traffic),
    disasters: { ...structuredClone(previous.disasters), enabled: true },
    weather: { ...structuredClone(previous.weather), windYear: 0, temperatureYear: 0, precipitationYear: 0 },
  };
}

/** Setup3fa90..3fa9c, after chooser returns and before town/startup weather.
 * Kept separate because a loaded chooser outcome can replace animationTicks. */
export function synchronizeSetupIrrigation(irrigation: IrrigationState, animationTicks: number): void {
  validateIrrigation(irrigation);
  if (!Number.isInteger(animationTicks) || animationTicks < 0 || animationTicks > 65535)
    throw new Error('Invalid setup animation tick');
  irrigation.lastTick = animationTicks;
}
