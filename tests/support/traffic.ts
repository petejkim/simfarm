import { shopFixture } from './livestock';
import { coldTrafficDefaults, createTrafficState, snapshotTraffic } from '../../src/formats/traffic';
import { allocateTraffic } from '../../src/simulation/starting-traffic';
import { FarmRandom } from '../../src/simulation/random';
import { worldIndex } from '../../src/formats/scenario';

/** One original vehicle on an isolated paved road, with one tick until its update. */
export function trafficFixture(collision = false) {
  const f = shopFixture(), s = f.state, w = s.scenario;
  s.disasters.enabled = false; w.climate.wind.fill(5);
  w.farm.animationTicks = w.farm.timerTicks = s.equipmentAnimationTick = 15; s.dayTicks = 15;
  s.animalFrame.lastCentreTick = s.animalFrame.lastMoveTick = 16;
  // Centre clock equal to the upcoming tick avoids unrelated herd RNG.
  for (let x = 8; x < 80; x++) { const c = w.cells[worldIndex(x, 20)]; c.terrain = 150; c.overlay = 0; }
  const t = createTrafficState(coldTrafficDefaults()); allocateTraffic(t, 20, 20, 2, new FarmRandom(s.random));
  t.records[0].bytes[1] = 173; t.records[0].bytes[0] |= 0x80;
  s.traffic = snapshotTraffic(t);
  if (collision) {
    const a = w.animals[1]; a.flags = 0x22; a.bytes[0] = 21; a.bytes[1] = 20;
    a.bytes[13] = a.bytes[14] = 0;
    s.finances.accounts.assets.animalDefinitions[1].count = 1;
    const target = w.cells[worldIndex(21, 20)]; target.terrain |= 0x800; target.overlay = 980;
  }
  return f;
}
