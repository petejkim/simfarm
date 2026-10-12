import type { CSSProperties, ReactNode } from 'react';
import { EDIT_PALETTE_CELL } from '../formats/edit-palette';

export const EDIT_TOOLS = ['Move object', 'View object', 'Paved road', 'Dirt road', 'Fence', 'Gate', 'Ditch', 'Valve', 'Hay', 'Trough', 'Trees', 'Bulldoze'] as const;
export type EditTool = typeof EDIT_TOOLS[number];

/** Source editeasy.lzs palette (48×208), laid out with flexbox: twelve 24×24 tool cells in two columns,
 * then full-width Plant (22), Spray (22) and ? (16) cells and a 4px foot. Black frames are each cell's
 * background on its top/left edges; bevels are CSS borders; tool faces come from the bitmap sprite. */
export function EditPalette({ artwork, onTool, onField, onSpray, onHelp, disabled }: {
  artwork: HTMLImageElement; onTool: (tool: EditTool) => void; onField: () => void; onSpray: () => void; onHelp: () => void; disabled: boolean;
}) {
  return <div className="edit-palette" role="toolbar" aria-label="Edit tools" style={{ '--edit-palette-sprite': `url("${artwork.src}")` } as CSSProperties}>
    {EDIT_TOOLS.map((tool, index) => <EditToolButton key={tool} tool={tool} index={index} disabled={disabled} onTool={onTool} />)}
    <EditCaptionButton className="edit-plant" disabled={disabled} onClick={onField}>Plant</EditCaptionButton>
    <EditCaptionButton className="edit-spray" disabled={disabled} onClick={onSpray}>Spray</EditCaptionButton>
    <EditCaptionButton className="edit-help-button" label="Edit tools and help" helpTrigger onClick={onHelp}>?</EditCaptionButton>
    <span className="edit-palette-foot" aria-hidden="true" />
  </div>;
}

/** One 24×24 tool cell; its 19×19 face is sprite (24·column+3, 24·row+3). */
export function EditToolButton({ tool, index, disabled, onTool }: { tool: EditTool; index: number; disabled: boolean; onTool: (tool: EditTool) => void }) {
  const { size, inset } = EDIT_PALETTE_CELL;
  return <button className="edit-tool" title={tool} aria-label={tool} disabled={disabled} onClick={() => onTool(tool)}>
    <span className="edit-palette-face" style={{ backgroundPosition: `${-(index % 2 * size + inset)}px ${-(Math.floor(index / 2) * size + inset)}px` }} />
  </button>;
}

/** Full-width captioned cell; the source face is plain grey under the (HTML) caption. */
export function EditCaptionButton({ className, label, helpTrigger, disabled, onClick, children }: {
  className: string; label?: string; helpTrigger?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return <button className={`edit-caption ${className}`} aria-label={label} data-edit-help-trigger={helpTrigger || undefined} disabled={disabled} onClick={onClick}>
    <span className="edit-palette-face">{children}</span>
  </button>;
}
