import { decodePlanar, type Palette, type Raster } from './graphics';

/** events.dat reader uses fixed256-byte records; retain physical rows and
 * ignore @ padding only for display. Raw imported data remains unchanged. */
export function readBulldozeMessage(bytes: Uint8Array, kind: 'building' | 'field'): string {
  const offset=(kind==='building'?46:47)*256;
  if(bytes.length<offset+256)throw new Error('Truncated bulldoze message');
  return new TextDecoder('ascii').decode(bytes.subarray(offset,offset+256)).split(/\r?\n/)
    .map(line=>line.replace(/@/g,'').trim()).filter(Boolean).join('\n');
}
/** 9654/9c3a draws48×24 buttons from buttons.til at576-byte strides.
 * Retain the frame, replace its bitmap caption with actual HTML text. */
export function readMessageButton(bytes: Uint8Array,palette: Palette): Raster {
  if(bytes.length!==18*576)throw new Error('Invalid message button atlas');
  const r=decodePlanar(bytes.subarray(0,576),48,24,palette);
  for(let y=4;y<20;y++)for(let x=2;x<46;x++)r.rgba.set([...palette[12],255],(y*48+x)*4);
  return r;
}
