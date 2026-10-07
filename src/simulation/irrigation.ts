import { MAX_IRRIGATION_FLOW, validateIrrigation, type IrrigationState, type IrrigationPacket } from '../formats/irrigation';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding } from './building-storage';

const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const clamp = (n: number) => Math.max(0, Math.min(95, n));
type IrrigationWorld = Pick<Scenario, 'cells' | 'buildings' | 'buildingDefinitions'>;

/** 0x17560: phase visit bit and original dry/wet ditch image conversion. */
function enqueue(world: IrrigationWorld, state: IrrigationState, packet: IrrigationPacket): void {
  if (state.flow.length >= MAX_IRRIGATION_FLOW) throw new Error('Irrigation flow exceeds world capacity');
  // Original marker clamps, but queues the unbounded bytes (SF-091).
  const p = { ...packet, x: clamp(packet.x), y: clamp(packet.y) }, cell = world.cells[worldIndex(p.x, p.y)];
  const tile = terrainTile(cell);
  if (state.phase) {
    cell.terrain |= 0x8000;
    if (tile >= 87 && tile < 98) cell.terrain += 11;
  } else {
    cell.terrain &= 0x7fff;
    if (tile >= 98 && tile < 109) cell.terrain -= 11;
  }
  state.flow.push(p);
}

/** 0x17636. Bits N,E,S,W; wet traversal excludes closed valve images123/125.
 * Source reads neighbors before clamping; native off-map neighbors do not exist. */
function neighbors(world: IrrigationWorld, state: IrrigationState, x: number, y: number): number[] {
  const found: number[] = [];
  for (let d = 0; d < 4; d++) {
    const nx = x + directions[d][0], ny = y + directions[d][1];
    if (nx < 0 || ny < 0 || nx >= 96 || ny >= 96) continue;
    const cell = world.cells[worldIndex(nx, ny)], tile = terrainTile(cell);
    const allowed = (tile >= 87 && tile <= 120) || [122, 124, 172, 173, 120, 121].includes(tile)
      || (!state.phase && (tile === 123 || tile === 125));
    if (allowed && Boolean(cell.terrain & 0x8000) !== Boolean(state.phase)) found.push(d);
  }
  return found;
}

/** 0x17b3e: process the original four-packet budget, including its delayed
 * empty result on the final attempt. SF-086 merge arithmetic is retained.
 * SF-090: consume zero-strength packets instead of re-enqueuing them forever. */
function processFlow(world: IrrigationWorld, state: IrrigationState): boolean {
  for (let remaining = 3; remaining >= 0; remaining--) {
    const packet = state.flow.shift();
    if (!packet) return remaining > 0;
    if (!packet.strength) continue;
    const next = neighbors(world, state, packet.x, packet.y);
    if (next.length > 1) {
      const strength = Math.floor(packet.strength / next.length);
      for (const d of next) enqueue(world, state, { x: packet.x + directions[d][0], y: packet.y + directions[d][1], strength });
    } else if (next.length === 1) {
      const d = next[0], x = packet.x + directions[d][0], y = packet.y + directions[d][1];
      const tile = terrainTile(world.cells[worldIndex(x, y)]);
      const strength = tile === 120 || tile === 121 ? 64 : packet.strength - 1; // table08d8=120, count09db=2.
      if (strength) enqueue(world, state, { x, y, strength });
    } else {
      const other = state.flow.shift();
      if (other) enqueue(world, state, { ...other, strength: (Math.min(packet.strength + other.strength, 255) + other.strength) & 255 });
    }
  }
  return false;
}

/** 0x174c4: only a type70 source beside first-plane water bit0x2000 pumps.
 * The original clamped 3×3 probe includes the source tile itself. */
function besideWater(world: IrrigationWorld, x: number, y: number): boolean {
  if (findBuilding(world, x, y)?.type !== 70) return false;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (world.cells[worldIndex(clamp(x + dx), clamp(y + dy))].terrain & 0x2000) return true;
  }
  return false;
}

/** Driver 0x17310..0x174c2, called at0xbd42 after clearing and an equipment pass.
 * The callback refreshes field water; true additionally updates field status.
 * Cold/warm initialization and native pause differences are documented separately. */
export function updateIrrigation(world: IrrigationWorld, state: IrrigationState, tick: number, wind: number,
  refreshFields: (updateStatus: boolean) => void): boolean {
  validateIrrigation(state);
  if (!Number.isInteger(tick) || tick < 0 || tick > 65535 || !Number.isInteger(wind) || wind < -128 || wind > 127)
    throw new Error('Invalid irrigation clock or wind');
  if (((tick - state.lastTick) & 65535) < state.delay) return false;
  if (state.active) state.delay = 3;
  else {
    if (!state.phase) for (const cell of world.cells) {
      const tile = terrainTile(cell);
      if (tile >= 98 && tile < 109) cell.terrain -= 11;
    }
    state.phase = state.phase ? 0 : 1;
    if (!state.phase) refreshFields(true); // 0x173c9 ->0x1c81c: water then status, before dry flow.
    for (let i = 0; i < state.sourceCount; i++) {
      const [x, y, strength] = state.sources.subarray(i * 3, i * 3 + 3);
      if (besideWater(world, x, y)) enqueue(world, state, { x, y, strength });
      else if (strength === 48 && (wind >= 9 || !state.phase)) enqueue(world, state, { x, y: y + 1, strength });
    }
    if (state.flow.length) state.active = true;
  }
  const complete = processFlow(world, state), wetCompleted = complete && state.phase === 1;
  if (wetCompleted) refreshFields(false); // 0x1749e ->0x18cce: water only.
  if (complete) { state.active = false; state.flow.length = 0; }
  state.lastTick = tick;
  return wetCompleted;
}
