import { GoodsDefinition } from './inventory';
import type { FinancialState } from './finance';

function fail(): never { throw new Error('Invalid native save: financial state'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function number(value: unknown, max = 0xffffffff): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) fail();
  return value;
}
function array(value: unknown, length: number): Uint8Array {
  if (!Array.isArray(value) || value.length !== length) fail();
  return Uint8Array.from(value.map(n => number(n, 255)));
}
function fields<K extends string>(value: unknown, keys: readonly K[]): Record<K, number> {
  const o = object(value);
  return Object.fromEntries(keys.map(k => [k, number(o[k])])) as Record<K, number>;
}
function definitions(value: unknown, count: number, base?: number): GoodsDefinition[] {
  if (!Array.isArray(value) || value.length !== count) fail();
  return value.map((v, i) => {
    const d = new GoodsDefinition(array(v, 18));
    if (base !== undefined && d.type !== base + i) fail();
    return d;
  });
}

export function encodeFinancialState(f: FinancialState) {
  return { ...f, accounts: { ...f.accounts, assets: { ...f.accounts.assets,
    animalDefinitions: f.accounts.assets.animalDefinitions.map(d => [...d.bytes]) },
    otherDefinitions: f.accounts.otherDefinitions.map(d => [...d.bytes]) },
    town: { ...f.town, recreationCoordinates: [...f.town.recreationCoordinates] },
    clearing: { ...f.clearing, x: [...f.clearing.x], y: [...f.clearing.y] } };
}

/** Every member is mandatory in version 3. Do not silently replace damaged
 * financial state with original-scenario balances or rerun startup. */
export function decodeFinancialState(value: unknown): FinancialState {
  const f = object(value), a = object(f.accounts), assets = object(a.assets), debt = object(f.debt), town = object(f.town);
  const site = object(town.activeSite), clearing = object(f.clearing);
  const result: FinancialState = {
    accounts: { ...fields(a, ['buildingBookValue', 'landIncome', 'equipmentExpenses', 'balancePayments', 'taxExpenses']),
      homeRegionX: number(a.homeRegionX, 11), homeRegionY: number(a.homeRegionY, 11),
      assets: { ...fields(assets, ['equipmentBookValue', 'equipmentIncome', 'livestockIncome']),
        // The source's fifth definition repeats type 163. Preserve every byte.
        animalDefinitions: definitions(assets.animalDefinitions, 5) },
      otherDefinitions: definitions(a.otherDefinitions, 17, 288) },
    annual: fields(f.annual, ['priorTaxExpenses', 'ds3e70', 'ds3e8c', 'ds3e90', 'ds3e94', 'ds3e9c',
      'livestockExpenses', 'otherExpenses', 'reportIncome', 'reportExpenses', 'reportNet']),
    debt: { ...fields(debt, ['balanceDue', 'unpaidTaxes']), balanceCountdown: number(debt.balanceCountdown, 255), taxCountdown: number(debt.taxCountdown, 255) },
    loan: fields(f.loan, ['principal', 'scheduledPayment', 'availableCredit', 'selectedAmount']),
    loanRate: number(f.loanRate, 65535), taxFailures: number(f.taxFailures, 255),
    town: { ...fields(town, ['townRevenue', 'expansionFunds']), developmentSpent: number(town.developmentSpent, 65535),
      activeSite: { regionX: number(site.regionX, 11), regionY: number(site.regionY, 11) },
      airportCount: number(town.airportCount, 255), recreationCount: number(town.recreationCount, 255),
      recreationCoordinates: array(town.recreationCoordinates, 16) },
    clearing: { cursor: number(clearing.cursor, 63), count: number(clearing.count, 64), lastTick: number(clearing.lastTick, 65535),
      x: array(clearing.x, 64), y: array(clearing.y, 64) },
  };
  for (let i = 0; i < 64; i++) if (result.clearing.x[i] !== 255 && (result.clearing.x[i] >= 96 || result.clearing.y[i] >= 96)) fail();
  return result;
}
