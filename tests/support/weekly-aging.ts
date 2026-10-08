import { Binary } from '../../src/formats/binary';
import { drawEquipment } from '../../src/simulation/equipment-world';
import { shopFixture } from './livestock';

export function weeklyAgingFixture() {
  const f = shopFixture(), world = f.state.scenario;
  for (const c of world.chemicals) c.bytes[2] = 0;
  for (const d of world.equipmentDefinitions) d.ownedCount = 0;
  for (const d of world.chemicalDefinitions) d.count = 0;
  const e = world.equipment[1]; e.bytes.fill(0); e.flags = 0xa0; e.bytes[5] = e.bytes[6] = 10; e.bytes[17] = 253;
  new Binary(e.bytes).view.setUint16(18, 4, true); world.equipmentDefinitions[0].ownedCount = 1;
  drawEquipment(e, world);
  const c = world.chemicals[1]; c.bytes.fill(0); c.bytes[0] = 220; c.bytes[2] = 32; c.bytes[5] = c.bytes[6] = 20;
  c.bytes[9] = 255; new Binary(c.bytes).view.setUint16(10, 65535, true); world.chemicalDefinitions[0].count = 1;
  world.farm.calendar.day = 6;
  return { ...f, equipment: e, chemical: c };
}
