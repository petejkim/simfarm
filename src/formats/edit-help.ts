import {readBitmap,type Palette,type Raster} from './graphics';

/** Literal captions transcribed from edithelp.bmp; y positions are bitmap-local. */
export const EDIT_HELP_LABELS=[
  ['MOVE OBJECT',4],['VIEW OBJECT',12],['PLOP PAVED ROAD',28],['PLOP DIRT ROAD',36],
  ['PLOP FENCE',52],['PLOP GATE',60],['PLOP DITCH',76],['PLOP VALVE',84],
  ['PLOP HAY',100],['PLOP TROUGH',108],['PLOP TREES',124],['BULLDOZE',132],
  ['FIELD',156],['FUNCTIONS',164],['HELP',188],
] as const;
/** Retain border/leader artwork; replace the right-hand bitmap lettering with HTML. */
export function readEditHelp(bytes:Uint8Array,palette:Palette):Raster {
  const raster=readBitmap(bytes,palette);
  if(raster.width!==88||raster.height!==200)throw new Error('Invalid edit-help dimensions');
  for(let y=2;y<198;y++)for(let x=19;x<87;x++)raster.rgba.set([...palette[12],255],(y*88+x)*4);
  return raster;
}
