import type { FinancialState } from '../formats/finance';
import type { FieldMapTool } from '../formats/field-tool-menu';
import type { Scenario } from '../formats/scenario';
import { goodsPrice } from '../simulation/goods-price';
import { EDIT_TOOL_STATUSES, SPRAY_STATUSES } from '../simulation/edit-status';
import type { ConstructionTool } from './useConstruction';

/** Item records the palette handlers select into [fa3a] (0x2183a..0x21ec2); +2 is the priced type. */
export const PALETTE_TOOL_TYPES: Record<ConstructionTool, number> = {
  'road-161': 288, ditch: 289, trees: 291, 'road-150': 293, fence: 297, trough: 299, hay: 300, gate: 303, valve: 304,
};
/** Plant selection 0x38374 selects DS74c0, type 302 (new field); Spray items 0x3840b..0x384e7 select chemicals 220–223. */
const FIELD_TOOL_TYPES: Record<FieldMapTool['kind'], number> = { plant: 302, fertilizer: 220, pesticide: 221, herbicide: 222, fungicide: 223 };
/** Edit title paint 0x20388 pushes a fixed 25 for Bulldoze (mode 15). */
export const BULLDOZE_TITLE_COST = 25;

export type CostedTool = { kind: 'construction'; tool: ConstructionTool } | { kind: 'bulldoze' } | { kind: 'field'; tool: FieldMapTool };

/** Message each costed tool posts when selected (palette 214f0, Plant 17, Spray 383e8..384c4). */
const CONSTRUCTION_STATUSES: Record<ConstructionTool, number> = {
  'road-150': EDIT_TOOL_STATUSES['Paved road'], 'road-161': EDIT_TOOL_STATUSES['Dirt road'], fence: EDIT_TOOL_STATUSES.Fence,
  gate: EDIT_TOOL_STATUSES.Gate, ditch: EDIT_TOOL_STATUSES.Ditch, valve: EDIT_TOOL_STATUSES.Valve, hay: EDIT_TOOL_STATUSES.Hay,
  trough: EDIT_TOOL_STATUSES.Trough, trees: EDIT_TOOL_STATUSES.Trees,
};
function selectionStatus(tool: CostedTool): number {
  return tool.kind === 'bulldoze' ? EDIT_TOOL_STATUSES.Bulldoze : tool.kind === 'construction' ? CONSTRUCTION_STATUSES[tool.tool]
    : tool.tool.kind === 'plant' ? 17 : SPRAY_STATUSES[tool.tool.kind];
}

/** The cost the original Edit title shows for the selected tool (paint 0x20352..0x203f1). Natively it follows the
 * tool's own selection message only, so later results such as "Field is busy." carry no cost; null otherwise. */
export function toolCost(world: Pick<Scenario, 'chemicalDefinitions'>, finances: Pick<FinancialState, 'accounts'>, tool: CostedTool | null,
  currentStatus: number | undefined): number | null {
  if (!tool || currentStatus !== selectionStatus(tool)) return null;
  const price = tool.kind === 'bulldoze' ? BULLDOZE_TITLE_COST
    : goodsPrice(world, finances, tool.kind === 'construction' ? PALETTE_TOOL_TYPES[tool.tool] : FIELD_TOOL_TYPES[tool.tool.kind]);
  return price << 16 >> 16; // itoa (0x84:266e) formats the word as signed decimal
}

/** "$1,200"; negative words keep itoa's sign. */
export function formatToolCost(cost: number): string {
  return `${cost < 0 ? '-' : ''}$${Math.abs(cost).toLocaleString('en-US')}`;
}
