import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readMoveCursor,MOVE_CURSOR_OFFSETS} from '../src/formats/move-cursors';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
test('Move cursors match source pointer transitions and VGA mask/color reads',()=>{
  expect(createHash('sha256').update(exe).digest('hex')).toBe('8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  expect(exe.subarray(0x2173e,0x21744).toString('hex')).toBe('26c747582e1a');
  expect(exe.subarray(0x8083,0x8088).toString('hex')).toBe('8b368818ad');
  expect(exe[0x808e]).toBe(0xad);expect(exe[0x8098]).toBe(0xad);
  expect(exe.subarray(0x80f5,0x80f7).toString('hex')).toBe('8a3c');
  expect(exe.subarray(0x8108,0x810b).toString('hex')).toBe('8a6420');
  for(const kind of ['pick','drop'] as const){
    const offset=0x846f0+MOVE_CURSOR_OFFSETS[kind],r=readMoveCursor(exe,kind);
    expect([r.width,r.height]).toEqual([16,16]);
    // Compare composited pixels for every possible four-bit background color.
    for(let background=0;background<16;background++)for(let i=0;i<256;i++){
      const bit=128>>(i%8),mask=exe[offset+6+(i>>3)]&bit,color=exe[offset+38+(i>>3)]&bit;
      const original=mask?(color?15:0):background;
      expect(r.rgba[i*4+3]?r.rgba[i*4]/17:background).toBe(original);
    }
    for(let n=offset;n<offset+70;n++)expect(()=>readMoveCursor(exe.subarray(0,n),kind)).toThrow();
    const malformed=Uint8Array.from(exe);malformed[offset+2]=3;expect(()=>readMoveCursor(malformed,kind)).toThrow('Invalid Move cursor header');
    expect(r.rgba.filter((_,i)=>i%4===3&&r.rgba[i]===255).length).toBeGreaterThan(0);
  }
});
