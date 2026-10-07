import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readArchive } from '../src/formats/archive';
import { decodeVoc } from '../src/formats/voc';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const sample = (name: string) => Uint8Array.from(entries.find(e => e.name === name)!.bytes);

test('original homestead VOC samples decode their exact unsigned PCM bytes and source time constant', () => {
  for (const [name, size] of [['boos.voc', 11663], ['cheers.voc', 12343]] as const) {
    const bytes = sample(name), before = Uint8Array.from(bytes), sound = decodeVoc(bytes);
    assert.equal(sound.samples.length, size); assert.equal(sound.sampleRate, 1000000 / 181);
    assert.equal(bytes[30], 0x4b); assert.equal(bytes[31], 0);
    for (let i = 0; i < size; i++) assert.equal(sound.samples[i], (bytes[32 + i] - 128) / 128);
    assert.ok(sound.samples.some(n => Math.abs(n) > 0.1));
    sound.samples.fill(0); assert.deepEqual(bytes, before);
  }
  const bytes = sample('boos.voc'); bytes[32] = 0; bytes[33] = 128; bytes[34] = 255;
  assert.deepEqual([...decodeVoc(bytes).samples.slice(0, 3)], [-1, 0, 127 / 128]);
  const padded = new Uint8Array(bytes.length + 9); padded.set(bytes, 9);
  assert.deepEqual(decodeVoc(padded.subarray(9)), decodeVoc(bytes));
});

test('VOC rejects truncated headers, sample blocks, missing terminators, unsupported codecs and bad checksums', () => {
  const bytes = sample('cheers.voc');
  for (const size of [...Array.from({ length: 33 }, (_, i) => i), bytes.length - 1, bytes.length - 2]) assert.throws(() => decodeVoc(bytes.subarray(0, size)));
  const edits = [[0, 0], [19, 0], [20, 25], [24, 0], [26, 2], [27, 255], [28, 255], [29, 255], [30, 255], [31, 1], [bytes.length - 1, 1]];
  for (const [offset, value] of edits) { const bad = Uint8Array.from(bytes); bad[offset] = value; assert.throws(() => decodeVoc(bad)); }
  const extra = new Uint8Array(bytes.length + 1); extra.set(bytes); assert.throws(() => decodeVoc(extra), /block sequence/);
});
