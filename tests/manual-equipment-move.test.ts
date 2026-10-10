import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { checkEquipmentMove, checkEquipmentPickup, findEquipmentAt, moveManualEquipment, toggleManualBuildingInterior } from '../src/simulation/manual-equipment-move';
import { purchaseEquipment } from '../src/simulation/equipment-purchase';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { findBuilding } from '../src/simulation/building-storage';
import { updateEquipment } from '../src/simulation/equipment-dispatch';
import { findAvailableEquipment } from '../src/simulation/equipment';
import { reserveEquipment } from '../src/simulation/equipment-rental';
import { equipmentFootprint, type EquipmentRuntime } from '../src/simulation/equipment-world';
import { shopFixture } from './support/livestock';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const runtime = (): EquipmentRuntime => ({ grassTravelCount: 0, animationTick: 0, notices: [] });

test('manual movement pins original map calls, pickup/drop gates, timer clock, manual flag and aircraft dispatcher exclusion', () => {
  const exe = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  assert.equal(0x1f950+exe.readUInt16LE(0x22352+25*2),0x21726); // Move palette ID26.
  exact(0x2172f,'26c747020b00');exact(0x2173e,'26c747582e1a');
  assert.equal(0x1f950+exe.readUInt16LE(0x20d9c+10*2),0x20d42); // Edit mode11.
  exact(0x137e5,'b8ea19');exact(0x14510,'b82e1a'); // Pickup/drop/pickup cursor cycle.
  exact(0x20d61, '9a06004c11'); exact(0x136f4, '9a0e005f0d'); exact(0x13712, '26f687bca603');
  exact(0x13766, '26f6870284017561'); exact(0x13c19, '26f687254c08'); exact(0x13c7e, '26f687bca603');
  exact(0x13cfd, '9a700fd417'); exact(0x13d09, '2680a4bca6fb'); exact(0x13d5a, '9af4015f0d');
  exact(0x13d66, '26808cbda608'); exact(0x20e65, '9ab803d417'); exact(0xfa44, '8e064ac726a19e138e0646c7268987d8a6');
  exact(0x14c38, '3d07007719'); exact(0x1162f, 'f6c109');
});

test('all source farms select every equipment footprint and withdraw only matching storage cells without a movement debit', () => {
  let count = 0;
  for (let id = 0; id < 8; id++) {
    const w = readScenario(source(`SCEN${id}.SSM`)), cash = w.farm.cash;
    for (const e of w.equipment.filter(e => e.slot && e.active && e.type < 8)) {
      const b = findBuilding(w, e.x, e.y), { width, height } = equipmentFootprint(e, w);
      if (b && !(b.flags & 1)) {
        assert.deepEqual(checkEquipmentPickup(w, e.x, e.y), { ok: false, reason: 'building-closed' });
        assert.deepEqual(toggleManualBuildingInterior(w, b.x, b.y, b.slot), { ok: true, slot: b.slot, open: true });
      }
      const contents = b && Array.from({ length: 12 }, (_, i) => b.content(i));
      const before = Uint8Array.from(e.bytes);
      const selection = checkEquipmentPickup(w, e.x + width - 1, e.y + height - 1); assert.ok(selection.ok);
      assert.equal(selection.slot, e.slot); assert.deepEqual(e.bytes, before);
      // Original destination gate tests ownership alone, independent of its graphic.
      w.cells[worldIndex(10, 10)].overlay |= 0x800;
      assert.deepEqual(moveManualEquipment(w, selection, 10, 10, 65535), selection);
      const expected = Uint8Array.from(before), view = new DataView(expected.buffer);
      view.setUint16(2, (e.flags | 0x802) & ~4, true); expected[4] = 1; expected[7] = expected[8] = 10;
      for (const o of [9, 11, 13]) { expected[o] = e.x; expected[o + 1] = e.y; }
      expected[55] = 0; view.setUint16(30, 65535, true); assert.deepEqual(e.bytes, expected);
      if (b) for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) {
        const cleared: boolean = x >= e.x - b.x && x < e.x - b.x + width && y >= e.y - b.y && y < e.y - b.y + height;
        assert.deepEqual(b.content(x * 3 + y), cleared ? { graphic: 217, type: -1, slot: 0 } : contents![x * 3 + y]);
      }
      assert.equal(w.farm.cash, cash); count++;
    }
  }
  assert.ok(count > 100);
});

test('drop gates reject atomically, accept all owned terrain graphics, and preserve original rental/wear/field-work distinctions', () => {
  const f = shopFixture(), w = f.state.scenario;
  assert.ok(purchaseEquipment(w, f.state.finances, 0, 10, 10, 0).ok);
  const e = w.equipment[1], selected = checkEquipmentPickup(w, 10, 10); assert.ok(selected.ok);
  const reject = (x: number, y: number, reason: string, target = selected) => {
    const before = JSON.stringify(f.state);
    assert.deepEqual(moveManualEquipment(w, target, x, y, 0), { ok: false, reason });
    assert.equal(JSON.stringify(f.state), before);
  };
  for (const [x, y] of [[-1, 0], [96, 0], [0, 96], [0.5, 0], [NaN, 0]]) reject(x, y, 'outside-map');
  w.cells[worldIndex(20, 20)].overlay = 0x4000; reject(20, 20, 'not-owned');
  w.cells[worldIndex(20, 20)].overlay = 0x4800;
  for (let tile = 0; tile < 2048; tile++) {
    w.cells[worldIndex(20, 20)].terrain = tile | 0x800;
    assert.ok(checkEquipmentMove(w, selected, 20, 20).ok);
  }
  for (const flag of [1, 2, 3]) { e.flags |= flag; reject(20, 20, 'equipment-busy'); e.flags &= ~3; }
  reject(20, 20, 'target-changed', { ...selected, slot: 2 });
  e.attachment = 127; reject(20, 20, 'inconsistent-equipment'); e.attachment = 0;
  e.flags |= 4; reject(20, 20, 'inconsistent-equipment'); e.flags &= ~4;
  const before = JSON.stringify(f.state);
  assert.throws(() => moveManualEquipment(w, selected, 20, 20, -1), /clock/); assert.equal(JSON.stringify(f.state), before);
  e.flags |= 64 | 8; e.bytes[17] = 255; w.farm.cash = 0;
  assert.ok(moveManualEquipment(w, selected, 20, 20, 0).ok); // No invented rental/wear/cash gate.
});

test('all eight types reach the manual destination, towing implements and returning their owned tractor', () => {
  for (let type = 0; type < 8; type++) {
    const f = shopFixture(), w = f.state.scenario, r = runtime();
    assert.ok(purchaseEquipment(w, f.state.finances, type, 20, 20, 0).ok);
    assert.ok(purchaseEquipment(w, f.state.finances, 0, 15, 20, 0).ok);
    const selected = checkEquipmentPickup(w, 20, 20); assert.ok(selected.ok);
    const cash = w.farm.cash;
    assert.ok(moveManualEquipment(w, selected, 30, 30, 65535).ok);
    let sawTowing = false, done = false;
    for (let tick = 0; tick < 700; tick++) {
      updateEquipment(w, r, tick);
      sawTowing ||= Boolean(w.equipment[2].attachment);
      if (!(w.equipment[1].flags & 3) && !(w.equipment[2].flags & 0xb)) { done = true; break; }
    }
    assert.ok(done, `type${type} completes`); assert.equal(sawTowing, [1, 2, 3, 5].includes(type));
    const e = w.equipment[1], tractor = w.equipment[2];
    assert.deepEqual([e.x, e.y, e.bytes[50], e.bytes[51], e.parent, e.attachment], [30, 30, 30, 30, 0, 0]);
    assert.deepEqual([tractor.x, tractor.y], [15, 20]); assert.equal(w.farm.cash, cash);
    // SF-115: manual orders are not reservations; allocation can supersede them.
    assert.ok(moveManualEquipment(w, checkEquipmentPickup(w, 30, 30) as typeof selected, 35, 35, 900).ok);
    assert.equal(findAvailableEquipment(w.equipment, type, e.x, e.y)?.slot, e.slot);
  }
});

test('manual trailer order can wait for a tractor, rent through the original economy and finish with no rental leak', () => {
  const f = shopFixture(), w = f.state.scenario, r = runtime();
  assert.ok(purchaseEquipment(w, f.state.finances, 1, 20, 20, 0).ok);
  const selected = checkEquipmentPickup(w, 20, 20); assert.ok(selected.ok);
  assert.ok(moveManualEquipment(w, selected, 30, 30, 0).ok);
  w.farm.autoRent = false;
  const allocate = (world: typeof w, type: number, x: number, y: number) => reserveEquipment(world, type, x, y, world.farm.timerTicks);
  updateEquipment(w, r, 2, true, allocate); assert.equal(w.equipment[1].bytes[4], 1);
  const cash = w.farm.cash, expenses = w.farm.rentalExpenses, price = w.equipmentDefinitions[0].price >>> 1;
  w.farm.autoRent = true;
  let done = false;
  for (let tick = 3; tick < 900; tick++) {
    w.farm.timerTicks = tick; updateEquipment(w, r, tick, true, allocate);
    if (!(w.equipment[1].flags & 3) && !w.equipment.some(e => e.active && (e.flags & 64))) { done = true; break; }
  }
  assert.ok(done); assert.deepEqual([w.equipment[1].x, w.equipment[1].y], [30, 30]);
  assert.equal(w.farm.cash, cash - price); assert.equal(w.farm.rentalExpenses, expenses + price);
});

test('opening, withdrawal and destination storage retain original roof/interior state and reject mismatched content before mutation', () => {
  const f = shopFixture(), w = f.state.scenario, r = runtime();
  assert.ok(purchaseBuilding(w, f.state.finances, 66, 10, 10, 0).ok);
  assert.ok(purchaseBuilding(w, f.state.finances, 66, 30, 30, 0).ok);
  assert.ok(purchaseEquipment(w, f.state.finances, 4, 10, 10, 0).ok);
  const b = w.buildings[1]; assert.ok(toggleManualBuildingInterior(w, 11, 11, b.slot).ok);
  const selected = checkEquipmentPickup(w, 10, 11); assert.ok(selected.ok);
  b.setContent(1, 217, -1, 0);
  const before = JSON.stringify(f.state);
  assert.deepEqual(moveManualEquipment(w, selected, 30, 30, 0), { ok: false, reason: 'inconsistent-equipment' });
  assert.equal(JSON.stringify(f.state), before);
  b.setContent(1, b.content(0).graphic + 1, 4, 1);
  assert.ok(moveManualEquipment(w, selected, 30, 30, 0).ok);
  for (let tick = 2; tick < 300 && (w.equipment[1].flags & 2); tick += 2) updateEquipment(w, r, tick);
  assert.equal(w.equipment[1].flags & 4, 4); assert.equal(w.buildings[2].content(0).slot, 1);
  assert.equal(b.flags & 1, 1); assert.equal(w.buildings[2].flags & 1, 0);
  assert.deepEqual(toggleManualBuildingInterior(w, 10, 10, 2), { ok: false, reason: 'target-changed' });
  assert.deepEqual(toggleManualBuildingInterior(w, -1, 0, 1), { ok: false, reason: 'outside-map' });
  assert.deepEqual(toggleManualBuildingInterior(w, 0, 0, 1), { ok: false, reason: 'no-building' });
});

test('bounded point selection, every original building type and aircraft exclusion handle original format boundaries', () => {
  const f = shopFixture(), w = f.state.scenario;
  for (let type = 64; type <= 72; type++) {
    const result = purchaseBuilding(w, f.state.finances, type, 10 + (type - 64) * 5, 10, 0); assert.ok(result.ok);
    const b = w.buildings[result.slot], before = Uint8Array.from(b.bytes);
    const toggled = toggleManualBuildingInterior(w, b.x, b.y, b.slot);
    if (type === 70 || type === 71) { assert.deepEqual(toggled, { ok: false, reason: 'no-interior' }); assert.deepEqual(b.bytes, before); }
    else { assert.deepEqual(toggled, { ok: true, slot: b.slot, open: true }); toggleManualBuildingInterior(w, b.x, b.y, b.slot); assert.deepEqual(b.bytes, before); }
  }
  assert.equal(findEquipmentAt(w, NaN, 0), undefined); assert.equal(findEquipmentAt(w, 95, 95), undefined);
  const e = w.equipment[126]; e.flags = 32; e.bytes[0] = 8; e.bytes[1] = 0; e.bytes[5] = e.bytes[6] = 80;
  assert.equal(findEquipmentAt(w, 80, 80)?.slot, 126);
  assert.deepEqual(checkEquipmentPickup(w, 80, 80), { ok: false, reason: 'use-aircraft-controls' });
});
