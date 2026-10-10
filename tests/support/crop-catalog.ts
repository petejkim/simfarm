import { readFileSync, readdirSync } from 'node:fs';
import { readCrop } from '../../src/formats/crop';
/** Browser games include every shipped crop, independently of each SSM's slots. */
export const browserCrops = readdirSync(new URL('../../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), readFileSync(new URL('../../../simfarm-dos/CROPS/' + n, import.meta.url))));

/** Build a genuinely sixteen-slot historical fixture before assigning an old
 * schema version. Never use this to hide differences in actual checkpoints. */
export function useOriginalCatalog(save: any): void {
  if (save.scenario.cropFiles.length === 16) return;
  const fields = Buffer.from(save.scenario.records.fields, 'hex');
  for (let offset = 0; offset < fields.length; offset += 68)
    if (fields[offset + 7] & 1 && fields[offset + 14] >= 16) throw new Error('Cannot remove an active extra crop from a legacy fixture');
  save.scenario.cropFiles.length = 16;
  const records = save.scenario.records;
  records.cropDefinitions = records.cropDefinitions.slice(0, 16 * 36) + records.cropDefinitions.slice(24 * 36);
  for (const key of ['seedDefinitions', 'harvestDefinitions']) records[key] = records[key].slice(0, 16 * 36);
  save.runtime.crops.length = save.runtime.cropMarketPrices.length = 16;
  save.runtime.market.history.length = 16;
  save.version = 23;
}
