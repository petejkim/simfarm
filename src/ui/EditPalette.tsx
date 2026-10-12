import type { ReactNode } from 'react';
import { EDIT_PALETTE_CELL } from '../formats/edit-palette';
import { BevelButton } from './chrome/BevelButton';
import { spriteFace } from './chrome/Sprite';

export const EDIT_TOOLS = ['Move object', 'View object', 'Paved road', 'Dirt road', 'Fence', 'Gate', 'Ditch', 'Valve', 'Hay', 'Trough', 'Trees', 'Bulldoze'] as const;
export type EditTool = typeof EDIT_TOOLS[number];
/** Palette action shown depressed: a tool or the Plant/Spray field action. */
export type EditPaletteAction = EditTool | 'Plant' | 'Spray';

/** Source editeasy.lzs palette, laid out with flexbox: twelve 24×24 tool cells in two columns,
 * then full-width Plant (22) and Spray (22) cells. The source ? help cell and foot are omitted (user request).
 * Cells are shared BevelButtons framed on their top/left edges (neighbours supply the rest); tool faces are sprites. */
export function EditPalette({ artwork, active, onTool, onField, onSpray, disabled }: {
  artwork: HTMLImageElement; active: EditPaletteAction | null; onTool: (tool: EditTool) => void; onField: () => void; onSpray: () => void; disabled: boolean;
}) {
  return <div className="edit-palette" role="toolbar" aria-label="Edit tools">
    {EDIT_TOOLS.map((tool, index) => <EditToolButton key={tool} tool={tool} index={index} artwork={artwork.src} pressed={active === tool} disabled={disabled} onTool={onTool} />)}
    <EditCaptionButton className="edit-plant" pressed={active === 'Plant'} disabled={disabled} onClick={onField}>Plant</EditCaptionButton>
    <EditCaptionButton className="edit-spray" pressed={active === 'Spray'} disabled={disabled} onClick={onSpray}>Spray</EditCaptionButton>
  </div>;
}

/** One 24×24 tool cell; its 19×19 face is sprite (24·column+3, 24·row+3). */
export function EditToolButton({ tool, index, artwork, pressed, disabled, onTool }: { tool: EditTool; index: number; artwork: string; pressed: boolean; disabled: boolean; onTool: (tool: EditTool) => void }) {
  const { size, inset } = EDIT_PALETTE_CELL;
  return <BevelButton frame="top-left" className="edit-tool" faceClassName="edit-palette-face" pressed={pressed} title={tool} aria-label={tool} disabled={disabled}
    faceStyle={spriteFace(artwork, index % 2 * size + inset, Math.floor(index / 2) * size + inset)} onClick={() => onTool(tool)} />;
}

/** Full-width captioned cell; the source face is plain grey under the (HTML) caption. */
export function EditCaptionButton({ className, pressed, disabled, onClick, children }: {
  className: string; pressed: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return <BevelButton frame="top-left" className={`edit-caption ${className}`} faceClassName="edit-palette-face" pressed={pressed} disabled={disabled} onClick={onClick}>{children}</BevelButton>;
}
