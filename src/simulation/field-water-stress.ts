import type { FieldRecord } from '../formats/field';

/** Growth thresholds0x195d0..0x196b7. Share them with warning badges (SF-006).
 * Preserve growth's word tolerances and signed water comparison, including imported extremes. */
export function fieldWaterStress(field: FieldRecord, crop: readonly number[]): 'dry' | 'wet' | 'normal' {
  const b=field.bytes;
  const lower=Math.max(0,(crop[40]|crop[41]<<8)-b[51]*2);
  const upper=(crop[42]|crop[43]<<8)+b[52]*2;
  const water=(b[24]|b[25]<<8)<<16>>16;
  return water<lower?'dry':water>=upper?'wet':'normal';
}
