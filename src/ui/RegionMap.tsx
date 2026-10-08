import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { RegionAssets } from '../assets/game-assets';
import { paintRegionChooser, renderRegionChooser, REGION_PANEL } from '../render/region-chooser';

const position = (x: number, y: number, width: number, height: number): CSSProperties => ({
  left: `${(x - REGION_PANEL.x) / REGION_PANEL.width * 100}%`, top: `${(y - REGION_PANEL.y) / REGION_PANEL.height * 100}%`,
  width: `${width / REGION_PANEL.width * 100}%`, height: `${height / REGION_PANEL.height * 100}%`,
});

/** Source grid covers pixels248..535,40..327 of scenario.int. DOM buttons
 * handle selection; original pixels remain presentation only. */
export function RegionMap({ assets, selected, disabled, unavailable, onSelect, onDesign, onLoad, onQuit }: {
  assets: RegionAssets; selected: number; disabled: boolean; unavailable: boolean; onSelect: (index: number) => void;
  onDesign: () => void; onLoad: () => void; onQuit: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raster = useMemo(() => renderRegionChooser(assets.artwork, assets.farms, assets.locations[selected]), [assets, selected]);
  useEffect(() => { if (canvas.current) paintRegionChooser(canvas.current, raster); }, [raster]);
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
  return <div className="geographic-chooser" id="geographic-chooser" role="group" aria-label="Select a region" aria-describedby="region-map-help">
    <canvas ref={canvas} id="region-artwork" width={REGION_PANEL.width} height={REGION_PANEL.height} aria-hidden="true" />
    <span className="setup-text setup-title" style={position(102, 28, 136, 48)}>SELECT<br />A REGION</span>
    {['Rainfall', 'Temperature', 'Wind Speed'].map((label, i) => <div key={label}>
      <span className="setup-text" style={position(112, 84 + i * 48, 112, 15)}>{label}</span>
      <span className="setup-text" style={position(90, 113 + i * 48, 29, 13)}>Low</span>
      <span className="setup-text" style={position(215, 113 + i * 48, 29, 13)}>High</span>
    </div>)}
    <div className="region-grid" id="region-map" style={position(248, 40, 288, 288)} role="group" aria-label="Original region map">
      {assets.locations.map((p, index) => {
        const farm = assets.farms.find(f => f.x === p.x && f.y === p.y);
        const label = `Region ${p.x + 1}, ${p.y + 1}${farm ? ` · Scenario ${farm.id + 1}` : ''}`;
        return <button key={index} ref={el => { buttons.current[index] = el; }} type="button"
          data-region={`${p.x},${p.y}`} disabled={disabled || !p.selectable} tabIndex={index === selected ? 0 : -1}
          aria-label={label} aria-pressed={index === selected} title={p.selectable ? label : 'Unavailable region'}
          className={farm ? 'region-preset' : ''} onClick={() => onSelect(index)} onKeyDown={e => navigate(e, index)} />;
      })}
    </div>
    <button id="region-use" className="region-hit setup-button" style={position(96, 232, 141, 24)} type="submit" aria-label="Use this region" disabled={disabled || unavailable}>Use This Region</button>
    <button id="region-design" className="region-hit setup-button" style={position(96, 256, 141, 24)} type="button" aria-label="Design your own" disabled={disabled || unavailable} onClick={onDesign}>Design Your Own</button>
    <button id="region-load" className="region-hit setup-button" style={position(96, 280, 141, 25)} type="button" aria-label="Load a saved game" disabled={disabled} onClick={onLoad}>Load a Saved Game</button>
    <button id="region-quit" className="region-hit setup-button" style={position(96, 305, 141, 24)} type="button" aria-label="Quit setup" onClick={onQuit}>Quit</button>
  </div>;
}
