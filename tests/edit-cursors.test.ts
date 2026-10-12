import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../src/formats/archive';
import {createHash} from 'node:crypto';
import {readEditCursor,EDIT_CURSOR_OFFSETS} from '../src/formats/edit-cursors';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
const archive=readArchive(readFileSync(new URL('../../simfarm-dos/MEGADATA.IDX',import.meta.url)),readFileSync(new URL('../../simfarm-dos/MEGADATA.EEA',import.meta.url)));
const cursors=archive.find(a=>a.name==='cursors.til')!.bytes;
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
  for(const kind of ['pick','drop','view','bulldoze','spray','buy'] as const){
    const offset=0x846f0+EDIT_CURSOR_OFFSETS[kind],r=readEditCursor(exe,cursors,kind);
    expect([r.width,r.height]).toEqual([16,16]);
    // Compare composited pixels for every possible four-bit background color.
    for(let background=0;background<16;background++)for(let i=0;i<256;i++){
      const base={pick:0,drop:256,view:512,spray:1280,buy:1024,bulldoze:-1}[kind];
      const bit=128>>(i%8),mask=(base<0?exe[offset+6+(i>>3)]:cursors[base+(i>>3)])&bit,
        color=(base<0?exe[offset+38+(i>>3)]:cursors[base+128+(i>>3)])&bit;
      const original=mask?(color?15:0):background;
      expect(r.rgba[i*4+3]?r.rgba[i*4]/17:background).toBe(original);
    }
    for(let n=offset;n<offset+70;n++)expect(()=>readEditCursor(exe.subarray(0,n),cursors,kind)).toThrow();
    const malformed=Uint8Array.from(exe);malformed[offset+2]=3;expect(()=>readEditCursor(malformed,cursors,kind)).toThrow('Invalid Edit cursor header');
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


test('Plant inherits its palette arrow and both Buy branches assign the resource-backed purchase cursor',()=>{
  expect(0x1f950+exe.readUInt16LE(0x22352+21*2)).toBe(0x21eec);
  expect(exe.subarray(0x21f23,0x21f31).toString('hex')).toBe('b9d218be906126894f582689775a');
  // Crop selection sets mode4/128px footprint without replacing window+58/+5a.
  expect(createHash('sha256').update(exe.subarray(0x38310,0x38398)).digest('hex'))
    .toBe('70c45321024d884a24db3efddc383fdd2f0e311090a40646e8b59ec9db5e484e');
  for(const pointer of [0x47d55,0x47e3a])
    expect(exe.subarray(pointer,pointer+6).toString('hex')).toBe('b8ba1ab99061');
  for(const store of [0x47d60,0x47e49])
    expect(exe.subarray(store,store+8).toString('hex')).toBe('2689475826894f5a');
  for(const mode of [0x47d7e,0x47e67])
    expect(exe.subarray(mode,mode+6).toString('hex')).toBe('26c747020900');
});

test('Move keeps mode11 outside rectangle drawing and centers hand cursor hit testing',()=>{
  for(const [start,end,hash] of [
    [0x21726,0x217a7,'62efbed2889d61f4f2e274c829c0c21f177a86d4af16f4072366a7fd1771aeb3'],
    [0x209be,0x209f5,'4561b46735f7bd929a080c26aab55ee97c9562cf8565cc561f12b52f1e643819'],
    [0xe6bc,0xe704,'c1a375c6517f9cd497e10510f21367069037b91e01ffa23ffe09d69f792f5900'],
    [0x20449,0x20483,'96cd10bf762b3b6f555cb667dd80fcf52a9c28540ec8cf210b303fd3d50dda6b'],
    [0x137cf,0x13824,'8da109b8b9b0a0eb274b122671172fa91fcc6387db68647f2d5766e7fe70655a'],
    [0x14510,0x1454e,'39a6e59f5fa93ff5f406e7d3c4d1cacbf6723d3088e736942853d16bc2e250ac'],
  ] as const)expect(createHash('sha256').update(exe.subarray(start,end)).digest('hex')).toBe(hash);
  expect(exe.subarray(0x2172f,0x21735).toString('hex')).toBe('26c747020b00');
  const outlined=Array.from({length:7},(_,i)=>exe[0x209c5+i*7]);
  expect(outlined).toEqual([9,4,15,16,17,2,1]);expect(outlined).not.toContain(11);
  expect(0x1f950+exe.readUInt16LE(0x20d9c+20)).toBe(0x20d42);
  expect(exe.subarray(0x20d61,0x20d66).toString('hex')).toBe('9a06004c11');
  expect(exe.subarray(0x21787,0x21789).toString('hex')).toBe('b008');
  expect(exe.subarray(0x2178d,0x21791).toString('hex')).toBe('26a22817');
  expect(exe.subarray(0x21795,0x21799).toString('hex')).toBe('26a22617');
  expect(exe.subarray(0xe6ce,0xe6d3).toString('hex')).toBe('2601877a12');
  expect(exe.subarray(0xe6e0,0xe6e5).toString('hex')).toBe('2601877c12');
});

test('startup replaces placeholder pixels with bounded archived hand and tool planes',()=>{
  expect(createHash('sha256').update(cursors).digest('hex')).toBe('84e9dbb9a5453ccea46f4ffb89a47751fee3a5322978090dd31d5fd8871efbc1');
  expect(createHash('sha256').update(exe.subarray(0x495ba,0x497c2)).digest('hex')).toBe('6b0cc8067311002010e1d346a67712dd89566829094e40aea9e6df5dba59610f');
  expect(createHash('sha256').update(exe.subarray(0x1f900,0x1f951)).digest('hex')).toBe('8e136f35b9c063915fecdae5a9bce4f35260ba3a0ac117d7440aa224d3761385');
  for(const [at,destination] of [[0x495d6,0x1a34],[0x495fb,0x1a54],[0x49620,0x19f0],[0x49645,0x1a10],
    [0x496d7,0x19aa],[0x496fd,0x19ca],[0x49733,0x1ac0],[0x49759,0x1ae0],[0x4978f,0x1892],[0x497b5,0x18b2]]){
    expect(exe[at]).toBe(0x68);expect(exe.readUInt16LE(at+1)).toBe(destination);
  }
  for(let length=0;length<1536;length++)expect(()=>readEditCursor(exe,cursors.subarray(0,length),'pick')).toThrow('Invalid cursor resource size');
  expect(()=>readEditCursor(exe,new Uint8Array(1537),'pick')).toThrow('Invalid cursor resource size');
});
