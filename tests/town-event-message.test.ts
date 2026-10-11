import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { FAIR_ANIMALS, TOWN_EVENT_TEXT, townEventMessage } from '../src/ui/town-event-message';

const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const exe = source('SIMFARM.EXE');
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const events = archive.find(a => a.name === 'events.dat')!.bytes;

test('fair names, message templates, portrait arithmetic and button IDs match source bytes', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const string = (ds: number) => exe.subarray(0x846f0 + ds, exe.indexOf(0, 0x846f0 + ds)).toString('ascii');
  for (const [name, ds] of Object.entries({ announcement: 0x1fba, entry: 0x1fd5,
    fairWin: 0x20fe, fairLoss: 0x212a, rodeoWin: 0x20a1, rodeoLoss: 0x20cf })) {
    assert.equal(TOWN_EVENT_TEXT[name as keyof typeof TOWN_EVENT_TEXT], string(ds));
  }
  assert.equal(string(0x2045), TOWN_EVENT_TEXT.announcement);
  FAIR_ANIMALS.forEach((animal, i) => {
    assert.equal(animal.species, string(0x22a0 + i * 7));
    assert.equal(animal.name, string(0x22bc + i * 7));
  });
  for (const [offset, hex] of [[0xcab8, '6a0c6a0b6a4a'], [0xcb69, '6a0c6a0b6a4a'],
    [0xdc21, '6a006a016a4b'], [0xdc50, '6a006a126a4c'], [0xdcc2, 'a0d91e9805460050'],
    [0xdd1b, '6a006a016a4a']] as const) {
    assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  }
});

test('fair entry and both outcomes use all four source names without changing canonical decisions', () => {
  FAIR_ANIMALS.forEach((animal, animalType) => {
    const entry = { animalType, pending: { kind: 'fair-entry' as const } };
    const original = structuredClone(entry);
    assert.deepEqual(townEventMessage(entry, events), {
      text: `The Town Fair is starting! Would you like to enter ${animal.name} the ${animal.species} in the ${animal.species} judging contest? Entry fee is 200 dollars`,
      portrait: 74, buttons: [{ caption: 'YES', accept: true }, { caption: 'NO', accept: false }],
    });
    assert.deepEqual(entry, original);
    for (const won of [false, true]) {
      // Results retain the animal drawn before the modal; do not substitute a later global value.
      const state = { animalType: 255, pending: { kind: 'fair-result' as const, animalType, won } };
      const before = structuredClone(state), message = townEventMessage(state, events)!;
      assert.equal(message.text, won ? `${animal.name} WON FIRST PRIZE!!! You Win 1000 Dollars!` : `${animal.name} LOST! Well, maybe next year.`);
      assert.equal(message.portrait, won ? 70 + animalType : 74);
      assert.deepEqual(message.buttons, [{ caption: 'OK', accept: true }]);
      assert.deepEqual(state, before);
    }
  });
  for (const animalType of [-1, 4, 255, NaN, 1.5]) {
    assert.throws(() => townEventMessage({ animalType, pending: { kind: 'fair-entry' } }, events));
    assert.throws(() => townEventMessage({ animalType: 0, pending: { kind: 'fair-result', animalType, won: true } }, events));
  }
});

test('announcement and rodeo retain source invitation, net-profit wording and RATS acknowledgement', () => {
  assert.equal(townEventMessage({ animalType: 255, pending: null }, events), null);
  assert.deepEqual(townEventMessage({ animalType: 255, pending: { kind: 'fair-announcement' } }, events), {
    text: 'The town fair is starting!', portrait: 74, buttons: [{ caption: 'OK', accept: true }],
  });
  const entry = townEventMessage({ animalType: 255, pending: { kind: 'rodeo-entry' } }, events)!;
  assert.equal(entry.text, "The Town Rodeo is starting! Your cousin Jed wants to know if you'll bet 500 bucks on him to win! If he wins you'll get 1,000 dollars back.");
  assert.equal(entry.portrait, 74);
  assert.deepEqual(entry.buttons, [{ caption: 'YES', accept: true }, { caption: 'NO', accept: false }]);
  for (const won of [false, true]) {
    const message = townEventMessage({ animalType: 255, pending: { kind: 'rodeo-result', animalType: 255, won } }, events)!;
    assert.equal(message.text, won ? TOWN_EVENT_TEXT.rodeoWin : TOWN_EVENT_TEXT.rodeoLoss);
    assert.equal(message.portrait, won ? 75 : 76);
    assert.deepEqual(message.buttons, [{ caption: won ? 'OK' : 'RATS', accept: true }]);
  }
});
