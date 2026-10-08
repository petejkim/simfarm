import type { CropDefinition } from '../formats/crop';
import { Binary } from '../formats/binary';
import { readScenario } from '../formats/scenario';
import { readFinancialState } from '../formats/finance';
import { readNativeSave, writeNativeSave } from '../formats/native-save';
import { loadMarketCropPrices } from './market';
import type { SimulationState } from './save-state';

/** In-game SSM transfer4543c..4644c and successful menu return43284.
 * Does not rerun chooser setup, weather generation or traffic allocation.
 * Native import dismisses UI/modal continuations and starts paused. */
export function transferOriginalFarm(previous: SimulationState, bytes: Uint8Array, crops: readonly CropDefinition[]): SimulationState {
  const prior = readNativeSave(writeNativeSave(previous, null)).state;
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
  const lastDayTick = (prior.scenario.farm.timerTicks - prior.dayTicks) & 65535;
  const state: SimulationState = { ...prior, scenario, finances, crops: definitions, cropMarketPrices, market,
    newFarm: null, retainedSetup: prior.newFarm ?? prior.retainedSetup,
    weather: { ...prior.weather, precipitationDays: scenario.farm.precipitationDays },
    traffic: { ...prior.traffic, delay: new Binary(bytes).u16(0x2171e) },
    dayTicks: (scenario.farm.timerTicks - lastDayTick) & 65535,
    paused: true, elapsed: 0, pendingTown: null, aircraftFlight: null };
  // Ordinary source dialog adds one pause level. A previously paused native
  // session models an outer level, so its return does not perform1->0 writes.
  if (!prior.paused) {
    scenario.farm.paceEquipment = true; //0x3f505 writes2 to DSa8a0.
    state.disasters.frameDelay = 4;
    scenario.farm.dayDelayTicks = 256; scenario.farm.speed = 1;
    state.traffic.delay = 16; scenario.irrigation.delay = 2;
  }
  return state;
}
