import type { Scenario } from '../formats/scenario';
import type { RandomState } from './random';
import type { WeatherState } from './weather';
import type { FinancialState } from '../formats/finance';

/** Native checkpoint, not the original DOS SSM format. UI feedback is deliberately transient. */
export interface SimulationState {
  scenario: Scenario;
  crops: readonly (readonly number[])[];
  /** Null only when migrating a checkpoint predating live town development. */
  townLayoutBytes: readonly number[] | null;
  random: RandomState;
  weather: WeatherState;
  daysAdvanced: number;
  paused: boolean;
  speed: number;
  elapsed: number;
  dayTicks: number;
  disasterFlags: number;
  grassTravelCount: number;
  equipmentAnimationTick: number;
  cropMarketPrices: number[];
  finances: FinancialState;
}
export const SIMULATION_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
