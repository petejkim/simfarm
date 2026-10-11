import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { TerrainPreviewAssets } from '../assets/game-assets';
import type { CustomFarmSetup } from '../simulation/custom-farm-setup';
import { paintTerrainPreview, renderTerrainPreview } from '../render/terrain-preview';

const position = (x: number, y: number, width: number, height: number): CSSProperties => ({
  left: `${(x - 128) / 352 * 100}%`, top: `${(y - 32) / 304 * 100}%`, width: `${width / 352 * 100}%`, height: `${height / 304 * 100}%`,
});
const levels = ['Low', 'Moderate', 'High', 'Very high'];

/** Original defworld artwork is presentation; React owns every interactive
 * control. The simulation draft owns map/sites/settings and RNG. */
export function TerrainDesign({ draft, assets, onPlay, onCancel, error }: {
  draft: CustomFarmSetup; assets: TerrainPreviewAssets; onPlay: () => void; onCancel: () => void; error: string;
}) {
  const state = useSyncExternalStore(draft.subscribe, draft.getSnapshot), { settings, preview } = state;
  const heading = useRef<HTMLHeadingElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [actionError, setActionError] = useState('');
  useEffect(() => { heading.current?.focus(); }, []);
  const rendered = useMemo(() => {
    try {
      if (!preview.locations) throw new Error('No starting sites selected');
      return { raster: renderTerrainPreview(preview.world, assets.miniature), error: '' };
    } catch (cause) { return { raster: null, error: cause instanceof Error ? cause.message : String(cause) }; }
  }, [preview, assets]);
  useEffect(() => { if (canvas.current && rendered.raster) paintTerrainPreview(canvas.current, rendered.raster); }, [rendered]);
  function run(action: () => void) {
    try { action(); setActionError(''); } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)); }
  }
  const closed = state.phase !== 'preview';
  return <>
    <div className="terrain-design" id="terrain-design" role="group" aria-label="Original terrain design" aria-describedby="terrain-design-help">
      <img src={assets.screen.src} alt="" draggable={false} />
      <h2 ref={heading} tabIndex={-1} className="setup-text setup-title" style={position(176, 44, 260, 24)}>Design your terrain</h2>
      <canvas ref={canvas} id="terrain-preview" width={192} height={192} style={position(264, 72, 192, 192)} role="img" aria-label="Terrain preview with home and town markers" hidden={!rendered.raster} />
      {rendered.raster && preview.locations && ([['T', preview.locations.town], ['H', preview.locations.player]] as const).map(([letter, site]) =>
        <span key={letter} className="terrain-marker" style={position(264 + site.regionX * 16, 72 + site.regionY * 16, 8, 8)} aria-label={letter === 'H' ? 'Home' : 'Town'}>{letter}</span>)}
      {(['precipitation', 'temperature', 'wind'] as const).map((channel, i) => {
        const label = ['Rainfall', 'Temperature', 'Wind speed'][i], y = [105, 163, 222][i], value = settings.climate[channel];
        const change = (level: number) => run(() => draft.setSettings({ ...settings, climate: { ...settings.climate, [channel]: level } }));
        return <div key={channel}>
          <label className="setup-text" htmlFor={`terrain-${channel}`} style={position(154, y - 20, 94, 15)}>{label}</label>
          <span className="setup-text" style={position(156, y + 16, 30, 13)}>Low</span>
          <span className="setup-text" style={position(213, y + 16, 34, 13)}>High</span>
          <div className="terrain-level terrain-level-background" style={position(160, y, 80, 10)} aria-hidden="true" />
          <div className={`terrain-level terrain-level-${channel}`} style={position(160, y, Math.floor(Math.min(80, value * 27) / 8) * 8, 10)} aria-hidden="true" />
          <button type="button" className="terrain-hit" style={position(140, y - 3, 15, 16)} aria-label={`Decrease ${label.toLowerCase()}`}
            disabled={closed || value === 0} onClick={() => change(value - 1)} />
          <input id={`terrain-${channel}`} className="terrain-range" style={position(158, y - 3, 84, 16)} type="range" min={0} max={3} step={1}
            value={value} aria-label={label} aria-valuetext={levels[value]} disabled={closed} onChange={e => change(Number(e.target.value))} />
          <button type="button" className="terrain-hit" style={position(244, y - 3, 15, 16)} aria-label={`Increase ${label.toLowerCase()}`}
            disabled={closed || value === 3} onClick={() => change(value + 1)} />
        </div>;
      })}
      {(['river', 'lake'] as const).map((water, i) => <button key={water} id={`terrain-${water}`} type="button" className="terrain-hit setup-button terrain-toggle"
        style={position(176, 258 + i * 27, 49, 25)} aria-label={water === 'river' ? 'River' : 'Lake'} aria-pressed={settings[water]} disabled={closed}
        onClick={() => run(() => draft.setSettings({ ...settings, [water]: !settings[water] }))}>{water === 'river' ? 'River' : 'Lake'}</button>)}
      <button id="generate-world" type="button" className="terrain-hit setup-button" style={position(266, 285, 123, 25)} aria-label="Generate World" disabled={closed}
        onClick={() => run(() => draft.generateWorld())}>Generate World</button>
      <button id="play-farm" type="button" className="terrain-hit setup-button" style={position(401, 285, 49, 25)} aria-label="Play" disabled={closed || !rendered.raster} onClick={onPlay}>Play</button>
    </div>
    <div className="setup-footer terrain-footer">
      <span>April {settings.date.year} · $40,000</span>
      <details><summary>Help</summary><div>
        <p id="terrain-design-help">Choose climate and water options. Generate World makes a new map; Play accepts the displayed map. H marks your home; T marks the town. Water and rainfall changes affect terrain when you Generate World.</p>
        <p id="terrain-settings" role="status">Rainfall: {levels[settings.climate.precipitation]} · Temperature: {levels[settings.climate.temperature]} · Wind: {levels[settings.climate.wind]} · River: {settings.river ? 'on' : 'off'} · Lake: {settings.lake ? 'on' : 'off'}</p>
        {preview.locations && <p id="terrain-sites">Home: region {preview.locations.player.regionX + 1}, {preview.locations.player.regionY + 1} · Town: region {preview.locations.town.regionX + 1}, {preview.locations.town.regionY + 1}</p>}
      </div></details>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
    {(error || actionError || rendered.error) && <p id="new-farm-error" role="alert">Could not create farm: {error || actionError || rendered.error}</p>}
  </>;
}
