import type {Raster} from './graphics';

export const EDIT_CURSOR_OFFSETS={pick:0x1a2e,drop:0x19ea,view:0x19a4,bulldoze:0x18d2,spray:0x188c,buy:0x1aba} as const;
const CURSOR_RESOURCE_OFFSETS={pick:0,drop:0x100,view:0x200,buy:0x400,spray:0x500} as const;
/** Source8062..8145: three skipped words,32 mask bytes,32 color bytes.
 * Startup495ba..497bf replaces five masks/colors from cursors.til.
 * Each resource pair contains two128-byte tiles; only their first32 bytes
 * are read. Bulldoze/construction retain the executable arrow.
 * Native transparent RGBA replaces the VGA read/modify/write operation. */
export function readEditCursor(exe:Uint8Array,cursors:Uint8Array,kind:keyof typeof EDIT_CURSOR_OFFSETS):Raster {
  const offset=0x846f0+EDIT_CURSOR_OFFSETS[kind];
  if(!Number.isInteger(offset)||offset+70>exe.length)throw new Error('Truncated Edit cursor');
  const bytes=exe.subarray(offset,offset+70);
  if(bytes[0]!==32||bytes[1]!==0||bytes[2]!==2||bytes[3]!==0||bytes[4]!==16||bytes[5]!==0)throw new Error('Invalid Edit cursor header');
  if(cursors.length!==1536)throw new Error('Invalid cursor resource size');
  const resourceOffset=kind==='bulldoze'?undefined:CURSOR_RESOURCE_OFFSETS[kind];
  const mask=resourceOffset===undefined?bytes.subarray(6,38):cursors.subarray(resourceOffset,resourceOffset+32);
  const colors=resourceOffset===undefined?bytes.subarray(38,70):cursors.subarray(resourceOffset+128,resourceOffset+160);
  const rgba=new Uint8Array(16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const i=y*2+(x>>3),bit=128>>(x&7),visible=Boolean(mask[i]&bit),color=colors[i]&bit?255:0;
    rgba.set([color,color,color,visible?255:0],(y*16+x)*4);
  }
  return {width:16,height:16,rgba};
}
