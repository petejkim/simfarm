import { test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { EXPERT_CARD_IDS, readExpertCard, expertPage } from '../src/formats/expert-cards';
import { decodeUiContent, readUiContentJson } from '../src/formats/ui-content';
import { readEditStatus } from '../src/formats/edit-status';
import { FINANCE_MESSAGES, readFinanceMessage } from '../src/formats/finance-message';
import { DISASTER_MESSAGES, readDisasterMessage } from '../src/formats/disaster-message';
import { readWaterStorageMessage } from '../src/formats/building-message';
import { readBulldozeMessage } from '../src/formats/message-dialog';
import { readRodeoInvitation } from '../src/formats/town-event';
import { readEventMessage } from '../src/formats/event-messages';
import type { FinanceNoticeId, DisasterNoticeId } from '../src/simulation/events';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const read = (name: string) => archive.find(entry => entry.name === name)!.bytes;
const data = decodeUiContent(read), roundTrip = () => JSON.parse(JSON.stringify(data));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('every importer JSON output is compact while preserving spaces and line breaks inside strings', () => {
  const files = readdirSync('public/assets').filter(name => name.endsWith('.json'));
  expect(files.length).toBeGreaterThan(1);
  for (const file of files) {
    const bytes = readFileSync(`public/assets/${file}`, 'utf8');
    expect(bytes, file).toBe(JSON.stringify(JSON.parse(bytes)));
  }
  expect(data.expertCards.find(c => c.id === 5)!.commands.find(c => c.kind === 'text' && c.y === 120)).toMatchObject({ text: 'Cow\nLife: 20 Years\nEats: 1/4 Bales of Feed Each Month\nMates: 15-20 Months\nGestates: 10 Months' });
});

test('one generated bundle retains all source card commands, message IDs and raw preservation imports', () => {
  expect(hash(read('events.dat'))).toBe('616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb');
  expect(hash(read('qmessage.dat'))).toBe('f49a867d63b52d4157977f6e06dfc231af3689042af3da8ae032cbfcff5594b1');
  expect(hash(Buffer.concat(EXPERT_CARD_IDS.map(id => read(`card${id}.hc`))))).toBe('52aca80ac8d649e09446a7368ee6360f9d89c109a2bc942a7a521d37c25cfdfc');
  const imported = JSON.parse(readFileSync('public/assets/ui-content.json', 'utf8'));
  expect(imported).toEqual(data);
  const decoded = readUiContentJson(imported);
  expect([...decoded.expertDeck.keys()]).toEqual(EXPERT_CARD_IDS);
  for (const id of EXPERT_CARD_IDS) expect(decoded.expertDeck.get(id)).toEqual(readExpertCard(read(`card${id}.hc`)));
  for (const name of ['events.dat', 'qmessage.dat', ...EXPERT_CARD_IDS.map(id => `card${id}.hc`)]) {
    expect(readFileSync(`artifacts/original-assets/${name}`)).toEqual(Buffer.from(read(name)));
  }
  expect(decoded.eventMessages).toHaveLength(63);expect(decoded.editStatuses).toHaveLength(76);
  // events.dat ends with154 bytes of an incomplete row63; qmessage.dat ends with CR/LF.
  expect(read('events.dat').length - decoded.eventMessages.length * 256).toBe(154);
  expect(Array.from(read('qmessage.dat').subarray(76 * 64))).toEqual([13, 10]);
  expect(() => readEventMessage(decoded.eventMessages, 63)).toThrow();
  for (let slot = 0; slot < 24; slot++) {
    const page = expertPage(decoded.expertDeck, slot < 16 ? slot + 10 : slot + 48, 24);
    expect(page.find(c => c.kind === 'crop')).toMatchObject({ slot });
  }
});

test('every complete event and quick-message record is decoded within its original text boundary', () => {
  for (let id = 0; id < 63; id++) {
    const bytes = read('events.dat').subarray(id * 256, (id + 1) * 256);
    const text = new TextDecoder('ascii').decode(bytes.subarray(0, 254)).split('\0')[0];
    expect(data.eventMessages[id].paragraph).toBe(text.replace(/@/g, ' ').replace(/\s+/g, ' ').trim());
    expect(data.eventMessages[id].lines.map(l => l.text).join(' ')).toBe(text.replace(/[@`~]/g, ' ').replace(/\s+/g, ' ').trim());
    expect(data.eventMessages[id].physicalText).toBe(new TextDecoder('ascii').decode(bytes).split(/\r?\n/).map(line => line.replace(/@/g, '').trim()).filter(Boolean).join('\n'));
  }
  for (let id = 0; id < 76; id++) {
    const text = new TextDecoder('ascii').decode(read('qmessage.dat').subarray(id * 64, id * 64 + 62)).split('\0')[0].replace(/@/g, ' ').trim();
    expect(data.editStatuses[id]).toBe(text);expect(readEditStatus(data.editStatuses, id)).toBe(text);
  }
  expect(data.eventMessages[52].lines).toEqual([{ text: 'TORNADO WARNING', centered: true }, { text: 'High winds in the area have spawned a tornado!', centered: false }]);
  expect(data.editStatuses[61]).toBe('Cannot move item in use.');expect(data.editStatuses[68]).toBe('');
});

test('all existing message consumers produce identical display output from JSON and original binaries', () => {
  const messages = readUiContentJson(roundTrip()).eventMessages, bytes = read('events.dat');
  for (const id of Object.keys(FINANCE_MESSAGES).map(Number) as FinanceNoticeId[]) expect(readFinanceMessage(messages, id)).toBe(readFinanceMessage(bytes, id));
  for (const id of Object.keys(DISASTER_MESSAGES) as DisasterNoticeId[]) expect(readDisasterMessage(messages, id)).toEqual(readDisasterMessage(bytes, id));
  expect(readWaterStorageMessage(messages)).toBe(readWaterStorageMessage(bytes));
  expect(readRodeoInvitation(messages)).toBe(readRodeoInvitation(bytes));
  for (const kind of ['field', 'building'] as const) expect(readBulldozeMessage(messages, kind)).toBe(readBulldozeMessage(bytes, kind));
  expect(readBulldozeMessage(messages, 'field')).toBe('Are you sure you want to destroy this field?');
});

test('bundle validation rejects missing IDs, unknown commands, invalid geometry and unsafe sound/links', () => {
  const mutations = [
    (d: any) => { d.version = 2; },
    (d: any) => { d.expertCards.pop(); },
    (d: any) => { d.expertCards[1].id = 1; },
    (d: any) => { d.expertCards[0].commands[0].kind = 'execute'; },
    (d: any) => { d.expertCards[0].commands[0].x = 400; },
    (d: any) => { d.expertCards[0].commands[0].y = 15; },
    (d: any) => { d.expertCards[0].commands[0].x = 24.5; },
    (d: any) => { d.expertCards[0].commands.find((c: any) => c.kind === 'link').target = 3; },
    (d: any) => { d.expertCards[0].commands.find((c: any) => c.kind === 'picture').card = 80; },
    (d: any) => { d.expertCards[2].commands.find((c: any) => c.kind === 'sound').sound = '../other'; },
    (d: any) => { d.expertCards[2].commands.find((c: any) => c.kind === 'button').caption = 'BAD'; },
    (d: any) => { d.expertCards[1].commands.find((c: any) => c.kind === 'tiles').first = 848; },
    (d: any) => { d.expertCards[6].commands.find((c: any) => c.kind === 'crop').slot = 16; },
    (d: any) => { d.expertCards[0].commands = Array(17).fill({ kind: 'button', x: 336, y: 200, target: 255, caption: 'CLOSE' }); },
    (d: any) => { d.expertCards[0].commands = Array(5).fill({ kind: 'sound', x: 144, y: 24, width: 112, height: 64, sound: 'rooster' }); },
    (d: any) => { d.eventMessages.pop(); },
    (d: any) => { d.eventMessages[52].lines[0].centered = 1; },
    (d: any) => { d.eventMessages[52].paragraph = 'x'.repeat(255); },
    (d: any) => { d.eventMessages[46].physicalText = null; },
    (d: any) => { d.editStatuses.pop(); },
    (d: any) => { d.editStatuses[68] = null; },
    (d: any) => { d.editStatuses[0] = 'x'.repeat(63); },
  ];
  for (const mutate of mutations) { const bad = roundTrip();mutate(bad);expect(() => readUiContentJson(bad)).toThrow(); }
  for (const value of [null, [], {}, 'text']) expect(() => readUiContentJson(value)).toThrow();
  for (const name of ['events.dat', 'qmessage.dat', 'card48.hc']) {
    expect(() => decodeUiContent(n => n === name ? read(n).subarray(0, read(n).length - 1) : read(n))).toThrow();
  }
  const before = JSON.stringify(data);readUiContentJson(data);expect(JSON.stringify(data)).toBe(before);
});
