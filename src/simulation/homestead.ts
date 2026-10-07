import { validateHomestead, type HomesteadState } from '../formats/homestead';
import { worldIndex, type WorldCell } from '../formats/scenario';

export interface HomesteadChange {
  previousRank: number;
  rank: number;
  notice: 'improved' | 'declined' | null;
  sound: 'cheers' | 'boos' | null;
  music: 'cowman' | null;
}
/** Unsigned cash comparisons 0xce18..0xcf19. SF-079: >=999999 skips
 * the call entirely; it does not select or clamp to the highest rank. */
export function homesteadRank(cash: number): number | null {
  if (!Number.isInteger(cash) || cash < 0 || cash > 0xffffffff) throw new Error('Invalid homestead cash');
  const rank = [60000, 200000, 400000, 550000, 750000, 999999].findIndex(limit => cash < limit);
  return rank < 0 ? null : rank;
}

/** 0x1f2f4..0x1f4d0. Full terrain-word writes; overlay/attribute and all
 * cells outside the nine-cell footprint remain untouched. */
export function updateHomestead(cells: WorldCell[], state: HomesteadState, cash: number): HomesteadChange | null {
  validateHomestead(state);
  const rank = homesteadRank(cash);
  if (rank === null || rank === state.rank) return null;
  if (cells.length !== 96 * 96) throw new Error('Invalid homestead map');
  const offsets = [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [1, 2], [2, 2], [1, 3], [2, 3]];
  const targets = offsets.map(([x, y]) => cells[worldIndex(state.x + x, state.y + y)]);
  if (targets.some(cell => !cell)) throw new Error('Invalid homestead map');
  const base = rank === 0 ? 252 : rank === 1 ? 272 : 274;
  const decorations = rank < 3 ? 0 : rank === 3 ? 1 : rank === 4 ? 3 : 5;
  const tiles = [...Array.from({ length: 5 }, (_, i) => i < decorations ? 520 + i : 79), base, base + 1, base + 40, base + 41];
  const previousRank = state.rank;
  targets.forEach((cell, i) => { cell.terrain = tiles[i]; });
  state.rank = rank;
  const notice = previousRank === 255 ? null : rank < previousRank ? 'declined' : 'improved';
  return { previousRank, rank, notice, sound: notice === null ? null : notice === 'declined' ? 'boos' : 'cheers',
    music: notice === 'improved' ? 'cowman' : null };
}
