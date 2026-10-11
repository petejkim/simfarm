import { Binary } from './binary';
export interface MidiEvent { tick: number; data: number[]; voice?:number }
export interface MidiLoop { startTick:number; endTick:number; initialEvents:MidiEvent[]; events:MidiEvent[] }
export interface MidiSequence { loop?:MidiLoop; ticksPerSecond: 120; endTick: number; events: MidiEvent[]; sourceMetadata: MidiEvent[] }

function eventChunks(bytes: Uint8Array, depth = 0): Uint8Array[] {
  if (depth > 8) throw new Error('IFF nesting too deep');
  const b = new Binary(bytes), result: Uint8Array[] = [];
  for (let p = 0; p < bytes.length;) {
    const tag = b.text(p, 4), length = b.be32(p + 4), body = b.slice(p + 8, length);
    if (tag === 'FORM' || tag === 'CAT ') {
      if (length < 4) throw new Error('Missing IFF form type');
      result.push(...eventChunks(body.subarray(4), depth + 1));
    } else if (tag === 'EVNT') result.push(body);
    p += 8 + length + (length & 1);
    if (p > bytes.length) throw new Error('Missing IFF padding');
  }
  return result;
}
/** XMIDI duration is a MIDI VLQ; delay is a sum of bytes below 128. */
export function decodeXmidi(bytes: Uint8Array): MidiSequence {
  const chunks = eventChunks(bytes);
  if (chunks.length !== 1) throw new Error('Expected one XMIDI sequence');
  const source = chunks[0];
  const loopStack:{tick:number;eventIndex:number}[]=[];
  let loop:MidiLoop|undefined;
  let pos = 0, tick = 0, ended = false, voice=0;
  const events: MidiEvent[] = [], sourceMetadata: MidiEvent[] = [];
  function next(): number { if (pos >= source.length) throw new Error('Truncated XMIDI event'); return source[pos++]; }
  function vlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) { const byte = next(); value = value * 128 + (byte & 127); if (!(byte & 128)) return value; }
    throw new Error('Invalid MIDI VLQ');
  }
  while (pos < source.length && !ended) {
    while (pos < source.length && source[pos] < 128) tick += next();
    const status = next(), kind = status >> 4;
    if (status === 0xff || status === 0xf0 || status === 0xf7) {
      const type = status === 0xff ? next() : status, length = vlq();
      if (length > source.length - pos) throw new Error('Truncated MIDI metadata');
      const payload = Array.from(source.subarray(pos, pos + length)); pos += length;
      sourceMetadata.push({ tick, data: [status, type, ...payload] });
      if (status === 0xff && type === 0x2f) { if (length !== 0) throw new Error('Invalid end-of-track'); ended = true; }
      continue;
    }
    if (kind < 8 || kind > 14) throw new Error(`Unsupported XMIDI status ${status}`);
    const data = [status, next()];
    if (kind !== 12 && kind !== 13) data.push(next());
    if (data.slice(1).some(v => v >= 128)) throw new Error('Invalid MIDI data byte');
    if (kind === 11 && data[1] >= 110 && data[1] <= 120) {
      sourceMetadata.push({ tick, data });
      // Preserve AIL instructions as evidence; fail instead of flattening finite loops or callbacks.
      if ((data[1] === 116 && data[2] !== 0) || [115, 119].includes(data[1])) throw new Error('XMIDI branch/finite-loop interpretation required');
      // Supplied GMT32MPU.ADV1a41..1aa0: first free of four slots,
      // NEXT selects the last occupied slot regardless of MIDI channel.
      if (!loop && data[1] === 116 && loopStack.length < 4) loopStack.push({tick,eventIndex:events.length});
      if (!loop && data[1] === 117 && data[2] >= 64 && loopStack.length) {
        const start=loopStack.at(-1)!;
        if(tick<=start.tick)throw new Error('Nonadvancing XMIDI loop');
        loop={startTick:start.tick,endTick:tick,initialEvents:events.slice(),events:events.slice(start.eventIndex)};
      }
    } else events.push({ tick, data, ...(kind===9&&data[2]>0?{voice:voice++}:{}) });
    if (kind === 9) {
      const duration = vlq();
      if (data[2] !== 0) events.push({ tick: tick + Math.max(1, duration), data: [0x80 | (status & 15), data[1], 0],voice:voice-1 });
    }
  }
  if (!ended) throw new Error('XMIDI has no end-of-track event');
  events.sort((a, b) => a.tick - b.tick);
  if(loop){loop.events.sort((a,b)=>a.tick-b.tick);loop.initialEvents.sort((a,b)=>a.tick-b.tick);}
  return { ...(loop?{loop}:{}),ticksPerSecond: 120, endTick: Math.max(tick, ...events.map(e => e.tick)), events, sourceMetadata };
}
function vlq(value: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) throw new Error('Invalid MIDI delta');
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128))) bytes.unshift((value & 127) | 128);
  return bytes;
}
/** Standard MIDI type 0, 60 PPQN at 500000us/quarter = XMIDI's 120Hz. */
export function encodeMidi(sequence: MidiSequence): Uint8Array {
  const track = [0, 0xff, 0x51, 3, 7, 0xa1, 0x20];
  let previous = 0;
  for (const event of sequence.events) {
    track.push(...vlq(event.tick - previous), ...event.data);
    previous = event.tick;
  }
  track.push(...vlq(sequence.endTick - previous), 0xff, 0x2f, 0);
  const result = new Uint8Array(22 + track.length);
  result.set([77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 60, 77, 84, 114, 107]);
  new DataView(result.buffer).setUint32(18, track.length);
  result.set(track, 22);
  return result;
}
