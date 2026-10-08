import { disasterFixture } from './disasters';
import { purchaseBuilding } from '../../src/simulation/building-placement';
import { purchaseEquipment } from '../../src/simulation/equipment-purchase';
import { worldIndex } from '../../src/formats/scenario';

/** Source corn field and occupied storage beside separate one-tile shores.
 * Both are reached in the first farm day, at distinct flood scan positions. */
export function waterDisasterFixture() {
  const f = disasterFixture(), w = f.state.scenario;
  if (!purchaseBuilding(w, f.state.finances, 67, 40, 40, 0).ok || !purchaseEquipment(w, f.state.finances, 0, 40, 40, 0).ok)
    throw new Error('Water disaster fixture purchase failed');
  for (const [x, y] of [[20, 19], [40, 39]]) w.cells[worldIndex(x, y)].terrain = 0x3000 | 55;
  w.climate.precipitation.fill(0); f.state.weather.forecast.fill(0); f.state.weather.nextForecast.fill(0);
  return f;
}
