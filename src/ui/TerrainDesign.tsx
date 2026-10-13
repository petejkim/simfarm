import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { TerrainPreviewAssets } from '../assets/game-assets';
import { focusUnlessClaimed } from './focus';
import type { CustomFarmSetup } from '../simulation/custom-farm-setup';
import { paintTerrainPreview, renderTerrainPreview } from '../render/terrain-preview';
import { BevelButton } from './chrome/BevelButton';
import { SunkenInset } from './chrome/SunkenInset';
import { spriteFace } from './chrome/Sprite';

const levels = ['Low', 'Moderate', 'High', 'Very high'];

/** Terrain designer (defworld panel 128,32 352×304) on shared chrome: HTML title and labels, arrow
 * BevelButtons with bitmap arrow faces, sunken level bars (80×10, 8px-truncated fills), toggle and caption
 * BevelButtons, and the generated miniature in a sunken inset with H/T markers on its 12×12 site grid.
 * The simulation draft owns map/sites/settings and RNG. */
export function TerrainDesign({ draft, assets, onPlay, onCancel, error }: {
  draft: CustomFarmSetup; assets: TerrainPreviewAssets; onPlay: () => void; onCancel: () => void; error: string;
}) {
  const state = useSyncExternalStore(draft.subscribe, draft.getSnapshot), { settings, preview } = state;
  const heading = useRef<HTMLHeadingElement>(null);
  const [actionError, setActionError] = useState('');
  useEffect(() => { focusUnlessClaimed(heading.current); }, []);
  const rendered = useMemo(() => {
    try {
      if (!preview.locations) throw new Error('No starting sites selected');
      return { image: renderTerrainPreview(preview.world, assets.miniature), error: '' };
    } catch (cause) { return { image: null, error: cause instanceof Error ? cause.message : String(cause) }; }
  }, [preview, assets]);
  // The generated preview is drawn straight onto a canvas (no data: image URL).
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (rendered.image && canvas.current) paintTerrainPreview(canvas.current, rendered.image);
  }, [rendered.image]);
  function run(action: () => void) {
    try { action(); setActionError(''); } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)); }
  }
  const closed = state.phase !== 'preview';
  const art = assets.screen.src;
  return <>
    <div className="terrain-design" id="terrain-design" role="group" aria-label="Original terrain design">
      <h2 ref={heading} tabIndex={-1} className="terrain-title">Design your terrain</h2>
      <div className="terrain-body">
        <div className="terrain-controls">
          {(['precipitation', 'temperature', 'wind'] as const).map((channel, i) => {
            const label = ['Rainfall', 'Temperature', 'Wind speed'][i], value = settings.climate[channel];
            const change = (level: number) => run(() => draft.setSettings({ ...settings, climate: { ...settings.climate, [channel]: level } }));
            return <div key={channel} className="terrain-climate">
              <label className="terrain-label" htmlFor={`terrain-${channel}`}>{label}</label>
              <div className="terrain-adjust">
                <BevelButton className="terrain-arrow" faceStyle={spriteFace(art, 142, 105)} aria-label={`Decrease ${label.toLowerCase()}`}
                  disabled={closed || value === 0} onClick={() => change(value - 1)} />
                <SunkenInset className="terrain-bar">
                  <span className={`terrain-level terrain-level-${channel}`} style={{ width: Math.floor(Math.min(80, value * 27) / 8) * 8 }} aria-hidden="true" />
                  <input id={`terrain-${channel}`} className="terrain-range" type="range" min={0} max={3} step={1}
                    value={value} aria-label={label} aria-valuetext={levels[value]} disabled={closed} onChange={e => change(Number(e.target.value))} />
                </SunkenInset>
                <BevelButton className="terrain-arrow" faceStyle={spriteFace(art, 247, 105)} aria-label={`Increase ${label.toLowerCase()}`}
                  disabled={closed || value === 3} onClick={() => change(value + 1)} />
              </div>
              <span className="terrain-range-labels"><span>Low</span><span>High</span></span>
            </div>;
          })}
          {(['river', 'lake'] as const).map(water => <BevelButton key={water} id={`terrain-${water}`} className="terrain-button terrain-toggle"
            aria-label={water === 'river' ? 'River' : 'Lake'} pressed={settings[water]} disabled={closed}
            onClick={() => run(() => draft.setSettings({ ...settings, [water]: !settings[water] }))}>{water === 'river' ? 'River' : 'Lake'}</BevelButton>)}
        </div>
        <div className="terrain-side">
          <SunkenInset className="terrain-preview-box">
            <span className="terrain-preview-grid">
              {rendered.image && <canvas id="terrain-preview" ref={canvas} width={192} height={192} role="img" aria-label="Terrain preview with home and town markers" />}
              {rendered.image && preview.locations && ([['T', preview.locations.town], ['H', preview.locations.player]] as const).map(([letter, site]) =>
                <span key={letter} className="terrain-marker" style={{ gridColumn: site.regionX + 1, gridRow: site.regionY + 1 }} aria-label={letter === 'H' ? 'Home' : 'Town'}>{letter}</span>)}
            </span>
          </SunkenInset>
          <div className="terrain-actions">
            <BevelButton id="generate-world" className="terrain-button terrain-generate" aria-label="Generate World" disabled={closed}
              onClick={() => run(() => draft.generateWorld())}>Generate World</BevelButton>
            <BevelButton id="play-farm" className="terrain-button" aria-label="Play" disabled={closed || !rendered.image} onClick={onPlay}>Play</BevelButton>
          </div>
        </div>
      </div>
    </div>
    <div className="setup-footer terrain-footer">
      <span>April {settings.date.year} · $40,000</span>
      <BevelButton className="native-button" onClick={onCancel}>Cancel</BevelButton>
    </div>
    {(error || actionError || rendered.error) && <p id="new-farm-error" role="alert">Could not create farm: {error || actionError || rendered.error}</p>}
  </>;
}
