import type {Raster} from './graphics';

export const MOVE_CURSOR_OFFSETS={pick:0x1a2e,drop:0x19ea} as const;
/** Source8062..8145: three skipped words,32 mask bytes,32 color bytes.
 * The last color word overlaps adjacent data, but its zero mask hides it.
 * Native transparent RGBA replaces the VGA read/modify/write operation. */
export function readMoveCursor(exe:Uint8Array,kind:keyof typeof MOVE_CURSOR_OFFSETS):Raster {
  const offset=0x846f0+MOVE_CURSOR_OFFSETS[kind];
  if(!Number.isInteger(offset)||offset+70>exe.length)throw new Error('Truncated Move cursor');
  const bytes=exe.subarray(offset,offset+70);
  if(bytes[0]!==32||bytes[1]!==0||bytes[2]!==2||bytes[3]!==0||bytes[4]!==16||bytes[5]!==0)throw new Error('Invalid Move cursor header');
  const rgba=new Uint8Array(16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const i=y*2+(x>>3),bit=128>>(x&7),visible=Boolean(bytes[6+i]&bit),color=bytes[38+i]&bit?255:0;
    rgba.set([color,color,color,visible?255:0],(y*16+x)*4);
  }
  return {width:16,height:16,rgba};
}
