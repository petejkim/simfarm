import type { CSSProperties, ReactNode } from 'react';
import { EDIT_PALETTE_CELL } from '../formats/edit-palette';

export const EDIT_TOOLS = ['Move object', 'View object', 'Paved road', 'Dirt road', 'Fence', 'Gate', 'Ditch', 'Valve', 'Hay', 'Trough', 'Trees', 'Bulldoze'] as const;
export type EditTool = typeof EDIT_TOOLS[number];
/** Palette action shown depressed: a tool or the Plant/Spray field action. */
export type EditPaletteAction = EditTool | 'Plant' | 'Spray';

/** Source editeasy.lzs palette, laid out with flexbox: twelve 24×24 tool cells in two columns,
 * then full-width Plant (22) and Spray (22) cells. The source ? help cell and foot are omitted (user request). Black frames are each cell's
 * background on its top/left edges; bevels are CSS borders; tool faces come from the bitmap sprite. */
export function EditPalette({ artwork, active, onTool, onField, onSpray, disabled }: {
  artwork: HTMLImageElement; active: EditPaletteAction | null; onTool: (tool: EditTool) => void; onField: () => void; onSpray: () => void; disabled: boolean;
}) {
  return <div className="edit-palette" role="toolbar" aria-label="Edit tools" style={{ '--edit-palette-sprite': `url("${artwork.src}")` } as CSSProperties}>
    {EDIT_TOOLS.map((tool, index) => <EditToolButton key={tool} tool={tool} index={index} pressed={active === tool} disabled={disabled} onTool={onTool} />)}
    <EditCaptionButton className="edit-plant" pressed={active === 'Plant'} disabled={disabled} onClick={onField}>Plant</EditCaptionButton>
    <EditCaptionButton className="edit-spray" pressed={active === 'Spray'} disabled={disabled} onClick={onSpray}>Spray</EditCaptionButton>
  </div>;
}

/** One 24×24 tool cell; its 19×19 face is sprite (24·column+3, 24·row+3). */
export function EditToolButton({ tool, index, pressed, disabled, onTool }: { tool: EditTool; index: number; pressed: boolean; disabled: boolean; onTool: (tool: EditTool) => void }) {
  const { size, inset } = EDIT_PALETTE_CELL;
  return <button className={`edit-tool${pressed ? ' is-pressed' : ''}`} aria-pressed={pressed} title={tool} aria-label={tool} disabled={disabled} onClick={() => onTool(tool)}>
    <span className="edit-palette-face" style={{ backgroundPosition: `${-(index % 2 * size + inset)}px ${-(Math.floor(index / 2) * size + inset)}px` }} />
  </button>;
}

/** Full-width captioned cell; the source face is plain grey under the (HTML) caption. */
export function EditCaptionButton({ className, pressed, disabled, onClick, children }: {
  className: string; pressed: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return <button className={`edit-caption ${className}${pressed ? ' is-pressed' : ''}`} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
    <span className="edit-palette-face">{children}</span>
  </button>;
}
