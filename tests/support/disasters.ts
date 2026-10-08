import { shopFixture } from './livestock';
import { worldIndex } from '../../src/formats/scenario';

/** A growing source corn field with no unrelated work, in calm January. */
export function disasterFixture() {
  const f = shopFixture(), w = f.state.scenario, field = w.fields[1];
  w.farm.dayDelayTicks = 64; w.climate.wind.fill(5);
  field.bytes[7] = 1; field.bytes[2] = 4; field.bytes[3] = 0; field.bytes[6] = 4;
  field.bytes[10] = field.bytes[11] = 20; field.bytes[12] = field.bytes[13] = 8; field.bytes[14] = 0;
  field.bytes[29] = 200; field.bytes[18] = field.bytes[19] = 0;
  field.bytes.fill(0, 42, 48); field.bytes.fill(0, 64, 68);
  for (let x = 20; x < 28; x++) for (let y = 20; y < 28; y++) w.cells[worldIndex(x, y)].terrain = 688;
  return f;
}
