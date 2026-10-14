import { parseEventText, type EventTextLine } from './event-text';

/** Display forms of one complete events.dat record. IDs remain source record indices.
 * Loader4a2ee exposes254 text bytes; Bulldoze retains the physical256-byte rows. */
export interface EventMessageText {
  paragraph: string;
  lines: readonly EventTextLine[];
  physicalText: string;
}
export type EventMessages = Uint8Array | readonly EventMessageText[];

/** Binary input remains supported for source evidence/tests; browser input is predecoded JSON. */
export function readEventMessage(source: EventMessages, index: number, error = 'Truncated event message'): EventMessageText {
  if (!Number.isInteger(index) || index < 0) throw new Error('Invalid event message index');
  if (!(source instanceof Uint8Array)) {
    const message = source[index];
    if (!message) throw new Error(error);
    return message;
  }
  const offset = index * 256;
  if (source.length < offset + 256) throw new Error(error);
  const record = source.subarray(offset, offset + 256), decoder = new TextDecoder('ascii');
  const text = decoder.decode(record.subarray(0, 254)).split('\0')[0];
  return {
    paragraph: text.replace(/@/g, ' ').replace(/\s+/g, ' ').trim(),
    lines: parseEventText(text),
    physicalText: decoder.decode(record).split(/\r?\n/).map(line => line.replace(/@/g, '').trim()).filter(Boolean).join('\n'),
  };
}
