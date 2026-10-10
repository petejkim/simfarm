import type { ExamineObject } from '../simulation/examine-object';
/** Original card48,24; content sprites/building damage follow38f87..3969f. */
export function drawExamine(context:CanvasRenderingContext2D,view:ExamineObject,artwork:CanvasImageSource,cards:CanvasImageSource,
  tiles:CanvasImageSource,maskedTiles:CanvasImageSource,palette:readonly (readonly number[])[]){
  context.clearRect(0,0,208,192);context.imageSmoothingEnabled=false;
  // Shared draggable titlebar supplies the top16 pixels; retain all client frame pixels.
  context.drawImage(artwork,0,16,208,192,0,0,208,192);
  if(view.card>=0&&view.card<80)context.drawImage(cards,view.card%8*112,Math.floor(view.card/8)*64,112,64,48,8,112,64);
  for(const sprite of view.tiles){
    const {tile,x,y}=sprite;if(tile<0||tile>=1392)continue;
    const masked=tile>=848&&tile<1048,index=masked?tile-848:tile;
    context.drawImage(masked?maskedTiles:tiles,index%32*16,Math.floor(index/32)*16,16,16,x,y-16,16,16);
  }
  if(view.damage!==undefined){
    context.fillStyle=`rgb(${palette[13].join(',')})`;context.fillRect(96,90,64,8);
    context.fillStyle=`rgb(${palette[3].join(',')})`;context.fillRect(96,90,view.damage,8);
  }
}
