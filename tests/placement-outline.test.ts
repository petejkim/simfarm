import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {clipPlacementOutline} from '../src/render/placement-outline';

test('placement outline pins inclusive XOR source primitives and their eight calls',()=>{
  const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  for(const [start,end,hash] of [
    [0x208d6,0x20a49,'b43e195860024867f854da681fb2ef0f36fbcb726f5ebfa7cc7d434b64e7c7ab'],
    [0x22684,0x2279e,'ce3eaf01b112aef79a55564062de1617033a1952216c2e3b4297feffffc1ccc5'],
    [0x6771,0x681d,'dd06b6f5c3b30a1bde7afb70934ab065643ea1ab5aa82b01a70f58a11dd5e6a4'],
    [0x68ff,0x69f1,'16a19c1b3270968f9d277187386cf6297d88155d70925f1b9a38b59ea21ae8a3'],
  ] as const)expect(createHash('sha256').update(exe.subarray(start,end)).digest('hex')).toBe(hash);
  for(const address of [0x67d7,0x696d])expect(exe.subarray(address,address+4).toString('hex')).toBe('b80318ef');
  for(const address of [0x226f5,0x2270c,0x22721,0x22738])expect(exe.subarray(address,address+5).toString('hex')).toBe('9a9f051604');
  for(const address of [0x2274d,0x22764,0x2277b,0x22790])expect(exe.subarray(address,address+5).toString('hex')).toBe('9a11041604');
});

test('placement clipping keeps the asymmetric edges and cancels double-drawn corners',()=>{
  const rectangles:number[][]=[];
  const context={beginPath:()=>rectangles.splice(0),rect:(...args:number[])=>rectangles.push(args),
    clip:(rule:string)=>expect(rule).toBe('evenodd')} as unknown as CanvasRenderingContext2D;
  clipPlacementOutline(context,{x:0,y:1,width:8,height:8});
  const covered=(x:number,y:number)=>rectangles.filter(([l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h).length%2;
  expect(rectangles).toHaveLength(8);
  // Original horizontal and vertical strokes toggle the upper-left pixel twice.
  for(const [x,y,expected] of [[0,16,0],[1,16,1],[0,17,1],[-1,16,1],[0,15,1],[-1,15,0],
    [126,142,0],[127,143,0],[125,143,1],[127,141,1],[128,140,0],[20,20,0]])
    expect(covered(x,y)).toBe(expected);
});


test('View and Spray use one tile from original dimensions, independent of field size',()=>{
  const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  for(const [start,end,hash] of [
    [0x21688,0x21726,'54036ee66febc90a4d36bccb94dc3c4dc74b1ae173ae0195494ce34629308bc8'],
    [0x3821c,0x3826d,'c40ea427fbf6aa1bafdaea4828964deba28eded676c10e270960302a9eadc5d7'],
    [0x383ce,0x384f1,'7031693e850fe4f45ba8866c7d671733ceefbd664084985fe9c50f3526de7765'],
  ] as const)expect(createHash('sha256').update(exe.subarray(start,end)).digest('hex')).toBe(hash);
  expect(exe.subarray(0x2161d,0x21620).toString('hex')).toBe('b91000');
  expect(exe.subarray(0x21632,0x21635).toString('hex')).toBe('b90100');
  expect(exe.subarray(0x216e4,0x216e7).toString('hex')).toBe('b81000');
  // Popup node bytes12/13 are width/height, converted to pixels by SHL4.
  for(const node of [0x54a2,0x5494,0x5486,0x5478])
    expect([...exe.subarray(0x846f0+node+12,0x846f0+node+14)]).toEqual([1,1]);
  expect(exe.subarray(0x3822d,0x38239).toString('hex')).toBe('268a470c98c1e0048e0606cc');
  expect(exe.subarray(0x3823f,0x3824b).toString('hex')).toBe('268a470d98c1e0048e0608cc');
});
