import { EQUIPMENT_FLAGS as F, type EquipmentDefinition, type EquipmentRecord } from '../formats/equipment';
import { terrainTile, worldIndex, type WorldCell } from '../formats/scenario';

const signedByte = (value: number) => value << 24 >> 24;
const directions = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const;

/** 0xfb54: signed byte differences and a signed word result. Map coordinates cannot overflow. */
export function equipmentDistance(x: number, y: number, otherX: number, otherY: number): number {
  const dx = signedByte(Math.abs(signedByte(x) - signedByte(otherX)));
  const dy = signedByte(Math.abs(signedByte(y) - signedByte(otherY)));
  return (dx * dx + dy * dy) << 16 >> 16;
}

/** Selection portion of 0x115d6. Reservation, building withdrawal and rental are caller operations. */
export function findAvailableEquipment(records: readonly EquipmentRecord[], type: number, x: number, y: number): EquipmentRecord | undefined {
  let best: EquipmentRecord | undefined, distance = 1_000_000;
  for (const e of records) {
    if (!e.slot || !e.active || (e.condition & 0xc0) === 0xc0 || e.type !== type ||
      (e.flags & (F.reserved | F.fieldWork | F.rented)) || e.attachment) continue;
    const candidate = equipmentDistance(x, y, e.x, e.y);
    if (candidate < distance) { best = e; distance = candidate; }
  }
  return best;
}

/** 0xf9e4–0xfa65. Sets an order; actual movement is a separate update. */
export function setEquipmentDestination(e: EquipmentRecord, x: number, y: number, tick: number): void {
  if (![x, y, tick].every(Number.isInteger)) throw new Error('Invalid equipment destination or tick');
  e.bytes[7] = Math.max(0, Math.min(95, x)); e.bytes[8] = Math.max(0, Math.min(95, y));
  for (const offset of [9, 11, 13]) { e.bytes[offset] = e.x; e.bytes[offset + 1] = e.y; }
  e.bytes[55] = 0; e.timestamp = tick;
  e.flags |= F.moving; e.bytes[4] = 1;
}

/** 0xfba2: prefer the larger displacement; a diagonal tie chooses the Y axis. */
export function equipmentTargetDirection(e: EquipmentRecord): number {
  const dx = signedByte(e.x - e.targetX), dy = signedByte(e.y - e.targetY);
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 6) : (dy < 0 ? 4 : 0);
}

/** 0xfe6e–0xffe6. The original uses terrain categories and three-position history,
 * not a shortest-path distance score. See SF-009 for near-target bypass and edge reads. */
export function scoreEquipmentStep(e: EquipmentRecord, cells: readonly WorldCell[], dx: number, dy: number): number {
  if (!e.active) return 0;
  const x = signedByte(e.x + dx), y = signedByte(e.y + dy);
  // Native boundary fix: never index adjacent DS data as terrain or leave the map.
  if (x < 0 || y < 0 || x >= 96 || y >= 96) return 20000;
  if (equipmentDistance(x, y, e.targetX, e.targetY) <= 4) return 0;
  const tile = terrainTile(cells[worldIndex(x, y)]);
  // Initialized DS tile bases/counts: 15+16, 150..161+11, 188+4. Upper limits are inclusive here.
  const grass = tile >= 15 && tile <= 31;
  if (!grass && !(tile >= 150 && tile <= 172) && !(tile >= 188 && tile <= 192)) return 20000;
  let score = grass ? 85 : 0;
  if ([9, 11, 13].some(offset => e.bytes[offset] === x && e.bytes[offset + 1] === y)) score += 200;
  return score;
}

export interface EquipmentStep { x: number; y: number; direction: number; teleported: boolean }

/** Pure result of 0xfc14. Encodes its direct-position fallback without mutating a record.
 * Applying this result still requires attachment, map occupancy, wear and arrival dispatch. */
export function planEquipmentStep(e: EquipmentRecord, cells: readonly WorldCell[]): EquipmentStep {
  if (!e.active) return { x: e.x, y: e.y, direction: e.direction, teleported: false };
  const forward = equipmentTargetDirection(e);
  // Source evaluates forward, then negative perpendicular, then positive perpendicular.
  const candidates = forward === 0 || forward === 4 ? [forward, 6, 2] : [forward, 0, 4];
  const scores = candidates.map((direction, i) => {
    const [dx, dy] = directions[direction];
    return scoreEquipmentStep(e, cells, dx, dy) + (i ? 5 : 0);
  });
  if (scores.every(score => score > 0x75a)) return { x: e.targetX, y: e.targetY, direction: e.direction, teleported: true };
  let best = 0;
  for (let i = 1; i < 3; i++) if (scores[i] < scores[best]) best = i;
  const direction = candidates[best], [dx, dy] = directions[direction];
  return { x: e.x + dx, y: e.y + dy, direction, teleported: false };
}

function copyAssignment(parent: EquipmentRecord, child: EquipmentRecord): void {
  for (const offset of [15, 48, 49]) child.bytes[offset] = parent.bytes[offset];
}

function positionAttachment(parent: EquipmentRecord, child: EquipmentRecord, parentHeight: number, width: number, height: number): void {
  const halfWidth = signedByte(width) >> 1;
  switch (parent.direction) {
    case 0: child.bytes[5] = parent.x - halfWidth; child.bytes[6] = parent.y + parentHeight; break;
    case 2: child.bytes[5] = parent.x - height; child.bytes[6] = parent.y - halfWidth; break;
    case 4: child.bytes[5] = parent.x - halfWidth; child.bytes[6] = parent.y - height; break;
    case 6: child.bytes[5] = parent.x + parentHeight; child.bytes[6] = parent.y - halfWidth; break;
  }
  copyAssignment(parent, child);
}

/** 0x10f74–0x1113d. Call after erasing the machines' previous map occupancy. */
export function attachEquipment(parent: EquipmentRecord, child: EquipmentRecord, definitions: readonly EquipmentDefinition[]): void {
  if (!parent.active || !child.active || parent.slot === child.slot || parent.attachment || child.parent || child.attachment) throw new Error('Invalid equipment attachment');
  const def = definitions[child.type];
  const oldWidth = signedByte(parent.bytes[53]), oldHeight = signedByte(parent.bytes[54]);
  const width = signedByte(def.width), height = signedByte(def.height);
  const shiftX = width > oldWidth ? width - oldWidth - 1 : 0;
  const shiftY = height > oldHeight ? height - oldHeight - 1 : 0;
  parent.attachment = child.slot; child.parent = parent.slot;
  if (width > oldWidth) parent.bytes[53] = width;
  if (height > oldHeight) parent.bytes[54] = height;
  if (parent.direction === 0 || parent.direction === 4) {
    parent.bytes[5] += shiftX; parent.bytes[6] += shiftY;
  } else if (parent.direction === 2 || parent.direction === 6) {
    parent.bytes[5] += shiftY; parent.bytes[6] += shiftX;
  }
  positionAttachment(parent, child, oldHeight, width, height);
}

/** 0x1113e–0x1129e. Reposition the whole chain after moving or turning its head. */
export function positionEquipmentAttachments(head: EquipmentRecord, records: readonly EquipmentRecord[], definitions: readonly EquipmentDefinition[]): void {
  const chain = [head], visited = new Set([head.slot]);
  while (chain.at(-1)!.attachment) {
    const child = records[chain.at(-1)!.attachment];
    if (!child?.active || visited.has(child.slot)) throw new Error('Invalid equipment attachment chain');
    visited.add(child.slot); chain.push(child);
  }
  for (let i = 1; i < chain.length; i++) {
    const parent = chain[i - 1], child = chain[i], def = definitions[child.type];
    positionAttachment(parent, child, signedByte(definitions[parent.type].height), signedByte(def.width), signedByte(def.height));
  }
}
