import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { TerrainPreviewAssets } from '../assets/game-assets';
import type { CustomFarmSetup } from '../simulation/custom-farm-setup';
import { paintTerrainPreview, renderLocatedTerrainPreview } from '../render/terrain-preview';

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
      return { raster: renderLocatedTerrainPreview(preview.world, assets.miniature, assets.markers, preview.locations), error: '' };
    } catch (cause) { return { raster: null, error: cause instanceof Error ? cause.message : String(cause) }; }
  }, [preview, assets]);
  useEffect(() => { if (canvas.current && rendered.raster) paintTerrainPreview(canvas.current, rendered.raster); }, [rendered]);
  function run(action: () => void) {
    try { action(); setActionError(''); } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)); }
  }
  const closed = state.phase !== 'preview';
  return <>
    <h2 ref={heading} tabIndex={-1}>Design your terrain</h2>
    <p id="terrain-design-help">Choose your climate and water options, then Generate World to make a new map. Play accepts the displayed map. H marks your home; T marks the town.</p>
    <div className="terrain-design" id="terrain-design" role="group" aria-label="Original terrain design" aria-describedby="terrain-design-help">
      <img src={assets.screen.src} alt="" draggable={false} />
      <canvas ref={canvas} id="terrain-preview" width={192} height={192} style={position(264, 72, 192, 192)} role="img" aria-label="Terrain preview with home and town markers" hidden={!rendered.raster} />
      {(['precipitation', 'temperature', 'wind'] as const).map((channel, i) => {
        const label = ['Rainfall', 'Temperature', 'Wind speed'][i], y = [105, 163, 222][i], value = settings.climate[channel];
        const change = (level: number) => run(() => draft.setSettings({ ...settings, climate: { ...settings.climate, [channel]: level } }));
        return <div key={channel}>
          <div className="terrain-level terrain-level-background" style={position(160, y, 80, 10)} aria-hidden="true" />
          <div className={`terrain-level terrain-level-${channel}`} style={position(160, y, Math.min(80, value * 27), 10)} aria-hidden="true" />
          <button type="button" className="terrain-hit" style={position(140, y - 3, 15, 16)} aria-label={`Decrease ${label.toLowerCase()}`}
            disabled={closed || value === 0} onClick={() => change(value - 1)} />
          <input id={`terrain-${channel}`} className="terrain-range" style={position(158, y - 3, 84, 16)} type="range" min={0} max={3} step={1}
            value={value} aria-label={label} aria-valuetext={levels[value]} disabled={closed} onChange={e => change(Number(e.target.value))} />
          <button type="button" className="terrain-hit" style={position(244, y - 3, 15, 16)} aria-label={`Increase ${label.toLowerCase()}`}
            disabled={closed || value === 3} onClick={() => change(value + 1)} />
        </div>;
      })}
      {(['river', 'lake'] as const).map((water, i) => <button key={water} id={`terrain-${water}`} type="button" className="terrain-hit terrain-toggle"
        style={position(176, 258 + i * 27, 49, 25)} aria-label={water === 'river' ? 'River' : 'Lake'} aria-pressed={settings[water]} disabled={closed}
        onClick={() => run(() => draft.setSettings({ ...settings, [water]: !settings[water] }))} />)}
      <button id="generate-world" type="button" className="terrain-hit" style={position(266, 285, 123, 25)} aria-label="Generate World" disabled={closed}
        onClick={() => run(() => draft.generateWorld())} />
      <button id="play-farm" type="button" className="terrain-hit" style={position(401, 285, 49, 25)} aria-label="Play" disabled={closed || !rendered.raster} onClick={onPlay} />
    </div>
    <p id="terrain-settings" role="status">Rainfall: {levels[settings.climate.precipitation]} · Temperature: {levels[settings.climate.temperature]} · Wind: {levels[settings.climate.wind]} · River: {settings.river ? 'on' : 'off'} · Lake: {settings.lake ? 'on' : 'off'}</p>
    <p>Water and rainfall changes affect the terrain when you Generate World. Your farm starts in April {settings.date.year} with $40,000.</p>
    {preview.locations && <p id="terrain-sites">Home: region {preview.locations.player.regionX + 1}, {preview.locations.player.regionY + 1} · Town: region {preview.locations.town.regionX + 1}, {preview.locations.town.regionY + 1}</p>}
    <button type="button" onClick={onCancel}>Cancel</button>
    {(error || actionError || rendered.error) && <p id="new-farm-error" role="alert">Could not create farm: {error || actionError || rendered.error}</p>}
  </>;
}
