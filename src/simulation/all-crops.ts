import type { CropDefinition } from '../formats/crop';
import { allCropFiles } from '../formats/crop-slots';
import { GoodsDefinition } from '../formats/inventory';
import type { SimulationState } from './save-state';

/** Explicit native catalog expansion, after original startup/import completes.
 * Never replace a crop slot or consume RNG. Keep the eight unnamed original
 * trade records after the new entries, byte for byte, rather than repurpose them. */
export function expandCropCatalog(state: SimulationState, catalog: readonly CropDefinition[]): void {
  const world = state.scenario, files = allCropFiles(world.cropFiles);
  if (world.cropFiles.length === 24) return;
  const extras = files.slice(16).map(file => {
    const crop = catalog.find(c => `${c.id}.crp` === file);
    if (!crop || crop.rawDefinition.length !== 128 || crop.rawDefinition.some(b => !Number.isInteger(b) || b < 0 || b > 255))
      throw new Error(`Missing simulation crop ${file}`);
    return [...crop.rawDefinition];
  });
  const definition = (slot: number, kind: 'crop' | 'seed' | 'harvest', price: number) => {
    // New native records have no DOS pointer or unknown-byte provenance.
    const bytes = new Uint8Array(18), view = new DataView(bytes.buffer);
    view.setUint16(0, kind === 'crop' ? 73 : (kind === 'seed' ? 87 : 109) + slot, true);
    view.setUint16(2, (kind === 'crop' ? 128 : kind === 'seed' ? 192 : 168) + slot, true);
    view.setUint16(6, price, true); bytes[8] = bytes[9] = kind === 'crop' ? 2 : 1;
    return new GoodsDefinition(bytes);
  };
  const extraTrades: GoodsDefinition[] = [];
  extras.forEach((crop, i) => {
    const slot = i + 16, price = crop[34] | crop[35] << 8;
    extraTrades.push(definition(slot, 'crop', price));
    world.seedDefinitions.push(definition(slot, 'seed', Math.max(5, (crop[38] | crop[39] << 8) >>> 2)));
    world.harvestDefinitions.push(definition(slot, 'harvest', price));
    state.cropMarketPrices.push(price);
    state.market.history.push([...Array(29).fill(null), price]);
  });
  world.cropDefinitions.splice(16, 0, ...extraTrades);
  world.cropFiles = files;
  state.crops = [...state.crops, ...extras];
}

/** Restart discards the old farm's fields/inventory and builds the original
 * sixteen-slot startup first. Its browser caller expands the accepted farm. */
export function originalCatalogForRestart(state: SimulationState): void {
  if (state.scenario.cropFiles.length !== 24) return;
  state.scenario.cropFiles = state.scenario.cropFiles.slice(0, 16);
  state.scenario.cropDefinitions.splice(16, 8);
  state.scenario.seedDefinitions.length = state.scenario.harvestDefinitions.length = 16;
  state.crops = state.crops.slice(0, 16);
  state.cropMarketPrices.length = state.market.history.length = 16;
}
