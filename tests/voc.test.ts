import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readArchive } from '../src/formats/archive';
import { decodeVoc } from '../src/formats/voc';
import { createHash } from 'node:crypto';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const sample = (name: string) => Uint8Array.from(entries.find(e => e.name === name)!.bytes);

test('all six original animal voices decode exact source PCM with species-specific sample rates', () => {
  const expected = [
    ['cow1', 7868, 75, '3cb705ffd984e36a03ae6e3702af7e2942abe18cd9b71872a008e433b3b20e95'],
    ['cow2', 8210, 75, '9b1a384ca0fed18494a9c880cc6ecd3248dfe85b50b924d29f04f3367557e946'],
    ['sheep1', 6456, 166, 'd7a093603e91aa73f5f9cd1c1eec165d8bd675913bacafdef119174752ec8dc5'],
    ['sheep2', 11219, 166, '801f9e35392e327e0fe0d746dd9c6718cd4d7399f6918115aff193f629be7365'],
    ['horse1', 8300, 75, '82925dd4a69bb81ea8d1b98e7712b8bba776e27786ab658b74122c12080843f6'],
    ['pig', 5204, 166, '2b37747e7efebe87df9e90a154bd0ae8ec89f36271b71b962b3ad95c5f4109ee'],
  ] as const;
  for (const [name, length, rateByte, hash] of expected) {
    const bytes = sample(`${name}.voc`), sound = decodeVoc(bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    assert.equal(sound.samples.length, length); assert.equal(sound.sampleRate, 1000000 / (256 - rateByte));
    for (let i = 0; i < length; i++) assert.equal(sound.samples[i], (bytes[32 + i] - 128) / 128);
    for (const end of [26, 31, bytes.length - 2, bytes.length - 1]) assert.throws(() => decodeVoc(bytes.subarray(0, end)));
  }
});

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

test('original equipment-removal explosion decodes every fingerprinted PCM sample', () => {
  const e = entries.find(e => e.name === 'explode.voc')!, sound = decodeVoc(e.bytes);
  assert.equal(e.offset, 2157593); assert.equal(e.bytes.length, 12769);
  assert.equal(createHash('sha256').update(e.bytes).digest('hex'), '1156a56ebd0d8bc2cd598d2ad91b6fb9d9f00b5c82db0a8c9f5bc065dd29c59f');
  assert.equal(sound.sampleRate, 1000000 / 181); assert.equal(sound.samples.length, 12736);
  for (let i = 0; i < sound.samples.length; i++) assert.equal(sound.samples[i], (e.bytes[i + 32] - 128) / 128);
  for (const end of [26, 31, e.bytes.length - 1]) assert.throws(() => decodeVoc(e.bytes.subarray(0, end)));
});
