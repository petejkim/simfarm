import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHEAT_MESSAGES } from '../src/ui/CheatMessage';
import type { GameEvent } from '../src/simulation/events';
import { shopFixture } from './support/livestock';

const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url)), ds = 0x846f0;
const cstring = (offset: number) => exe.subarray(ds + offset, exe.indexOf(0, ds + offset)).toString('latin1');

test('cheat codes, messages and portraits match the original keyboard path', () => {
  assert.deepEqual([0x21ef, 0x221e, 0x226d].map(cstring), ['LLAMA', 'FUND', 'CORN']);
  assert.equal(cstring(0x21f5), CHEAT_MESSAGES.llama.text);
  assert.equal(cstring(0x2223), CHEAT_MESSAGES.fund.text);
  // Each code is compared on Enter (0x0d) by exact strcmp0x4fac (repe cmpsb), then shown through popup0636:10f4.
  assert.equal(exe.subarray(0xf72a, 0xf72e).toString('hex'), '807ef00d');
  assert.equal(exe.subarray(0x4fc5, 0x4fc7).toString('hex'), 'f3a6');
  assert.equal(exe.subarray(0xf75e, 0xf764).toString('hex'), '6a191e68f521');
  assert.equal(exe[0xf75f], CHEAT_MESSAGES.llama.portrait); assert.equal(exe[0xf793], CHEAT_MESSAGES.fund.portrait);
  // FUND: add/adc 10000 to DS758e/7590; CORN: add/adc 10000 to DS3e48/3e4a (cash).
  assert.equal(exe.subarray(0xf7a4, 0xf7b1).toString('hex'), '2681068e751027268316907500');
  assert.equal(exe.subarray(0xf7cc, 0xf7d9).toString('hex'), '268106483e10272683164a3e00');
});

test('Debug cheats change only their original balance, wrap at 32 bits and publish their popups', () => {
  const f = shopFixture(), game = f.load(), events: GameEvent[] = []; game.subscribeEvents(e => events.push(e));
  const cash = game.getSnapshot().scenario.farm.cash, fund = game.getSnapshot().finances.town.expansionFunds;
  const before = JSON.parse(game.save(4));
  game.dispatch({ type: 'debug-cheat', code: 'LLAMA' });
  assert.deepEqual(events, [{ type: 'cheat-notice', id: 'llama' }]); assert.deepEqual(JSON.parse(game.save(4)), before);
  game.dispatch({ type: 'debug-cheat', code: 'FUND' });
  assert.equal(game.getSnapshot().finances.town.expansionFunds, fund + 10000); assert.equal(game.getSnapshot().scenario.farm.cash, cash);
  assert.deepEqual(events.at(-1), { type: 'cheat-notice', id: 'fund' });
  events.length = 0; game.dispatch({ type: 'debug-cheat', code: 'CORN' });
  assert.equal(game.getSnapshot().scenario.farm.cash, cash + 10000); assert.deepEqual(events, []); // CORN is silent
  f.state.scenario.farm.cash = 0xffffffff - 5000; f.state.finances.town.expansionFunds = 0xfffffff0;
  const wrap = f.load(); wrap.dispatch({ type: 'debug-cheat', code: 'CORN' }); wrap.dispatch({ type: 'debug-cheat', code: 'FUND' });
  assert.equal(wrap.getSnapshot().scenario.farm.cash, 4999); assert.equal(wrap.getSnapshot().finances.town.expansionFunds, 9984);
  assert.throws(() => game.dispatch({ type: 'debug-cheat', code: 'llama' as 'LLAMA' }), /Invalid cheat code/);
});
