import type { CropDefinition } from '../formats/crop';
import { Binary } from '../formats/binary';
import { readScenario } from '../formats/scenario';
import { readFinancialState } from '../formats/finance';
import { readNativeSave, writeNativeSave } from '../formats/native-save';
import { loadMarketCropPrices } from './market';
import type { SimulationState } from './save-state';
import { transferCalendarPhase } from './calendar-clock';
import { enterOriginalPause, leaveOriginalPause } from './original-pause';

/** In-game SSM transfer4543c..4644c and successful menu return43284.
 * Does not rerun chooser setup, weather generation or traffic allocation.
 * Native import dismisses UI/modal continuations and starts paused. */
export function transferOriginalFarm(previous: SimulationState, bytes: Uint8Array, crops: readonly CropDefinition[]): SimulationState {
  const prior = readNativeSave(writeNativeSave(previous, null)).state;
  //3ed67 joins3ecd0; chooser result1 uses3fa42. Both pause before4543c.
  enterOriginalPause(prior.originalPause);
  const state = loadOriginalFarmState(prior, bytes, crops);
  //461a8..461b3 replaces DS0187 from SSM21719 before43284 resumes.
  //Only loaded depth1 reaches the1->0 pacing writes at3f505; the old
  //browser pause state cannot decide this branch. Native play stays paused.
  leaveOriginalPause(state);
  return state;
}

/** Common4543c loader transfers. Caller owns a detached, validated candidate,
 * which may be between restart reset and chooser finalization. Does not apply
 * the in-game menu's resume callback; chooser loads return to a different caller. */
export function loadOriginalFarmState(prior: SimulationState, bytes: Uint8Array, crops: readonly CropDefinition[]): SimulationState {
  const scenario = readScenario(bytes, false, { workerExpenses: prior.scenario.farm.workerExpenses, irrigation: prior.scenario.irrigation });
  const definitions = scenario.cropFiles.map(file => {
    const crop = crops.find(c => `${c.id}.crp` === file);
    if (!crop) throw new Error(`Missing simulation crop ${file}`);
    return [...crop.rawDefinition];
  });
  const market = prior.market;
  loadMarketCropPrices(market, definitions); // Retains29 samples/mode/raw byte.
  const cropMarketPrices = definitions.map((crop, slot) => {
    const price = crop[34] | crop[35] << 8;
    scenario.cropDefinitions[slot].price = price;
    scenario.seedDefinitions[slot].price = Math.max(5, (crop[38] | crop[39] << 8) >>> 2);
    return price;
  });
  const finances = readFinancialState(bytes, prior.finances);
  // Native modal callbacks reference the replaced world and must not resume on it.
  finances.defaultDecision = null;
  const state: SimulationState = { ...prior, scenario, finances, crops: definitions, cropMarketPrices, market,
    originalPause: { depth: bytes[0x21719], speedChecks: [...prior.originalPause.speedChecks] },
    newFarm: null, retainedSetup: prior.newFarm ?? prior.retainedSetup,
    weather: { ...prior.weather, precipitationDays: scenario.farm.precipitationDays },
    traffic: { ...prior.traffic, delay: new Binary(bytes).u16(0x2171e) },
    dayTicks: transferCalendarPhase(prior.scenario.farm.animationTicks, prior.dayTicks, scenario.farm.animationTicks),
    paused: true, elapsed: 0, pendingTown: null, aircraftFlight: null };
  return state;
}
