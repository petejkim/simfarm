import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Binary } from '../src/formats/binary';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { FarmRandom } from '../src/simulation/random';
import { ageAnimals, beginAnimalPregnancies, advanceAnimalGestation } from '../src/simulation/animal-lifecycle';
import { allocateAnimal, ANIMAL_ADULT_WEEKS, ANIMAL_GESTATION_WEEKS, ANIMAL_LIFESPAN_WEEKS } from '../src/simulation/animal-allocation';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { storeMovingAnimal } from '../src/simulation/animal-world';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4, type = 161) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const a of world.animals) a.flags = 0;
  for (const b of world.buildings) b.flags = 0;
  for (const d of finances.accounts.assets.animalDefinitions) d.count = 0;
  for (const c of world.cells) { c.terrain = 15; c.overlay = 0x800; c.attribute = 0; }
  const random = new FarmRandom({ visual: 0x1234, simulation: 2, bounded: 99 });
  const a = allocateAnimal(world, finances, random, type, 10, 10)!;
  return { world, finances, random, a, v: new Binary(a.bytes).view };
}

test('animal lifecycle pins original age/gestation tables, monthly predicate, weekly trigger and direct old-age deletion', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => e.readUInt16LE(0x846f0 + 0x2288 + i * 2)), [...ANIMAL_LIFESPAN_WEEKS]);
  assert.deepEqual([...e.subarray(0x86980, 0x86984)], [...ANIMAL_ADULT_WEEKS]);
  assert.deepEqual([...e.subarray(0x86984, 0x86988)], [...ANIMAL_GESTATION_WEEKS]);
  exact(0xc16b, '9ad000fd05247f3c4b'); exact(0xc203, '9adc00870f');
  exact(0x12c86, '2680bf08646e'); exact(0x12cfa, '26fe871c64'); exact(0x12d72, '9ab410e624');
});

test('all source farms preserve birth initialization, coordinates, random streams and asset postings without cash or terrain changes', () => {
  for (let id = 0; id < 8; id++) for (let type = 160; type <= 163; type++) {
    const f = setup(id, type), { world, finances, a } = f;
    a.flags |= 3; a.bytes[28] = ANIMAL_GESTATION_WEEKS[type - 160];
    const free = world.animals[2]; free.bytes.fill(0xa5); free.flags = 0;
    const expected = Uint8Array.from(free.bytes), ev = new DataView(expected.buffer);
    expected[0] = expected[1] = 10; ev.setUint16(2, 34, true); expected[4] = 2; expected[5] = 1;
    ev.setUint16(6, type, true); expected[8] = 255; ev.setUint16(10, 0, true); expected[12] = 1;
    expected[13] = expected[14] = 0; ev.setUint16(16, 0, true); expected[18] = 0; ev.setUint16(20, 0, true);
    ev.setUint16(26, ANIMAL_GESTATION_WEEKS[type - 160], true); expected[28] = 0;
    const random = new FarmRandom({ visual: 0x1234, simulation: 2, bounded: 99 });
    const cells = JSON.stringify(world.cells), cash = world.farm.cash, annual = structuredClone(finances.annual), asset = finances.statistics.ds3e5c;
    assert.deepEqual(advanceAnimalGestation(world, finances, random), [{ kind: 'born', slot: 2, animalType: type, parentSlot: 1 }]);
    assert.deepEqual(free.bytes, expected); assert.equal(a.flags & 1, 0); assert.equal(a.bytes[28], 0);
    assert.equal(finances.accounts.assets.animalDefinitions[type - 160].count, 2);
    assert.equal(finances.statistics.ds3e5c, (asset + finances.accounts.assets.animalDefinitions[type - 160].price) >>> 0);
    assert.equal(world.farm.cash, cash); assert.deepEqual(finances.annual, annual); assert.equal(JSON.stringify(world.cells), cells);
    assert.deepEqual(random.snapshot(), { visual: 0x9712, simulation: 1, bounded: 99 });
  }
});

test('monthly breeding uses strict maturity/condition and flag predicates without a mate, ownership or cash requirement', () => {
  for (let type = 160; type <= 163; type++) {
    const f = setup(4, type); f.world.farm.cash = 0; f.world.cells[worldIndex(10, 10)].overlay = 0;
    for (const age of [ANIMAL_ADULT_WEEKS[type - 160], ANIMAL_ADULT_WEEKS[type - 160] + 1]) for (let health = 0; health <= 255; health++) {
      f.v.setUint16(10, age, true); f.a.bytes[8] = health; f.a.flags = 34; f.a.bytes[28] = 55;
      const eligible = age > ANIMAL_ADULT_WEEKS[type - 160] && health > 110;
      assert.deepEqual(beginAnimalPregnancies(f.world), eligible ? [1] : []);
      assert.equal(f.a.bytes[28], eligible ? 0 : 55); assert.equal(f.a.flags, eligible ? 35 : 34);
    }
    for (const flags of [0, 32, 33, 35, 38, 42]) {
      f.a.flags = flags; f.v.setUint16(10, 200, true); f.a.bytes[8] = 255; f.a.bytes[28] = 55;
      const eligible = (flags & 34) === 34 && !(flags & 1);
      assert.deepEqual(beginAnimalPregnancies(f.world), eligible ? [1] : []);
    }
  }
});

test('gestation queues births before allocation, wraps its byte and retains original capacity failure behavior', () => {
  for (let type = 160; type <= 163; type++) for (const counter of [0, ANIMAL_GESTATION_WEEKS[type - 160] - 1, ANIMAL_GESTATION_WEEKS[type - 160], 255]) {
    const f = setup(4, type); f.a.flags = 35; f.a.bytes[28] = counter;
    const born = ((counter + 1) & 255) > ANIMAL_GESTATION_WEEKS[type - 160];
    assert.equal(advanceAnimalGestation(f.world, f.finances, f.random).length, Number(born));
    assert.equal(f.a.bytes[28], born ? 0 : (counter + 1) & 255);
    if (born) assert.equal(f.world.animals[2].ageWeeks, 0);
  }
  const f = setup(4, 163);
  // A high-slot parent can produce into an inactive low slot; the newborn is not scanned again.
  f.world.animals[255].bytes.set(f.a.bytes); f.a.flags = 0;
  const parent = f.world.animals[255]; parent.flags |= 3; parent.bytes[28] = 24;
  assert.deepEqual(advanceAnimalGestation(f.world, f.finances, f.random), [{ kind: 'born', slot: 1, animalType: 163, parentSlot: 255 }]);
  assert.equal(f.a.bytes[28], 0);
  for (const a of f.world.animals.slice(1)) { a.bytes.set(f.a.bytes); a.flags = 32; }
  parent.flags = 35; parent.bytes[28] = 24; f.finances.accounts.assets.animalDefinitions[3].count = 255;
  const rng = f.random.snapshot(), asset = f.finances.statistics.ds3e5c;
  assert.deepEqual(advanceAnimalGestation(f.world, f.finances, f.random), [{ kind: 'birth-capacity', slot: 255, animalType: 163 }]);
  assert.equal(parent.flags, 34); assert.equal(parent.bytes[28], 0);
  assert.deepEqual(f.random.snapshot(), rng); assert.equal(f.finances.statistics.ds3e5c, asset);
});

test('weekly aging uses exact thresholds, vocal RNG, adult image and wrapped age without skipping deaths', () => {
  for (let type = 160; type <= 163; type++) for (const age of [ANIMAL_ADULT_WEEKS[type - 160] - 1, ANIMAL_ADULT_WEEKS[type - 160],
    ANIMAL_LIFESPAN_WEEKS[type - 160] - 1, ANIMAL_LIFESPAN_WEEKS[type - 160], 65535]) {
    const f = setup(4, type); f.v.setUint16(10, age, true);
    const random = new FarmRandom({ visual: 0x1234, simulation: 150, bounded: 99 }), asset = f.finances.statistics.ds3e5c;
    const result = ageAnimals(f.world, f.finances, random), next = (age + 1) & 65535;
    assert.equal(f.a.ageWeeks, next); assert.equal(f.a.bytes[18], Number(next > ANIMAL_ADULT_WEEKS[type - 160]));
    assert.equal(f.a.active, next <= ANIMAL_LIFESPAN_WEEKS[type - 160]);
    assert.deepEqual(result.sounds, [{ 160: 'horse1.voc', 161: 'cow1.voc', 162: 'pig.voc', 163: 'sheep1.voc' }[type]]);
    assert.equal(random.snapshot().simulation, 75); assert.equal(random.snapshot().visual, type === 161 || type === 163 ? 0x9712 : 0x1234);
    assert.equal(result.notices.length, Number(!f.a.active)); assert.equal(f.finances.statistics.ds3e5c, asset);
    assert.equal(f.finances.accounts.assets.animalDefinitions[type - 160].count, Number(f.a.active));
  }
  const f = setup(); const other = allocateAnimal(f.world, f.finances, f.random, 161, 11, 10)!;
  f.v.setUint16(10, 960, true); new Binary(other.bytes).view.setUint16(10, 960, true);
  assert.equal(ageAnimals(f.world, f.finances, f.random).notices.length, 2);
  assert.equal(f.finances.accounts.assets.animalDefinitions[1].count, 0);
});

test('stored old-age deaths clean storage and invalid lifecycle state rejects before age, random or count mutations', () => {
  const f = setup(); f.world.farm.cash = 100000;
  const result = purchaseBuilding(f.world, f.finances, 68, 20, 20, 0); assert.ok(result.ok);
  const b = f.world.buildings[result.slot]; assert.ok(storeMovingAnimal(f.world, f.finances, f.a, b));
  f.v.setUint16(10, 960, true); assert.equal(ageAnimals(f.world, f.finances, f.random).notices.length, 1);
  assert.equal(b.content(0).type, -1); assert.equal(f.a.active, false);
  const bad = setup(); bad.a.bytes[0] = 96;
  const state = () => JSON.stringify({ world: bad.world, finances: bad.finances, random: bad.random.snapshot() }), saved = state();
  assert.throws(() => ageAnimals(bad.world, bad.finances, bad.random), /state/);
  assert.throws(() => advanceAnimalGestation(bad.world, bad.finances, bad.random), /state/);
  assert.throws(() => beginAnimalPregnancies(bad.world), /state/); assert.equal(state(), saved);
  bad.a.bytes[0] = 10; bad.v.setUint16(10, 960, true); bad.finances.accounts.assets.animalDefinitions[1].count = 0;
  const invalidCount = state(); assert.throws(() => ageAnimals(bad.world, bad.finances, bad.random), /definition/); assert.equal(state(), invalidCount);
});
