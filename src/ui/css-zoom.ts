/** Effective CSS zoom of an element (`#app` is zoomed on touch screens). Under standardized CSS zoom, rects and pointer
 * client coordinates are in zoomed screen px, while offset/client sizes, scroll positions and style lengths are
 * unzoomed layout px; divide screen distances by this to get layout distances. Browsers without
 * `currentCSSZoom` predate standardized zoom and are treated as unzoomed. */
export function cssZoom(element: Element): number {
  return (element as Element & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
}
