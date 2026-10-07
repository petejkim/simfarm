import { useLayoutEffect, useRef, type MouseEvent } from 'react';
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
}
const directions: Record<string, [number, number]> = {
  ArrowLeft: [-64, 0], ArrowRight: [64, 0], ArrowUp: [0, -64], ArrowDown: [0, 64],
};

export function FarmMap({ scenario, tiles, maskedTiles, zoom, focus, field, selection, preview, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  const previousZoom = useRef(zoom), previousFocus = useRef<MapFocus | null>(null);
  useLayoutEffect(() => {
    drawWorld(canvasRef.current!.getContext('2d')!, scenario, tiles, maskedTiles, field, selection, preview);
  }, [scenario, tiles, maskedTiles, field, selection, preview]);
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
  }, [focus, zoom]);
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
      aria-label="Original scenario terrain" onClick={selectTile} />
  </div>;
}
