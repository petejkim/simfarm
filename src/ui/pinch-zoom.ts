/** Terrain gesture zoom range (native, user request); the Settings presets are 50%, 100% and 200%. */
export const MIN_ZOOM = 0.5, MAX_ZOOM = 4;
export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
/** The zoom a pinch leaves, kept to whole percent (high-density phone screens keep any zoom sharp; user request). */
export const settledZoom = (zoom: number) => clampZoom(Math.round(zoom * 100) / 100);
/** Ctrl+wheel and trackpad pinch use pixel, line (16px), or viewport-page deltas. Negative deltas zoom in. */
export function wheelZoomRatio(deltaY: number, deltaMode: number, pageHeight: number): number {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1);
  return Math.exp(-pixels * 0.003);
}
/** Zoom and scroll that keep the content point under `anchor` (viewport-relative CSS pixels) beneath it. */
export function pinchView(start: { zoom: number; contentX: number; contentY: number }, distanceRatio: number, anchor: { x: number; y: number }) {
  const zoom = clampZoom(start.zoom * distanceRatio);
  return { zoom, scrollLeft: start.contentX * zoom - anchor.x, scrollTop: start.contentY * zoom - anchor.y };
}
