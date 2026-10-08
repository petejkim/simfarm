import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { readCrop } from '../src/formats/crop';
import { FarmRandom } from '../src/simulation/random';
import { advanceAnimalFrame, moveAnimal, type AnimalMovementContext } from '../src/simulation/animal-movement';
import { ANIMAL_STEPS, animalCanWalk, animalDirection, animalHerdTarget, createAnimalFrameState,
  refreshAnimalHerd, stepStoredAnimal, storeMovingAnimal } from '../src/simulation/animal-world';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(type = 160, id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const a of world.animals) a.flags = 0;
  for (const b of world.buildings) b.flags = 0;
  for (const i of world.inventory) i.bytes[10] &= ~32;
  for (const f of world.fields) f.bytes[7] &= ~1;
  for (const c of world.cells) { c.terrain = 15; c.overlay = 0x800; }
  const a = world.animals[255]; a.bytes.fill(0); a.flags = 32; a.bytes[0] = a.bytes[1] = 20; a.bytes[6] = type; a.bytes[8] = 200;
  finances.accounts.assets.animalDefinitions[type - 160].count = 1;
  const crops = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)).rawDefinition);
  const context: AnimalMovementContext = { tick: 16, frame: createAnimalFrameState(),
    random: new FarmRandom({ visual: 0x1234, simulation: 2, bounded: 99 }),
    crops, pointer: null };
  const cell = (x: number, y: number) => world.cells[worldIndex(x, y)]; cell(a.x, a.y).terrain |= 0x800;
  const supply = (slot: number, type: number, x: number, y: number, quantity = 512) => {
    const i = world.inventory[slot], v = new DataView(i.bytes.buffer, i.bytes.byteOffset, i.bytes.byteLength);
    v.setUint16(0, type, true); v.setUint16(2, quantity, true); i.bytes[8] = x; i.bytes[9] = y; i.bytes[10] = 32;
    finances.accounts.otherDefinitions[type - 288].count = 1;
    cell(x, y).terrain = type === 299 ? 176 : 0x80f; cell(x, y).overlay = 0x800 | (type === 299 ? 15 : 1020);
    return i;
  };
  const building = (slot = 1, type = 68, x = 21, y = 20) => {
    const b = world.buildings[slot]; b.bytes.fill(0); b.flags = 32; b.bytes[0] = type; b.bytes[4] = x; b.bytes[5] = y;
    for (let n = 0; n < 12; n++) b.clearContent(n);
    const d = world.buildingDefinitions[type - 64];
    for (let dx = 0; dx < d.width; dx++) for (let dy = 0; dy < d.height; dy++) cell(x + dx, y + dy).terrain = (type === 68 ? 460 : 469) + dy * d.width + dx;
    return b;
  };
  return { world, finances, a, context, crops, cell, supply, building, move: () => moveAnimal(world, finances, a.slot, context) };
}

test('animal walkability pins original tables, all terrain images, masking, edges and equal-direction correction', () => {
  const e = source('SIMFARM.EXE'), base = 0x4ec60;
  for (const [graphic, tile, count] of [[0, 15, 16], [4, 150, 11], [5, 161, 11], [34, 962, 16], [37, 946, 16],
    [62, 131, 16], [78, 177, 11], [79, 175, 2], [80, 188, 4], [145, 535, 4]]) {
    assert.equal(e.readUInt16LE(base + 0x85e + graphic * 2), tile); assert.equal(e[base + 0x99e + graphic], count);
  }
  assert.equal(e.subarray(0x133ac, 0x133b1).toString('hex'), '26030ea808');
  assert.deepEqual([...e.subarray(0x869d0, 0x869e0)], [4, 5, 6, 7, 0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7]);
  const f = setup(), accepted = new Set([12, 36, 175, 176, 189, 191, 192, 193]);
  for (const [lo, hi] of [[15, 31], [150, 172], [535, 539], [131, 147], [680, 840]]) for (let n = lo; n <= hi; n++) accepted.add(n);
  for (let tile = 0; tile < 2048; tile++) for (const masked of [false, true]) for (const overlay of [961, 962, 963, 946, 1020]) {
    f.cell(10, 10).terrain = 0xa000 | tile | (masked ? 0x800 : 0); f.cell(10, 10).overlay = 0xb800 | overlay;
    assert.equal(animalCanWalk(f.world, 10, 10), accepted.has(tile) && (!masked || overlay === 962));
  }
  for (const [x, y] of [[-1, 0], [96, 0], [0, 96], [0, -1], [0.5, 0], [NaN, 0]]) assert.equal(animalCanWalk(f.world, x, y), false);
  for (let d = 0; d < 8; d++) {
    const [dx, dy] = ANIMAL_STEPS[d]; assert.equal(animalDirection(10, 10, 10 + dx, 10 + dy), d);
    assert.equal(animalDirection(10, 10, 10 + dx, 10 + dy, true), (d + 4) & 7);
  }
  assert.equal(animalDirection(10, 10, 10, 10), 0); assert.equal(animalDirection(10, 10, 10, 10, true), 0);
});

test('all species and directions move one original tile with flags, record bytes and RNG intact on all source farms', () => {
  for (let id = 0; id < 8; id++) for (let species = 0; species < 4; species++) {
    const f = setup(160 + species, id);
    for (let direction = 0; direction < 8; direction++) {
      f.a.bytes[0] = f.a.bytes[1] = 20; f.a.bytes[4] = direction; f.a.bytes[14] = 255; f.a.bytes[18] = 1;
      const [dx, dy] = ANIMAL_STEPS[direction], dest = f.cell(20 + dx, 20 + dy), origin = f.cell(20, 20);
      dest.terrain = 0xa00f; dest.overlay = 0xb800; origin.terrain = 0x880f; origin.overlay = 0xc000 | 946;
      const raw = [...f.a.bytes], random = f.context.random.snapshot();
      assert.deepEqual(f.move(), { moved: true, stored: false, notices: [], sounds: [] });
      raw[0] += dx; raw[1] += dy; assert.deepEqual([...f.a.bytes], raw);
      assert.equal(origin.terrain, 0x800f); assert.equal(origin.overlay, 0xc000 | 946);
      assert.equal(dest.terrain, 0xa80f); assert.equal(dest.overlay, 0xb800 | ([946, 962, 978, 994][species] + direction * 2 + 1));
      assert.deepEqual(f.context.random.snapshot(), random);
    }
  }
  const f = setup(); f.a.bytes[0] = f.a.bytes[1] = 0; f.a.bytes[4] = 7; f.a.bytes[14] = 255;
  assert.equal(f.move().moved, false); assert.equal(f.a.x, 0); assert.equal(f.a.y, 0); assert.equal(f.a.bytes[4], 6);
});

test('resource and crop seeking uses strict nearest ties, water priority, exact perturbation draws and crop grazing', () => {
  const f = setup(); f.a.bytes[14] = 4; f.a.bytes[13] = 255;
  f.supply(1, 299, 22, 20); f.supply(2, 299, 18, 20); f.supply(3, 300, 20, 22);
  f.move(); assert.equal(f.a.x, 21); assert.equal(f.a.y, 20); assert.equal(f.context.random.snapshot().simulation, 1);
  const g = setup(); g.a.bytes[13] = 11; g.supply(1, 300, 22, 20); g.supply(2, 299, 18, 20, 0);
  g.context.random = new FarmRandom({ visual: 0x1234, simulation: 12, bounded: 99 }); // First simulation value6 perturbs feed direction.
  g.move(); assert.equal(g.a.bytes[4], 3); assert.equal(g.a.x, 21); assert.equal(g.a.y, 21);
  const h = setup(); h.a.bytes[13] = 11;
  const field = h.world.fields[97]; field.bytes[7] |= 1; field.bytes[10] = field.bytes[11] = 21; field.bytes[12] = field.bytes[13] = 10;
  field.bytes[14] = 0; h.crops[0][62] &= ~4;
  h.cell(21, 21).terrain = 0xa000 | 688;
  new DataView(field.bytes.buffer, field.bytes.byteOffset).setUint16(18, 65000, true);
  h.move(); assert.equal(h.a.x, 21); assert.equal(h.a.y, 21); assert.equal(h.a.bytes[13], 0);
  assert.equal(h.cell(21, 21).terrain, 0xa824); assert.equal(new DataView(field.bytes.buffer, field.bytes.byteOffset).getUint16(18, true), 65535);
});

test('blocked fences, wander countdown and collision recovery preserve source random-stream ordering', () => {
  const f = setup(); f.a.bytes[14] = 255; f.a.bytes[4] = 2; f.cell(21, 20).terrain = 0xa000 | 177;
  f.context.random = new FarmRandom({ visual: 0x1234, simulation: 10, bounded: 99 });
  assert.deepEqual(f.move(), { moved: false, stored: false, notices: [67], sounds: [] });
  assert.equal(f.cell(21, 20).terrain, 0xa000 | 192); assert.equal(f.a.bytes[5], 8); assert.equal(f.a.bytes[4], 4);
  assert.equal(f.context.random.snapshot().simulation, 0x3502);
  f.move(); assert.equal(f.a.bytes[5], 7); assert.equal(f.a.bytes[4], 2); assert.equal(f.a.x, 21);
  assert.equal(f.context.random.snapshot().visual, 0x9712);
  for (const type of [160, 161, 162, 163]) {
    const g = setup(type); g.a.flags |= 8; g.a.bytes[14] = 255; g.a.bytes[4] = 2; g.context.tick = 640;
    g.move(); assert.ok(g.a.flags & 8); assert.equal(g.cell(21, 20).overlay & 0x7ff, type + 878);
    g.context.tick = 641; const result = g.move(); assert.equal(g.a.flags & 8, 0);
    assert.deepEqual(result.sounds, [type === 160 ? 'horse1.voc' : type === 161 ? 'cow1.voc' : type === 162 ? 'pig.voc' : 'sheep1.voc']);
    assert.equal(g.context.random.snapshot().visual, type === 161 || type === 163 ? 0x9712 : 0x1234);
  }
});

test('storage entry is first-fit and failure atomic; stored exit tries left cells, clears thirst and defers repaint and health', () => {
  const f = setup(); const b = f.building(); b.setContent(0, 1, 1, 1); f.a.bytes[14] = 4;
  assert.equal(f.move().stored, true); assert.equal(f.a.flags & 4, 4); assert.equal(f.a.x, 21); assert.equal(f.a.y, 21);
  assert.deepEqual(b.content(1), { graphic: 946, type: 160, slot: 255 }); assert.equal(f.a.buildingSlot, 1);
  f.a.bytes[13] = 100; f.a.bytes[14] = 10; f.cell(20, 20).terrain = 87; f.cell(20, 21).terrain = 87;
  f.context.random = new FarmRandom({ visual: 0x500, simulation: 2, bounded: 99 }); // next visual low bits5.
  assert.equal(stepStoredAnimal(f.world, f.a, f.context.random), true);
  assert.equal(f.a.x, 20); assert.equal(f.a.y, 22); assert.equal(f.a.bytes[14], 0); assert.equal(f.a.bytes[13], 100);
  assert.equal(f.a.conditionByte, 200); assert.equal(f.cell(20, 22).terrain & 0x800, 0); assert.equal(f.a.buildingSlot, 1);
  assert.deepEqual(b.content(1), { graphic: 217, type: -1, slot: 0 });
  const g = setup(); const full = g.building(); for (let i = 0; i < 12; i++) full.setContent(i, 1, 1, 1);
  g.a.bytes[14] = 255; g.a.bytes[4] = 2;
  const before = [...g.a.bytes], cell = { ...g.cell(20, 20) };
  assert.equal(storeMovingAnimal(g.world, g.finances, g.a, full), false);
  assert.deepEqual([...g.a.bytes], before); assert.deepEqual(g.cell(20, 20), cell);
  const edge = setup(); const home = edge.building(1, 68, 0, 20);
  assert.ok(storeMovingAnimal(edge.world, edge.finances, edge.a, home));
  assert.equal(stepStoredAnimal(edge.world, edge.a, new FarmRandom({ visual: 0x500, simulation: 2, bounded: 99 })), false);
});

test('herd refresh retains overlapping source counters and mapping, signed divisors, RNG and unsigned clock wrap', () => {
  const e = source('SIMFARM.EXE'), ds = 0x846f0;
  assert.equal(e.readUInt16LE(ds + 0x2286), 16); assert.equal(e.readUInt16LE(ds + 0xc6f4), 0x6190); assert.equal(e.readUInt16LE(ds + 0xc6f6), 0x6190);
  assert.equal(e.subarray(0xdfe3, 0xdfe8).toString('hex'), '2601847820'); assert.equal(e.subarray(0xe000, 0xe005).toString('hex'), '26fe875722');
  const f = setup(); f.a.bytes[0] = 10; f.a.bytes[1] = 12;
  assert.equal(refreshAnimalHerd(f.world, f.context.frame, f.context.random, 320), false);
  const expected = new FarmRandom(f.context.random.snapshot()), v = [expected.nextVisual() & 3, expected.nextVisual() & 3, expected.nextVisual() & 3, expected.nextVisual() & 3];
  assert.equal(refreshAnimalHerd(f.world, f.context.frame, f.context.random, 321), true);
  assert.deepEqual([...f.context.frame.herd], [1, 10, 0, 12, 0, v[0], 0, v[1], 0, 0, 0, 0, 0, v[2], 0, v[3], 0, 0, 0, 0, 0]);
  assert.deepEqual(animalHerdTarget(f.context.frame, 160), { x: v[2], y: v[3] });
  assert.deepEqual(animalHerdTarget(f.context.frame, 161), { x: v[0], y: v[1] });
  assert.deepEqual(animalHerdTarget(f.context.frame, 163), { x: 0, y: 0 });
  assert.deepEqual(f.context.random.snapshot(), expected.snapshot());
  f.context.frame.lastCentreTick = 65530; assert.equal(refreshAnimalHerd(f.world, f.context.frame, f.context.random, 315), true);
  assert.equal(f.context.frame.herd[0], 2); // The source never clears type160's counter.
  const g = setup(161);
  for (let i = 1; i <= 127; i++) { g.world.animals[i].bytes.set(g.a.bytes); g.world.animals[i].flags = 32; }
  const before = g.context.random.snapshot(); refreshAnimalHerd(g.world, g.context.frame, g.context.random, 321);
  assert.equal(g.context.frame.herd[1], 128); assert.deepEqual(g.context.random.snapshot(), before);
});

test('frame gate composes movement, storage recovery and care; death no longer skips later active slots', () => {
  const f = setup(); f.a.bytes[14] = 4; f.a.bytes[13] = 100; const b = f.building();
  f.context.tick = 15; assert.deepEqual(advanceAnimalFrame(f.world, f.finances, f.context, 0), []);
  f.context.tick = 16; const result = advanceAnimalFrame(f.world, f.finances, f.context, 0);
  assert.equal(result[0].movement?.stored, true); assert.equal(f.a.conditionByte, 230); assert.equal(f.a.bytes[13], 0); assert.equal(f.a.bytes[14], 0);
  assert.equal(b.content(0).slot, 255); assert.equal(f.context.frame.lastMoveTick, 16);
  f.a.bytes[13] = 20; f.a.bytes[14] = 10; f.context.tick = 32;
  const stored = advanceAnimalFrame(f.world, f.finances, f.context, 0); assert.equal(stored[0].care, undefined);
  assert.equal(f.a.bytes[13], 20); assert.equal(f.a.bytes[14], 0); assert.equal(f.a.conditionByte, 230);
  const g = setup(); const first = g.world.animals[1]; first.bytes.set(g.a.bytes); first.bytes[0] = 40; first.bytes[1] = 40; first.bytes[14] = 255;
  g.finances.accounts.assets.animalDefinitions[0].count = 2; g.a.bytes[14] = 255;
  const deaths = advanceAnimalFrame(g.world, g.finances, g.context, 0);
  assert.deepEqual(deaths.map(r => [r.slot, r.care?.died]), [[1, 'water'], [255, 'water']]);
  assert.equal(g.finances.accounts.assets.animalDefinitions[0].count, 0);
});
