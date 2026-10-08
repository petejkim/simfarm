import { useRef, type KeyboardEvent } from 'react';
import type { RegionAssets } from '../assets/game-assets';

/** Source grid covers pixels248..535,40..327 of scenario.int. DOM buttons
 * handle selection; cropped original pixels remain presentation only. */
export function RegionMap({ assets, selected, disabled, onSelect }: {
  assets: RegionAssets; selected: number; disabled: boolean; onSelect: (index: number) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); if (disabled) return;
    let next = index;
    if (direction) {
      let { x, y } = assets.locations[index];
      for (;;) {
        x += direction[0]; y += direction[1];
        if (x < 0 || x >= 18 || y < 0 || y >= 18) return;
        if (assets.locations[y * 18 + x].selectable) { next = y * 18 + x; break; }
      }
    } else {
      const cells = assets.locations.filter(p => p.selectable);
      const p = event.key === 'Home' ? cells[0] : cells.at(-1)!; next = p.y * 18 + p.x;
    }
    onSelect(next); buttons.current[next]?.focus();
  }
  return <div className="region-map" id="region-map" role="group" aria-label="Original region map" aria-describedby="region-map-help">
    <img src={assets.screen.src} alt="" draggable={false} />
    <div className="region-grid">
      {assets.locations.map((p, index) => {
        const farm = assets.farms.find(f => f.x === p.x && f.y === p.y);
        const label = `Region ${p.x + 1}, ${p.y + 1}${farm ? ` · Scenario ${farm.id + 1}` : ''}`;
        return <button key={index} ref={el => { buttons.current[index] = el; }} type="button"
          data-region={`${p.x},${p.y}`} disabled={disabled || !p.selectable} tabIndex={index === selected ? 0 : -1}
          aria-label={label} aria-pressed={index === selected} title={p.selectable ? label : 'Unavailable region'}
          className={farm ? 'region-preset' : ''} onClick={() => onSelect(index)} onKeyDown={e => navigate(e, index)}>
          {farm ? <span aria-hidden="true">{farm.id + 1}</span> : null}
        </button>;
      })}
    </div>
  </div>;
}
