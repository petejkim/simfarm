import type { CropDefinition } from '../formats/crop';
import { assetUrl } from '../assets/game-assets';

interface Props { crops: CropDefinition[]; cropId: string; onChange: (id: string) => void }
export function CropGuide({ crops, cropId, onChange }: Props) {
  const crop = crops.find(c => c.id === cropId)!;
  return <>
    <div className="panel-heading"><span className="eyebrow">FARM REFERENCE</span><h2>Crop guide</h2></div>
    <label className="crop-label">Choose a crop <select id="crop" value={cropId} onChange={e => onChange(e.target.value)}>
      {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <img id="crop-card" src={assetUrl(`${crop.id}.card.png`)} alt={`${crop.name}, original crop illustration`} />
    <h3 id="crop-name">{crop.name}</h3><p id="crop-description">{crop.description}</p>
  </>;
}
