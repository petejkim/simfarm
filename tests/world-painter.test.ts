import {test,expect} from 'bun:test';
import {drawWorldBase,WorldPainter} from '../src/render/world-renderer';
import {FIXED_CROP_FILES,cropStageTile} from '../src/formats/crop-slots';
import type {Scenario} from '../src/formats/scenario';

/** A canvas modelled per cell: terrain and town-event tiles replace a cell (they are opaque); overlays and badges stack. */
function modelCanvas(opaque:Set<CanvasImageSource>){
  const cells=new Map<number,string[]>();
  const context={imageSmoothingEnabled:false,drawImage:(source:CanvasImageSource,sx:number,sy:number,_w:number,_h:number,dx:number,dy:number)=>{
    const cell=dx/16*96+dy/16,draw=`${(source as {name:string}).name}:${sx},${sy}`;
    cells.set(cell,opaque.has(source)?[draw]:[...(cells.get(cell)??[]),draw]);
  }} as unknown as CanvasRenderingContext2D;
  return {context,cells};
}
function random(seed:number){return ()=>((seed=Math.imul(seed^seed>>>15,0x2c1b3c6d)+0x297a2d39|0)>>>0)/2**32;}

test('incremental world painting leaves every cell exactly as a full redraw',()=>{
  const next=random(7),tiles={name:'tiles'} as unknown as CanvasImageSource,mask={name:'mask'} as unknown as CanvasImageSource,events={name:'events'} as unknown as CanvasImageSource;
  const eventRegion={image:events,x:112,y:160};
  // Terrain tiles, worker overlays (1036/1037, animated by phase), town-event tiles and a field whose column-3 slot shows a badge.
  const cell=()=>({terrain:Math.floor(next()*600)|(next()<.3?0x800:0),overlay:(next()<.5?1036+Math.floor(next()*2):848+Math.floor(next()*200))|0xf800,attribute:0});
  const field={active:true,x:10,y:10,width:8,height:8,bytes:Object.assign(new Uint8Array(64),{54:0x31})};
  // A farm whose slots run in reverse of the fixed sheet order: crop tiles are drawn from their crops' fixed places.
  const scenario={cells:Array.from({length:96*96},cell),fields:[field],cropFiles:[...FIXED_CROP_FILES].reverse()} as unknown as Scenario;
  scenario.cells[0]={terrain:cropStageTile(0,3),overlay:0,attribute:0};
  // worldIndex(16,10): cells are column-major.
  const showBadge=()=>{scenario.cells[16*96+10].terrain=539+16*4;};showBadge();
  const painter=new WorldPainter(),incremental=modelCanvas(new Set([tiles,events]));
  expect(painter.paint(incremental.context,scenario,tiles,mask,0,eventRegion)).toBe(96*96);
  const fixed=cropStageTile(23,3);expect(incremental.cells.get(0)).toEqual([`tiles:${fixed%32*16},${Math.floor(fixed/32)*16}`]); // slot 0 = fixed crop 23
  // The field's badge stack is drawn over its column-3 cells.
  expect(incremental.cells.get(16*96+10)!.at(-1)).toBe(`tiles:${623%32*16},${Math.floor(623/32)*16}`); // badge 21, part 0
  for(let step=0;step<40;step++){
    const changes=Math.floor(next()*20);
    for(let n=0;n<changes;n++)scenario.cells[Math.floor(next()*96*96)]=cell();
    if(step%7===3)field.bytes[54]^=0x20;if(step%11===5)showBadge();
    const phase=step%2,repainted=painter.paint(incremental.context,scenario,tiles,mask,phase,eventRegion);
    expect(repainted).toBeLessThan(96*96);
    const full=modelCanvas(new Set([tiles,events]));drawWorldBase(full.context,scenario,tiles,mask,phase,eventRegion);
    expect(incremental.cells).toEqual(full.cells);
  }
});
test('town bank and palette changes repaint shared-image regions, while unchanged region values draw nothing',()=>{
  const tiles={name:'tiles'} as unknown as CanvasImageSource,mask={name:'mask'} as unknown as CanvasImageSource,events={name:'events'} as unknown as CanvasImageSource;
  const scenario={cells:Array.from({length:96*96},()=>({terrain:5,overlay:0,attribute:0})),fields:[],cropFiles:FIXED_CROP_FILES} as unknown as Scenario;
  for(let tile=0;tile<35;tile++)scenario.cells[tile].terrain=483+tile;
  scenario.cells[35].terrain=482;scenario.cells[36].terrain=518;
  const painter=new WorldPainter(),incremental=modelCanvas(new Set([tiles,events]));
  for(const y of [0,80,160])for(const x of [0,112,224]){
    const region={image:events,x,y};
    expect(painter.paint(incremental.context,scenario,tiles,mask,0,region)).toBe(9216);
    for(let tile=0;tile<35;tile++)expect(incremental.cells.get(tile)).toEqual([`events:${x+tile%7*16},${y+Math.floor(tile/7)*16}`]);
    expect(incremental.cells.get(35)).toEqual(['tiles:32,240']);
    expect(incremental.cells.get(36)).toEqual(['tiles:96,256']);
    expect(painter.paint(incremental.context,scenario,tiles,mask,0,{...region})).toBe(0);
    scenario.cells[0].terrain=517;
    expect(painter.paint(incremental.context,scenario,tiles,mask,0,region)).toBe(1);
    expect(incremental.cells.get(0)).toEqual([`events:${x+96},${y+64}`]);
    scenario.cells[0].terrain=483;
    expect(painter.paint(incremental.context,scenario,tiles,mask,0,region)).toBe(1);
  }
});
test('new tile sheets or a forced paint repaint every cell',()=>{
  const tiles={name:'tiles'} as unknown as CanvasImageSource,wet={name:'wet'} as unknown as CanvasImageSource,mask={name:'mask'} as unknown as CanvasImageSource;
  const scenario={cells:Array.from({length:96*96},()=>({terrain:5,overlay:0,attribute:0})),fields:[],cropFiles:FIXED_CROP_FILES} as unknown as Scenario;
  const painter=new WorldPainter(),{context}=modelCanvas(new Set([tiles,wet]));
  expect(painter.paint(context,scenario,tiles,mask)).toBe(9216);
  expect(painter.paint(context,scenario,tiles,mask)).toBe(0);
  expect(painter.paint(context,scenario,wet,mask)).toBe(9216);
  expect(painter.paint(context,scenario,wet,mask,0,undefined,true)).toBe(9216);
});
