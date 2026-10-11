export const EDIT_TOOLS = ['Move object', 'View object', 'Paved road', 'Dirt road', 'Fence', 'Gate', 'Ditch', 'Valve', 'Hay', 'Trough', 'Trees', 'Bulldoze'] as const;
export type EditTool = typeof EDIT_TOOLS[number];
export function EditPalette({ artwork, onTool, onField, onSpray, onHelp, disabled }: {
  artwork: HTMLImageElement; onTool: (tool: EditTool) => void; onField: () => void; onSpray: () => void; onHelp: () => void; disabled: boolean;
}) {
  return <div className="edit-palette" role="toolbar" aria-label="Edit tools">
    <img src={artwork.src} width="48" height="208" alt="" draggable={false} />
    {EDIT_TOOLS.map((tool, i) => <button key={tool} title={tool} aria-label={tool} disabled={disabled}
      style={{ left: (i % 2) * 24, top: Math.floor(i / 2) * 24, width: 24, height: 24 }} onClick={() => onTool(tool)} />)}
    <button className="edit-caption" style={{ top: 144, height: 24 }} disabled={disabled} onClick={onField}>Plant</button>
    <button className="edit-caption" style={{ top: 168, height: 22 }} disabled={disabled} onClick={onSpray}>Spray</button>
    <button className="edit-caption" style={{ top: 190, height: 18 }} data-edit-help-trigger aria-label="Edit tools and help" onClick={onHelp}>?</button>
  </div>;
}
