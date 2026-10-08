import { shopFixture } from './livestock';
import { purchaseSupply } from '../../src/simulation/livestock-purchase';
import { worldIndex } from '../../src/formats/scenario';

/** Original records/definitions with purchased supplies and explicit map
 * networks. Chemical1 retains its source unknown bytes at a visible location. */
export function bulldozeFixture() {
  const f = shopFixture(), w = f.state.scenario;
  for (const c of w.chemicals) c.bytes[2] &= ~32;
  for (const d of w.chemicalDefinitions) d.count = 0;
  for (const [type, x] of [[299, 10], [300, 12]]) if (!purchaseSupply(w, f.state.finances, type, x, 10, 0).ok) throw new Error('Invalid supply fixture');
  const c = w.chemicals[1]; new DataView(c.bytes.buffer, c.bytes.byteOffset).setUint16(0, 220, true);
  c.bytes[2] = 32; c.bytes[5] = 14; c.bytes[6] = 10; w.chemicalDefinitions[0].count = 1;
  w.cells[worldIndex(14, 10)].terrain = 0x800f; w.cells[worldIndex(14, 10)].overlay = 0x800 | 915; // Source graphic74.
  for (const [x, y, tile] of [[20, 20, 177], [21, 20, 187], [22, 20, 178], [24, 20, 160], [25, 20, 160], [26, 20, 161],
    [28, 20, 97], [29, 20, 108], [30, 20, 87], [32, 20, 0x2000 | 172], [33, 20, 160], [34, 20, 161],
    [32, 21, 108], [32, 22, 87], [40, 40, 0x3000 | 535], [95, 95, 131], [50, 50, 535]]) w.cells[worldIndex(x, y)].terrain = tile;
  w.cells[worldIndex(50, 50)].overlay = 0x4000;
  return f;
}

export const bulldozeTargets = [[10, 10], [12, 10], [14, 10], [20, 20], [24, 20], [28, 20], [32, 20], [40, 40], [95, 95]] as const;
