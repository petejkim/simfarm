import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { loanCreditLimit, loanInstallment } from '../src/simulation/loan';
import { ownedLandValue } from '../src/simulation/tax';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('loan calculator pins original arithmetic helpers and credit dialog target, not the adjacent signed valuation', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x47712, '9a92348400');
  exact(0x47719, '9af8338400'); exact(0x47726, '9af8338400'); exact(0x476fd, 'c1e00299');
  exact(0x47743, 'c746f80100c746fa0000'); exact(0x5efb, 'f7e103d3');
  exact(0x47028, '9ac612e624'); exact(0x2832a, '682ece270f00');
  exact(0x3da38, '9a10358400'); exact(0x5f63, 'e82800'); exact(0x5fa2, 'f7f1');
  exact(0x3da2a, '0146fc1156fe'); exact(0x3da41, '263916b0b3');
  assert.equal(e.readUInt16LE(0x846f0 + 0xb3a4), 15);
});

test('loan installments preserve all rate/term word and signed-dword boundaries against an independent integer oracle', () => {
  function oracle(amount: number, rate: number, term: number) {
    if (!amount) return 0;
    const divisor = BigInt.asIntN(16, BigInt(term) * 4n);
    if (!divisor) throw new Error('zero divisor');
    const interest = BigInt.asIntN(32, BigInt(amount) * BigInt(rate)) / 100n;
    const result = BigInt.asIntN(32, BigInt(amount) + interest) / divisor;
    return Number(BigInt.asUintN(32, BigInt.asIntN(32, BigInt(amount)) > 0n && result === 0n ? 1n : result));
  }
  for (const amount of [0, 1, 19, 20, 99, 100, 10000, 9999999, 0x7fffffff, 0x80000000, 0xffffffff]) {
    for (const rate of [0, 8, 15, 100, 32767, 65535]) for (const term of [1, 5, 8191, 8192, 16383, 16384, 32767, 65535]) {
      if (amount && term === 16384) assert.throws(() => loanInstallment(amount, rate, term));
      else assert.equal(loanInstallment(amount, rate, term), oracle(amount, rate, term));
    }
  }
  assert.equal(loanInstallment(10000, 15), 575); assert.equal(loanInstallment(1, 0), 1);
  assert.equal(loanInstallment(0, 15, 0), 0);
  for (const args of [[-1, 15, 5], [1, 65536, 5], [1, 15, 65536], [1, 15, 0], [NaN, 15, 5]]) assert.throws(() => loanInstallment(...args as [number, number, number]));
});

test('loan credit uses all original farms and only land/building collateral, unsigned division and principal subtraction', () => {
  for (let id = 0; id < 8; id++) {
    const world = readScenario(source(`SCEN${id}.SSM`)), before = JSON.stringify(world);
    for (const moisture of [-128, 0, 8, 127]) for (const book of [0, 100, 0x7fffffff, 0x80000000, 0xffffffff]) {
      const land = ownedLandValue(world, moisture), gross = Number(BigInt.asUintN(32, BigInt(land) + BigInt(book)) / 3n);
      for (const principal of [0, gross, gross + 1, 0xffffffff]) assert.equal(loanCreditLimit(world, book, principal, moisture), Math.max(0, gross - principal));
    }
    assert.equal(JSON.stringify(world), before);
    const limit = loanCreditLimit(world, 100, 0, 8); world.farm.cash = 0xffffffff;
    assert.equal(loanCreditLimit(world, 100, 0, 8), limit);
  }
});

test('invalid collateral inputs reject without modifying a farm', () => {
  const world = readScenario(source('SCEN0.SSM')), before = JSON.stringify(world);
  for (const [book, principal, moisture] of [[-1, 0, 8], [0, 0x100000000, 8], [NaN, 0, 8], [0, 0, 128]]) assert.throws(() => loanCreditLimit(world, book, principal, moisture));
  assert.equal(JSON.stringify(world), before);
});
