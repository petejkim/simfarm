import { decodePlanar, type Palette, type Raster } from './graphics';
import {readEventMessage,type EventMessages} from './event-messages';

/** events.dat reader uses fixed256-byte records; retain physical rows and
 * ignore @ padding only for display. Raw imported data remains unchanged. */
export function readBulldozeMessage(bytes: EventMessages, kind: 'building' | 'field'): string {
  return readEventMessage(bytes,kind==='building'?46:47,'Truncated bulldoze message').physicalText;
}
/** 9654/9c3a draws48×24 buttons from buttons.til at576-byte strides.
 * Retain the frame, replace its bitmap caption with actual HTML text. */
/** Caption area inside the 2px bevel of a buttons.til record (face x3..44, y3..20). */
export const MESSAGE_BUTTON_FACE = { x: 3, y: 4, width: 42, height: 16 } as const;
export function readMessageButton(bytes: Uint8Array,palette: Palette): Raster {
  if(bytes.length!==18*576)throw new Error('Invalid message button atlas');
  const r=decodePlanar(bytes.subarray(0,576),48,24,palette);
  const f=MESSAGE_BUTTON_FACE;
  for(let y=f.y;y<f.y+f.height;y++)for(let x=f.x;x<f.x+f.width;x++)r.rgba.set([...palette[12],255],(y*48+x)*4);
  return r;
}
