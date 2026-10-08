import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { WORLD_SIZE, worldIndex, type Scenario } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';
import { drawWorld, type MapPreview } from '../render/world-renderer';

export interface MapFocus { x: number; y: number }
interface Props {
  scenario: Scenario;
  tiles: CanvasImageSource;
  maskedTiles: CanvasImageSource;
  zoom: number;
  focus: MapFocus;
  field?: FieldRecord;
  selection: number | null;
  preview?: MapPreview;
  onSelect: (index: number) => void;
  onPointer: (pointer: MapFocus | null) => void;
}
const directions: Record<string, [number, number]> = {
  ArrowLeft: [-64, 0], ArrowRight: [64, 0], ArrowUp: [0, -64], ArrowDown: [0, 64],
};

export function FarmMap({ scenario, tiles, maskedTiles, zoom, focus, field, selection, preview, onSelect, onPointer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const updatePointer = useCallback(() => {
    const p = pointerRef.current, canvas = canvasRef.current, viewport = viewportRef.current;
    if (!p || !canvas || !viewport) { onPointer(null); return; }
    const bounds = viewport.getBoundingClientRect(), rect = canvas.getBoundingClientRect();
    const x = Math.floor((p.clientX - rect.left) / (16 * zoom)), y = Math.floor((p.clientY - rect.top) / (16 * zoom));
    onPointer(p.clientX >= bounds.left && p.clientX < bounds.left + viewport.clientWidth &&
      p.clientY >= bounds.top && p.clientY < bounds.top + viewport.clientHeight &&
      x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE ? { x, y } : null);
  }, [zoom, onPointer]);
  const clearPointer = useCallback(() => { pointerRef.current = null; onPointer(null); }, [onPointer]);
  useEffect(() => {
    const hide = () => { if (document.hidden) clearPointer(); };
    window.addEventListener('blur', clearPointer); window.addEventListener('resize', updatePointer);
    // Capture document/ancestor scrolling as well as the map's own scroll.
    window.addEventListener('scroll', updatePointer, true); document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', clearPointer); window.removeEventListener('resize', updatePointer);
      window.removeEventListener('scroll', updatePointer, true); document.removeEventListener('visibilitychange', hide);
    };
  }, [clearPointer, updatePointer]);
  useEffect(() => () => clearPointer(), [clearPointer]);
  const previousZoom = useRef(zoom), previousFocus = useRef<MapFocus | null>(null);
  useLayoutEffect(() => {
    drawWorld(canvasRef.current!.getContext('2d')!, scenario, tiles, maskedTiles, field, selection, preview);
  }, [scenario, tiles, maskedTiles, field, selection, preview]);
  useLayoutEffect(updatePointer); // Panel layout changes can move the map beneath a stationary cursor.
  useLayoutEffect(() => {
    const viewport = viewportRef.current!;
    if (focus !== previousFocus.current) {
      viewport.scrollTo(focus.x * 16 * zoom - viewport.clientWidth / 2, focus.y * 16 * zoom - viewport.clientHeight / 2);
    } else if (zoom !== previousZoom.current) {
      const ratio = zoom / previousZoom.current;
      viewport.scrollTo((viewport.scrollLeft + viewport.clientWidth / 2) * ratio - viewport.clientWidth / 2,
        (viewport.scrollTop + viewport.clientHeight / 2) * ratio - viewport.clientHeight / 2);
    }
    previousFocus.current = focus; previousZoom.current = zoom;
    updatePointer();
  }, [focus, zoom, updatePointer]);
  function selectTile(event: MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (16 * zoom)), y = Math.floor((event.clientY - rect.top) / (16 * zoom));
    if (x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE) onSelect(worldIndex(x, y));
  }
  return <div id="viewport" ref={viewportRef} tabIndex={0} aria-label="Farm map. Scroll or use arrow keys to explore."
    onKeyDown={event => {
      const offset = directions[event.key];
      if (offset) { event.preventDefault(); event.currentTarget.scrollBy(...offset); }
    }}>
    <canvas id="world" ref={canvasRef} width={1536} height={1536} style={{ width: 1536 * zoom, height: 1536 * zoom }}
      aria-label="Original scenario terrain" onClick={selectTile}
      onPointerMove={event => { pointerRef.current = { clientX: event.clientX, clientY: event.clientY }; updatePointer(); }}
      onPointerLeave={clearPointer} onPointerCancel={clearPointer}
      onPointerUp={event => { if (event.pointerType === 'touch') clearPointer(); }} />
  </div>;
}
