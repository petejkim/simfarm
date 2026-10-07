import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { createClearingEffects, queueClearingEffect, updateClearingEffects } from '../src/simulation/clearing-effects';
import { findOverlappingField, removeField } from '../src/simulation/field-removal';
import { releaseEquipment } from '../src/simulation/equipment-dispatch';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 4) => ({ world: readScenario(source(`SCEN${id}.SSM`)), effects: createClearingEffects() });
const put = (bytes: Uint8Array, off: number, value: number) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(off, value, true);

test('field teardown and clearing queue constants match executable instructions and callers', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x1da1d, '9a26025719'); exact(0x1da28, '9afa025719');
  exact(0x1b9ba, '9ad20c5f0d'); exact(0x1b9c6, '9a76025f0d'); exact(0x1ba47, '2680a7254cef');
  exact(0x1ba78, '80a73924fe'); exact(0xa309, '8026aa1e3f'); exact(0xa3ec, '2598fa0d9802');
  exact(0xa436, '3d1000'); exact(0xa490, '3d9802'); exact(0xa495, '3da002'); exact(0xa5a6, '3846fc7703');
  exact(0xbcc8, '9ab81e3606');
  assert.equal(e.readUInt16LE(0x4ec60 + 0x860), 39);
  assert.ok(e.subarray(0x5dd1a, 0x5dd9a).every(n => n === 0)); // Empty source initialization hazard SF-060.
});

test('clearing uses a 64-slot ring, preserves both map words and restores evicted grass or terrain-flagged trees', () => {
  const { world, effects } = setup();
  for (const c of world.cells) { c.terrain = 0x880f; c.overlay = 0xabcd; c.attribute = 40; }
  const originalOrigin = { ...world.cells[0] };
  for (let i = 0; i < 64; i++) queueClearingEffect(world, effects, 20 + (i >>> 3), 20 + (i & 7), 3);
  assert.equal(effects.cursor, 0); assert.equal(effects.count, 64); assert.deepEqual(world.cells[0], originalOrigin);
  for (let x = 20; x < 28; x++) for (let y = 20; y < 28; y++) {
    const c = world.cells[worldIndex(x, y)]; assert.equal(c.terrain, 0x8a98); assert.equal(c.overlay, 0xabcd); assert.equal(c.attribute, 40);
  }
  queueClearingEffect(world, effects, 90, 90, 3);
  assert.equal(effects.cursor, 1); assert.equal(effects.count, 64);
  assert.equal(world.cells[worldIndex(20, 20)].terrain, 0x881c);
  world.cells[worldIndex(20, 21)].terrain |= 0x1000;
  queueClearingEffect(world, effects, 91, 91, 3);
  assert.equal(world.cells[worldIndex(20, 21)].terrain, 0x9837);
});

test('clearing advances by two every sixteen wrapped ticks and retains the source changing-count work budget', () => {
  const { world, effects } = setup(); world.cells[worldIndex(40, 40)].terrain = 15;
  queueClearingEffect(world, effects, 40, 40, 8);
  updateClearingEffects(world, effects, 8, 15); assert.equal(terrainTile(world.cells[worldIndex(40, 40)]), 664);
  for (const [tick, tile] of [[16, 666], [32, 668], [48, 670], [64, 672], [80, 15 + 8 + (world.cells[worldIndex(40, 40)].attribute >>> 2)]]) {
    updateClearingEffects(world, effects, 8, tick); assert.equal(terrainTile(world.cells[worldIndex(40, 40)]), tile);
  }
  assert.equal(effects.count, 0); assert.equal(effects.x[1], 255);
  queueClearingEffect(world, effects, 40, 40, 8); effects.lastTick = 65530;
  updateClearingEffects(world, effects, 8, 9); assert.equal(terrainTile(world.cells[worldIndex(40, 40)]), 664);
  updateClearingEffects(world, effects, 8, 10); assert.equal(terrainTile(world.cells[worldIndex(40, 40)]), 666);
  const full = setup();
  for (let i = 0; i < 64; i++) queueClearingEffect(full.world, full.effects, i, 30, 8);
  for (let tick = 16; tick <= 64; tick += 16) updateClearingEffects(full.world, full.effects, 8, tick);
  updateClearingEffects(full.world, full.effects, 8, 80);
  assert.equal(full.effects.count, 31); // 33 retirements before visited > changing count.
  for (let tick = 96; tick <= 192; tick += 16) updateClearingEffects(full.world, full.effects, 8, tick);
  assert.equal(full.effects.count, 0);
  const sparse = createClearingEffects(); sparse.count = 64;
  assert.doesNotThrow(() => updateClearingEffects(world, sparse, 8, 16)); // SF-061 finite even if counter disagrees.
});

test('all supplied fields deactivate without clearing unknown record bytes, plans, ownership or neighboring cells', () => {
  for (let id = 0; id < 8; id++) {
    const original = setup(id).world;
    for (const selected of original.fields.filter(f => f.active)) {
      const { world, effects } = setup(id), f = world.fields[selected.slot], record = Uint8Array.from(f.bytes);
      const plan = Uint8Array.from(world.schedule.bytes), regions = Uint8Array.from(world.regionalConditions), sourceBefore = Uint8Array.from(world.sourceBytes);
      const cells = world.cells.map(c => ({ ...c }));
      assert.equal(removeField(world, f.slot, effects, 8), true);
      record[7] &= ~1; assert.deepEqual(f.bytes, record); assert.deepEqual(world.schedule.bytes, plan);
      assert.deepEqual(world.regionalConditions, regions); assert.deepEqual(world.sourceBytes, sourceBefore);
      for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
        const i = worldIndex(x, y), c = world.cells[i];
        if (x >= f.x && x < f.x + f.width && y >= f.y && y < f.y + f.height) {
          assert.equal(c.overlay, cells[i].overlay & 0xefff); assert.equal(c.attribute, cells[i].attribute);
        } else assert.deepEqual(c, cells[i]);
      }
      assert.equal(removeField(world, f.slot, effects, 8), false);
    }
  }
});

test('field teardown releases owned/rented machinery chains and both assignment words, but Waiting skips release', () => {
  for (const state of [0, 1, 3, 5, 9]) {
    const { world, effects } = setup(), f = world.fields.find(f => f.active)!;
    const [tractor, child, pending] = world.equipment.slice(1, 4);
    for (const [i, e] of [tractor, child, pending].entries()) {
      e.bytes.fill(0); e.flags = i === 1 ? 0xeb : 0xab; e.bytes[5] = 80 + i; e.bytes[6] = 80;
      e.bytes[48] = f.slot; e.bytes[53] = e.bytes[54] = 99;
    }
    tractor.attachment = child.slot; child.parent = tractor.slot;
    f.bytes[2] = state; f.equipment = tractor.slot; f.pendingEquipment = pending.slot;
    const before = [tractor, child, pending].map(e => Uint8Array.from(e.bytes));
    assert.equal(removeField(world, f.slot, effects, 8), true);
    for (const [i, e] of [tractor, child, pending].entries()) {
      if (!state) assert.deepEqual(e.bytes, before[i]);
      else {
        assert.equal(e.flags & 0x89, 0); assert.equal(e.active, i !== 1);
        assert.equal(e.bytes[48], 0); assert.equal(e.bytes[53], world.equipmentDefinitions[e.type].width);
      }
    }
    assert.equal(f.equipment, tractor.slot); assert.equal(f.pendingEquipment, pending.slot); // Inactive record retains both words.
    assert.equal(tractor.attachment, state ? 0 : child.slot); assert.equal(child.parent, state ? 0 : tractor.slot); // SF-063 native detach.
  }
});

test('rented aircraft release clears its home footprint and occupancy while preserving owned definition counts', () => {
  const { world } = setup(), e = world.equipment[1];
  e.bytes.fill(0); put(e.bytes, 0, 8); e.flags = 0x69; e.bytes[50] = 3; e.bytes[51] = 10;
  world.regionalConditions[7] = 0xe5;
  const count = world.equipmentDefinitions[8].ownedCount;
  releaseEquipment(e, world);
  assert.equal(e.active, false); assert.equal(e.flags & 9, 0); assert.equal(world.regionalConditions[7], 0xc5);
  assert.equal(world.equipmentDefinitions[8].ownedCount, count);
  for (let x = 3; x < 5; x++) for (let y = 10; y < 12; y++) assert.equal(terrainTile(world.cells[worldIndex(x, y)]), 23);
});

test('corrected field queries exclude adjacent plots and include enclosing/crossing rectangles with actual dimensions', () => {
  const { world } = setup(); world.fields.forEach(f => f.bytes[7] &= ~1);
  const f = world.fields[2]; f.bytes[7] |= 1; f.bytes.set([8, 8, 8, 8], 10);
  assert.equal(findOverlappingField(world, 0, 8, 8, 8), null); // Source corner (8,8) falsely matched.
  assert.equal(findOverlappingField(world, 8, 0, 8, 8), null);
  assert.equal(findOverlappingField(world, 0, 0, 24, 24), 2); // Source misses fully enclosed field.
  assert.equal(findOverlappingField(world, 0, 10, 24, 1), 2);
  f.bytes[12] = 12; assert.equal(findOverlappingField(world, 18, 8, 1, 1), 2);
  assert.throws(() => findOverlappingField(world, 0, 0, 0, 1));
});

test('invalid clearing queues and machinery references fail before field/map mutation', () => {
  const { world, effects } = setup(), f = world.fields.find(f => f.active)!;
  f.bytes[2] = 3; f.equipment = 65535;
  const before = JSON.stringify([world, effects]);
  assert.throws(() => removeField(world, f.slot, effects, 8)); assert.equal(JSON.stringify([world, effects]), before);
  f.equipment = 0;
  for (const input of [-1, 96, NaN]) { const prior = JSON.stringify([world, effects]); assert.throws(() => queueClearingEffect(world, effects, input, 0, 8)); assert.equal(JSON.stringify([world, effects]), prior); }
  effects.x[10] = 96; const prior = JSON.stringify([world, effects]);
  assert.throws(() => removeField(world, f.slot, effects, 8)); assert.equal(JSON.stringify([world, effects]), prior);
  assert.equal(removeField(world, 0, effects, 8), false);
});
