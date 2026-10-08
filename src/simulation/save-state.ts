import type { MarketState } from './market';
import type { TrafficDefaults } from '../formats/traffic';
import type { NewFarmState } from './new-farm-state';
import type { MovingDisasterState } from './moving-disasters';
import type { WaterDisasterState } from './water-disasters';
import type { Scenario } from '../formats/scenario';
import type { RandomState } from './random';
import type { WeatherState } from './weather';
import type { FinancialState } from '../formats/finance';
import type { TownSite } from './town';
import type { AircraftServiceState } from './aircraft';
import type { AircraftFlight } from './aircraft-flight';
import type { AnimalFrameState } from './animal-world';

/** Tax and reservation have completed; resume at 0xcdf9 after the choice.
 * The public calendar is normalized to January 1 while this phase is pending. */
export interface PendingTownExpansion {
  phase: 'annual-reset';
  site: TownSite;
  resumeRunning: boolean;
}

/** Native checkpoint, not the original DOS SSM format. UI feedback is deliberately transient. */
export interface SimulationState {
  scenario: Scenario;
  /** Generated setup provenance; null for original imports. */
  newFarm: NewFarmState | null;
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
  disasters: MovingDisasterState;
  waterDisasters: WaterDisasterState;
  grassTravelCount: number;
  equipmentAnimationTick: number;
  animalFrame: AnimalFrameState;
  aircraftService: AircraftServiceState;
  aircraftFlight: AircraftFlight | null;
  cropMarketPrices: number[];
  market: MarketState;
  traffic: TrafficDefaults;
  finances: FinancialState;
  pendingTown: PendingTownExpansion | null;
}
export const SIMULATION_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
