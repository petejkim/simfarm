import { cropBadgeTile, cropPlantTile } from '../formats/crop-slots';
import { SCHEDULE_ACTIONS } from '../formats/schedule-window';
import type { FieldPlanEdit } from '../simulation/field-plan-edit';

/** Schedule2d2b2..2dd68: artwork only; captions/annotations are React text. */
export function drawSchedulePreview(context: CanvasRenderingContext2D, tiles: CanvasImageSource, maskedTiles: CanvasImageSource,
  gauges: CanvasImageSource, view: { cropPage: number; cropCount: number; action: FieldPlanEdit; month: number; now: number;
    field?: { cropSlot: number; gauges: number[]; maturityPixels: number; weeks: number[] } }, palette: readonly number[][]) {
  context.clearRect(0,0,336,224);context.imageSmoothingEnabled=false;
  function tile(code:number,x:number,y:number){
    const masked=code>848&&code<1048,index=masked?code-848:code;
    context.drawImage(masked?maskedTiles:tiles,index%32*16,Math.floor(index/32)*16,16,16,x,y,16,16);
  }
  function badge(slot:number,x:number,y:number,isCrop=false){
    for(let i=0;i<4;i++)tile(isCrop?cropBadgeTile(slot,i):539+slot*4+i,x+i%2*16,y+Math.floor(i/2)*16);
  }
  for(let i=0;i<16&&view.cropPage*16+i<view.cropCount;i++)tile(cropPlantTile(view.cropPage*16+i),104+i%8*16,8+Math.floor(i/8)*16);
  SCHEDULE_ACTIONS.forEach((action,i)=>tile(action.tile,24+i%2*16,64+Math.floor(i/2)*16));
  for(let i=0;i<10;i++)tile(9,88+i*16,88);
  tile(194,88+Math.floor(view.month/6)*16,88);
  if(view.action.kind==='plant')badge(view.action.cropSlot,272,8,true);
  else {const action=SCHEDULE_ACTIONS.find(a=>a.kind===view.action.kind);if(action)badge(action.badge,272,8);}
  if(view.field){
    badge(view.field.cropSlot,32,8,true);
    view.field.weeks.forEach((code,i)=>tile(code,72+i*16,72));
    if(view.now>=view.month*4&&view.now<view.month*4+12){context.fillStyle=`rgb(${palette[1].join(',')})`;context.fillRect(78+(view.now-view.month*4)*16,72,3,16);}
    view.field.gauges.forEach((frame,i)=>context.drawImage(gauges,frame*48,0,48,24,[24,80,136,216,272][i],176,48,24));
    // a0c8 fills8px high: palette6 for progress,12 for the remainder.
    context.fillStyle=`rgb(${palette[12].join(',')})`;context.fillRect(104,147,80,8);
    context.fillStyle=`rgb(${palette[6].join(',')})`;context.fillRect(104,147,view.field.maturityPixels,8);
  }
}
