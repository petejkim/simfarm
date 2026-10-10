import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readOriginalMainMenus, readMainMenusData } from '../src/formats/main-menus';
const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
const DS = 0x846f0;

test('source header root, linked order, callbacks and initial checks match the executable', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  assert.equal(exe.subarray(0x3f8da, 0x3f8e8).toString('hex'), '26c706000074a826c70602009061');
  const data = readOriginalMainMenus(exe);
  assert.deepEqual(data.menus.map(m => m.title), ['File', 'Options', 'Speed', 'Windows', 'Disasters']);
  assert.deepEqual(data.menus.map(m => m.items.map(i => i.label)), [
    ['About SimFarm', 'New Game', 'Save', 'Save As', 'Load Game', 'Load Crop', 'Quit'],
    ['Music', 'Sound Effects', 'AutoBuy', 'AutoScroll', 'AutoDoze', 'AutoGoto', 'Messages', 'AutoLease'],
    ['Ultra', 'Fast', 'Normal', 'Slow', 'Pause'],
    ['Buy', 'Sell', 'Evaluation', 'Map', 'Weather', 'Balance Sheet', 'Bank', 'Edit', 'Market Value', 'Farm Expert'],
    ['Tornado', 'Locusts', 'Drought', 'Flood', 'Frost', 'Windstorm', 'Disable'],
  ]);
  assert.deepEqual(data.menus.map(m => m.offset), [0xa874, 0xa7f2, 0xa762, 0xa6fc, 0xa650]);
  assert.deepEqual(data.menus.map(m => m.callback), [0x1316, 0x130c, 0x1320, 0x133e, 0x1348].map(offset => ({ offset, segment: 0x24e6 })));
  assert.deepEqual(data.menus.map(m => [m.popup.x, m.popup.y, m.popup.width, m.popup.height]), [[0, 16, 128, 87], [64, 16, 120, 100], [144, 16, 64, 64], [208, 16, 120, 128], [288, 16, 104, 88]]);
  assert.deepEqual(data.menus.map(m => m.items.filter(i => i.flags & 1).map(i => i.label)), [[], ['Music', 'Sound Effects', 'AutoBuy', 'AutoScroll', 'Messages', 'AutoLease'], ['Normal'], [], []]);
  assert.equal(data.background, 8); assert.equal(data.foreground, 15);
  assert.deepEqual(readMainMenusData(JSON.parse(JSON.stringify(data))), data);
  const targets = Array.from({ length: 7 }, (_, i) => 0x3e3b0 + exe.readUInt16LE(0x3ee7c + i * 2));
  assert.deepEqual(targets, [0x3eb9c, 0x3ebfc, 0x3ec64, 0x3ec70, 0x3ed26, 0x3ed6a, 0x3edc4]);
  assert.equal(exe.subarray(0x3ed4c, 0x3ed52).toString('hex'), '68906168c6ac');
  assert.equal(exe.subarray(0x3ed6a, 0x3ed70).toString('hex'), '68906168b4ad');
});

test('menu decoder rejects truncated records, bad pointers, cycles, wrong backlinks and unterminated text', () => {
  for (const length of [0, DS + 0xa874, DS + 0xa874 + 29]) assert.throws(() => readOriginalMainMenus(exe.subarray(0, length)));
  const corrupt = (offset: number, value: number) => { const bytes = Buffer.from(exe); bytes.writeUInt16LE(value, DS + offset); assert.throws(() => readOriginalMainMenus(bytes)); };
  corrupt(0xa874 + 16, 0); corrupt(0xa874 + 16, 33); corrupt(0xa874 + 16, 6); corrupt(0xa874 + 16, 8);
  corrupt(0xa874 + 20, 0x6191); corrupt(0xa874 + 18, 0xfffe); corrupt(0xa874 + 22, 0xa874);
  corrupt(0xa866 + 4, 0xa866); corrupt(0xa858 + 8, 0xa83c); corrupt(0xa866 + 2, 0);
  const text = Buffer.from(exe); text.fill(65, DS + 0x5acb, DS + 0x5acb + 80);
  assert.throws(() => readOriginalMainMenus(text), /Unterminated/);
  text[DS + 0x5acb] = 255; assert.throws(() => readOriginalMainMenus(text), /text/);
  const flags = Buffer.from(exe); flags.writeUInt16LE(0x8003, DS + 0xa866 + 12);
  assert.equal(readOriginalMainMenus(flags).menus[0].items[0].flags, 0x8003, 'unknown flag bits remain intact');
  assert.deepEqual(exe, readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url)));
});

test('imported menu data rejects unsafe geometry, malformed chains, palette indices and invalid text', () => {
  const valid = readOriginalMainMenus(exe);
  for (const input of [null, [], {}, { ...valid, menus: [] }, { ...valid, background: 16 }]) assert.throws(() => readMainMenusData(input));
  for (const mutate of [
    (d: typeof valid) => { d.menus[0].popup.width = 641; },
    (d: typeof valid) => { d.menus[0].header.x = -1; },
    (d: typeof valid) => { d.menus[0].items[0].label = '\u0000bad'; },
    (d: typeof valid) => { d.menus[0].items[1].previous = 0; },
    (d: typeof valid) => { d.menus[0].next = d.menus[0].offset; },
    (d: typeof valid) => { d.menus[0].items[1].offset = d.menus[0].items[0].offset; },
  ]) { const data = structuredClone(valid); mutate(data); assert.throws(() => readMainMenusData(data)); }
});
