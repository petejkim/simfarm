import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { shopFixture } from './support/livestock';
import { BULLDOZE_TITLE_COST, PALETTE_TOOL_TYPES, formatToolCost, toolCost } from '../src/ui/tool-cost';
import { EDIT_TOOL_STATUSES, SPRAY_STATUSES } from '../src/simulation/edit-status';

const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url)), DS = 0x846f0;
const u16 = (offset: number) => exe.readUInt16LE(offset);

test('palette handlers select the priced item records the native table names', () => {
  // `mov ax, record` immediately before `mov es:[fa3a], ax` in each mode-4 palette handler.
  const handlers: [number, keyof typeof PALETTE_TOOL_TYPES][] = [
    [0x21830, 'fence'], [0x218ec, 'gate'], [0x219a8, 'hay'], [0x21a64, 'trough'], [0x21b22, 'road-150'],
    [0x21bb4, 'road-161'], [0x21c9e, 'trees'], [0x21dfc, 'valve'], [0x21eb8, 'ditch'],
  ];
  for (const [at, tool] of handlers) {
    expect(exe[at]).toBe(0xb8); const record = u16(at + 1);
    expect(u16(DS + record + 2)).toBe(PALETTE_TOOL_TYPES[tool]);
  }
  // Plant selects DS74c0 (type 302); the Edit title pushes 25 for Bulldoze.
  expect([...exe.subarray(0x38374, 0x38381)]).toEqual([0x26, 0xc7, 0x06, 0x3a, 0xfa, 0xc0, 0x74, 0x26, 0xc7, 0x06, 0x3c, 0xfa, 0x90]);
  expect(u16(DS + 0x74c0 + 2)).toBe(302);
  expect([...exe.subarray(0x20388, 0x2038a)]).toEqual([0x6a, BULLDOZE_TITLE_COST]);
});

test('costs come from the live definitions and follow only the selection message', () => {
  const f = shopFixture(), { scenario, finances } = f.state, other = (type: number) => finances.accounts.otherDefinitions[type - 288].price;
  expect(toolCost(scenario, finances, { kind: 'construction', tool: 'road-150' }, EDIT_TOOL_STATUSES['Paved road'])).toBe(other(293));
  expect(toolCost(scenario, finances, { kind: 'construction', tool: 'road-150' }, 42)).toBeNull(); // a later message
  expect(toolCost(scenario, finances, { kind: 'bulldoze' }, EDIT_TOOL_STATUSES.Bulldoze)).toBe(25);
  expect(toolCost(scenario, finances, { kind: 'field', tool: { kind: 'plant', cropSlot: 0 } }, 17)).toBe(other(302));
  expect(toolCost(scenario, finances, { kind: 'field', tool: { kind: 'fungicide' } }, SPRAY_STATUSES.fungicide)).toBe(scenario.chemicalDefinitions[3].price);
  expect(toolCost(scenario, finances, null, 64)).toBeNull();
  // itoa formats the word as signed decimal.
  finances.accounts.otherDefinitions[293 - 288].bytes.set([0x30, 0x9c], 6);
  expect(toolCost(scenario, finances, { kind: 'construction', tool: 'road-150' }, EDIT_TOOL_STATUSES['Paved road'])).toBe(-25552);
  expect([formatToolCost(30), formatToolCost(1200), formatToolCost(-25552)]).toEqual(['$30', '$1,200', '-$25,552']);
});
