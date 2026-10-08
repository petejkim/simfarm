import type { MapTool } from './LandPanel';

export type FarmDestination = 'crop-supplies' | 'planner' | 'land' | 'field' | 'loans' | 'map';

export function FarmNavigation({ tool, blocked, onNavigate }: {
  tool: MapTool; blocked: boolean; onNavigate: (destination: FarmDestination) => void;
}) {
  return <nav className="farm-navigation" aria-label="Farm controls">
    <span className="eyebrow">Farm controls</span>
    <button onClick={() => onNavigate('planner')} aria-controls="field-planner" disabled={blocked}>Crop planner</button>
    <button onClick={() => onNavigate('land')} aria-pressed={tool === 'land'} disabled={blocked}>Buy land</button>
    <button onClick={() => onNavigate('field')} aria-pressed={tool === 'field'} disabled={blocked}>New field</button>
    <button onClick={() => onNavigate('crop-supplies')} aria-controls="crop-supply-shop" aria-pressed={tool === 'crop-supplies'} disabled={blocked}>Seeds &amp; chemicals</button>
    <button onClick={() => onNavigate('loans')} aria-controls="loan-panel">Loans</button>
  </nav>;
}
