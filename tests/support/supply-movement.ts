import { shopFixture } from './livestock';
import { createInventoryItem } from '../../src/simulation/harvest-storage';
import { purchaseBuilding } from '../../src/simulation/building-placement';
import { purchaseSupply } from '../../src/simulation/livestock-purchase';
import { worldIndex } from '../../src/formats/scenario';

/** All five source-backed supply categories, plus crop/equipment storage. */
export function supplyMovementFixture() {
  const f = shopFixture(), w = f.state.scenario, a = f.state.finances;
  for (const c of w.chemicals) c.bytes[2] &= ~32;
  for (const d of [...w.seedDefinitions, ...w.harvestDefinitions, ...w.chemicalDefinitions]) d.count = 0;
  for (const [type, x, image] of [[192, 10, 832], [168, 12, 816]]) {
    createInventoryItem(w, type, 40, 9, x, 10);
    (type === 192 ? w.seedDefinitions[0] : w.harvestDefinitions[0]).count++;
    w.cells[worldIndex(x, 10)].terrain = image;
  }
  const c = w.chemicals[1]; new DataView(c.bytes.buffer, c.bytes.byteOffset).setUint16(0, 220, true);
  c.bytes[2] = 32; c.bytes[5] = 14; c.bytes[6] = 10; w.chemicalDefinitions[0].count = 1;
  w.cells[worldIndex(14, 10)].terrain |= 0x800; w.cells[worldIndex(14, 10)].overlay |= 915;
  purchaseSupply(w, a, 299, 16, 10, 0); purchaseSupply(w, a, 300, 18, 10, 0);
  purchaseBuilding(w, a, 65, 30, 30, 0); purchaseBuilding(w, a, 67, 40, 40, 0);
  return f;
}
