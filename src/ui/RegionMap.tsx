import { useEffect, useRef, type KeyboardEvent } from 'react';
import { assetUrl, type RegionAssets } from '../assets/game-assets';
import { focusUnlessClaimed } from './focus';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { Sprite } from './chrome/Sprite';

/** Source region chooser (scenario.int panel 80,16 472×328) on shared chrome: HTML title, labels and
 * Low/High text; climate bars (31f53: 96×10 at palette 6 over 12) as sunken meters; caption
 * BevelButtons; and the 18×18 region grid over the map sprite (source 248,40). The selection outline
 * is four strips of the XORed map, matching 31e24. */
export function RegionMap({ assets, selected, disabled, unavailable, onSelect, onUse, onDesign, onLoad }: {
  assets: RegionAssets; selected: number; disabled: boolean; unavailable: boolean; onSelect: (index: number) => void;
  onUse: () => void; onDesign: () => void; onLoad: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { focusUnlessClaimed(heading.current); }, []);
  // Imported sprite sheets (renderRegionMaps in tools/import.ts): the map with its farm rectangles, and the XORed copy.
  const images = { map: assetUrl('region-map.png'), inverted: assetUrl('region-map.inverted.png') };
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const location = assets.locations[selected], fill = `rgb(${assets.artwork.palette[6].join(',')})`;
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
  // Strips of the XORed map: top/bottom x+1..x+15, left x at y+1..y+15, right x+16 at y..y+16.
  const strip = (dx: number, dy: number, width: number, height: number) =>
    <Sprite image={images.inverted} x={location.x * 16 + dx} y={location.y * 16 + dy} width={width} height={height} style={{ margin: `${dy}px 0 0 ${dx}px` }} />;
  return <div className="geographic-chooser" id="geographic-chooser" role="group" aria-label="Select a region">
    <div className="region-controls">
      <h2 ref={heading} tabIndex={-1} className="region-title" style={{ color: fill }}>SELECT<br />A REGION</h2>
      {(['Rainfall', 'Temperature', 'Wind Speed'] as const).map((label, i) => <div key={label} className="region-climate">
        <span className="region-label">{label}</span>
        <SunkenInset className="region-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={3}
          aria-valuenow={[location.precipitation, location.temperature, location.wind][i]}>
          <span style={{ width: [location.precipitation, location.temperature, location.wind][i] * 32, background: fill }} />
        </SunkenInset>
        <span className="region-range"><span>Low</span><span>High</span></span>
      </div>)}
      <div className="region-actions">
        <BevelButton id="region-use" className="region-action" shadow aria-label="Use this region" disabled={disabled || unavailable} onClick={onUse}>Use This Region</BevelButton>
        <BevelButton id="region-design" className="region-action" shadow aria-label="Design your own" disabled={disabled || unavailable} onClick={onDesign}>Design Your Own</BevelButton>
        <BevelButton id="region-load" className="region-action" shadow aria-label="Load a saved game" disabled={disabled} onClick={onLoad}>Load a Saved Game</BevelButton>
      </div>
    </div>
    <SunkenInset className="region-map-box">
      <div className="region-grid" id="region-map" role="group" aria-label="Original region map" style={{ backgroundImage: `url("${images.map}")` }}>
        {assets.locations.map((p, index) => {
          const farm = assets.farms.find(f => f.x === p.x && f.y === p.y);
          const label = `Region ${p.x + 1}, ${p.y + 1}${farm ? ` · Scenario ${farm.id + 1}` : ''}`;
          return <button key={index} ref={el => { buttons.current[index] = el; }} type="button"
            data-region={`${p.x},${p.y}`} disabled={disabled || !p.selectable} tabIndex={index === selected ? 0 : -1}
            aria-label={label} aria-pressed={index === selected} title={p.selectable ? label : 'Unavailable region'}
            className={farm ? 'region-preset' : ''} style={{ gridColumn: p.x + 1, gridRow: p.y + 1 }} onClick={() => onSelect(index)} onKeyDown={e => navigate(e, index)} />;
        })}
        <span className="region-selection" aria-hidden="true" style={{ gridColumn: location.x + 1, gridRow: location.y + 1 }}>
          {strip(1, 0, 15, 1)}{strip(1, 16, 15, 1)}{strip(0, 1, 1, 15)}{strip(16, 0, 1, 17)}
        </span>
      </div>
    </SunkenInset>
  </div>;
}
