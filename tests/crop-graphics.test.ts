import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchCropGraphics, cropTilePatches } from '../src/formats/crop-graphics';
import { readScenario } from '../src/formats/scenario';
import { readArchive } from '../src/formats/archive';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('runtime tile replacements match original executable tables and crop byte ranges', () => {
  const exe = source('SIMFARM.EXE');
  const table = (offset: number, slot: number) => exe.readUInt16LE(0x4ec60 + offset + slot * 2);
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
  const base = entries.find(e => e.name === 'ega16til.til')!.bytes;
  const before = base.slice();
  for (let scenarioId = 0; scenarioId < 8; scenarioId++) {
    const scenario = readScenario(source(`SCEN${scenarioId}.SSM`));
    const crops = scenario.cropFiles.map(name => source(`CROPS/${name.toUpperCase()}`));
    const atlas = patchCropGraphics(base, crops), patched = new Set<number>();
    crops.forEach((crop, slot) => {
      const patches = cropTilePatches(slot);
      assert.equal(patches[0].tile, table(0x882, slot));
      assert.equal(patches[12].tile, table(0x938, slot));
      assert.equal(patches[13].tile, table(0x90c, slot));
      assert.equal(patches[8].tile, 0x21b + 4 * slot);
      for (const p of patches) {
        assert.deepEqual(atlas.subarray(p.tile * 128, (p.tile + 1) * 128), crop.subarray(p.sourceOffset, p.sourceOffset + 128));
        patched.add(p.tile);
      }
    });
    assert.equal(patched.size, 224);
    for (let tile = 0; tile < 880; tile++) if (!patched.has(tile)) assert.deepEqual(atlas.subarray(tile * 128, (tile + 1) * 128), base.subarray(tile * 128, (tile + 1) * 128));
  }
  assert.deepEqual(base, before);
  assert.throws(() => cropTilePatches(16));
});

test('world coordinates are column-major and masked layers use the original flag/base', async () => {
  const { worldIndex, worldPosition, maskedTile } = await import('../src/formats/scenario');
  assert.equal(worldIndex(39, 29), 3773);
  assert.deepEqual(worldPosition(3773), { x: 39, y: 29 });
  const scenario = readScenario(source('SCEN0.SSM'));
  // Original field #1 is at X39,Y29, crop slot1; its top-left crop marker is 539 + 4 × slot.
  assert.equal(scenario.cells[3773].terrain & 0x7ff, 543);
  assert.equal(scenario.cells[worldIndex(41, 31)].terrain & 0x7ff, 696);
  assert.equal(maskedTile({ terrain: 0x815, overlay: 0x350, attribute: 0 }), 0);
  assert.equal(maskedTile({ terrain: 0x15, overlay: 0x350, attribute: 0 }), null);
  for (let i = 0; i < 8; i++) {
    for (const cell of readScenario(source(`SCEN${i}.SSM`)).cells) {
      const tile = maskedTile(cell);
      assert.ok(tile === null || (tile >= 0 && tile < 200));
    }
  }
});
