import {terrainTile,worldIndex,type Scenario} from '../formats/scenario';
export const TOWN_WINDOW_BASES=[320,323,326,329,332,335,338,352,355] as const;
export type TownWindow='market'|'sell'|'bank'|'buy'|'expert';
const windows:readonly (TownWindow|null)[]=['market','sell','bank','buy','expert',null,null,null,null];
/** Source9536 recognizes all nine3×3 images;2590a opens only the first five.
 * Flags/ownership/region are not additional gates in this image-based route. */
export function townWindowAt(world:Scenario,x:number,y:number):TownWindow|null {
  if(![x,y].every(n=>Number.isInteger(n)&&n>=0&&n<96))return null;
  const tile=terrainTile(world.cells[worldIndex(x,y)]);
  const index=TOWN_WINDOW_BASES.findIndex(base=>[0,40,80].some(row=>tile>=base+row&&tile<=base+row+2));
  return index<0?null:windows[index];
}
