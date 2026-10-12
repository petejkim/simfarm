import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';

/** Status bits (+54) and badges for the column-3 conditions written by field-status.ts (0x19002..0x192e1),
 * in the order they are written: toxicity first, then the cycled weed, pest and fungus warnings. */
const COLUMN3 = [[4, 18], [0x20, 21], [1, 16], [0x10, 20]] as const;
const badgeOrigin = (badge: number) => 539 + badge * 4;

export interface FieldBadgeStack { x: number; y: number; badges: number[] }

/** Native presentation enhancement (user request): the original cycles weed/pest/fungus badges through
 * one 2×2 column-3 slot each status update, so several conditions flicker. Return a vertical stack of
 * every flagged condition instead, two cells apart, for fields whose column-3 slot currently shows one
 * of these badges. Simulation and saved terrain keep the original cycling write. Fields too short for
 * the stack keep the original display. */
export function fieldBadgeStacks(scenario: Pick<Scenario, 'fields' | 'cells'>): FieldBadgeStack[] {
  const stacks: FieldBadgeStack[] = [];
  for (const field of scenario.fields) {
    if (!field.active || field.width < 8) continue;
    const flags = field.bytes[54], badges = COLUMN3.filter(([bit]) => flags & bit).map(([, badge]) => badge);
    if (badges.length < 2 || badges.length * 2 > field.height) continue;
    const x = field.x + 6, y = field.y, shown = terrainTile(scenario.cells[worldIndex(x, y)]);
    if (!COLUMN3.some(([, badge]) => shown === badgeOrigin(badge))) continue;
    stacks.push({ x, y, badges });
  }
  return stacks;
}

/** Draw the stacks over the painted terrain; parts follow the original row-major 2×2 layout. */
export function drawFieldBadgeStacks(context: CanvasRenderingContext2D, stacks: readonly FieldBadgeStack[], tiles: CanvasImageSource): void {
  for (const { x, y, badges } of stacks) badges.forEach((badge, row) => {
    for (let part = 0; part < 4; part++) {
      const tile = badgeOrigin(badge) + part, cx = x + part % 2, cy = y + row * 2 + (part >> 1);
      context.drawImage(tiles, tile % 32 * 16, Math.floor(tile / 32) * 16, 16, 16, cx * 16, cy * 16, 16, 16);
    }
  });
}
