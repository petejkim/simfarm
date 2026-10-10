export const EDIT_TOOLS = ['Move object', 'View object', 'Paved road', 'Dirt road', 'Fence', 'Gate', 'Ditch', 'Valve', 'Hay', 'Trough', 'Trees', 'Bulldoze'] as const;
export type EditTool = typeof EDIT_TOOLS[number];
export function EditPalette({ artwork, onTool, onField, onSpray, onHelp, disabled }: {
  artwork: HTMLImageElement; onTool: (tool: EditTool) => void; onField: () => void; onSpray: () => void; onHelp: () => void; disabled: boolean;
}) {
  return <div className="edit-palette" role="toolbar" aria-label="Edit tools">
    <img src={artwork.src} width="96" height="416" alt="" draggable={false} />
    {EDIT_TOOLS.map((tool, i) => <button key={tool} title={tool} aria-label={tool} disabled={disabled || tool === 'Trees'}
      style={{ left: (i % 2) * 48, top: Math.floor(i / 2) * 48, width: 48, height: 48 }} onClick={() => onTool(tool)} />)}
    <button className="edit-caption" style={{ top: 288, height: 48 }} disabled={disabled} onClick={onField}>Plant</button>
    <button className="edit-caption" style={{ top: 336, height: 44 }} disabled={disabled} onClick={onSpray}>Spray</button>
    <button className="edit-caption" style={{ top: 380, height: 36 }} aria-label="Edit tools and help" onClick={onHelp}>?</button>
  </div>;
}
