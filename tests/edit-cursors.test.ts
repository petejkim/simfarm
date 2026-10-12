import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readEditCursor,EDIT_CURSOR_OFFSETS} from '../src/formats/edit-cursors';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
test('Edit cursors match source pointer transitions and VGA mask/color reads',()=>{
  expect(createHash('sha256').update(exe).digest('hex')).toBe('8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  expect(0x1f950+exe.readUInt16LE(0x22352)).toBe(0x215ea);
  expect(0x1f950+exe.readUInt16LE(0x22354)).toBe(0x21688);
  expect(exe.subarray(0x21649,0x2164f).toString('hex')).toBe('b9d218be9061');
  expect(exe.subarray(0x21698,0x216a4).toString('hex')).toBe('26c74758a41926c7475a9061');
  expect(exe.subarray(0x2173e,0x21744).toString('hex')).toBe('26c747582e1a');
  expect(exe.subarray(0x8083,0x8088).toString('hex')).toBe('8b368818ad');
  expect(exe[0x808e]).toBe(0xad);expect(exe[0x8098]).toBe(0xad);
  expect(exe.subarray(0x80f5,0x80f7).toString('hex')).toBe('8a3c');
  expect(exe.subarray(0x8108,0x810b).toString('hex')).toBe('8a6420');
  for(const kind of ['pick','drop','view','bulldoze','spray'] as const){
    const offset=0x846f0+EDIT_CURSOR_OFFSETS[kind],r=readEditCursor(exe,kind);
    expect([r.width,r.height]).toEqual([16,16]);
    // Compare composited pixels for every possible four-bit background color.
    for(let background=0;background<16;background++)for(let i=0;i<256;i++){
      const bit=128>>(i%8),mask=exe[offset+6+(i>>3)]&bit,color=exe[offset+38+(i>>3)]&bit;
      const original=mask?(color?15:0):background;
      expect(r.rgba[i*4+3]?r.rgba[i*4]/17:background).toBe(original);
    }
    for(let n=offset;n<offset+70;n++)expect(()=>readEditCursor(exe.subarray(0,n),kind)).toThrow();
    const malformed=Uint8Array.from(exe);malformed[offset+2]=3;expect(()=>readEditCursor(malformed,kind)).toThrow('Invalid Edit cursor header');
    expect(r.rgba.filter((_,i)=>i%4===3&&r.rgba[i]===255).length).toBeGreaterThan(0);
  }
});


test('all nine construction selectors and four spray choices pin their original pointer writes',()=>{
  for(const [action,target,pointer] of [[11,0x217a8,0x217c5],[12,0x21864,0x21881],[13,0x21920,0x2193d],
    [14,0x219dc,0x219f9],[15,0x21a9a,0x21ab7],[16,0x21b56,0x21be3],[17,0x21c16,0x21c33],
    [19,0x21d74,0x21d91],[20,0x21e30,0x21e4d]]){
    expect(0x1f950+exe.readUInt16LE(0x22352+(action-1)*2)).toBe(target);
    expect(exe.subarray(pointer,pointer+6).toString('hex')).toBe('b8d218b99061');
    // Dirt road reloads its window pointer; other branches already haveES:BX.
    const store=pointer+(action===16?9:6);
    expect(exe.subarray(store,store+8).toString('hex')).toBe('2689475826894f5a');
  }
  for(const address of [0x383fb,0x38449,0x3848f,0x384d7])
    expect(exe.subarray(address,address+12).toString('hex')).toBe('26c747588c1826c7475a9061');
});
