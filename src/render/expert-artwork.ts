import type { ExpertCommand } from '../formats/expert-cards';

/** Draw illustrations only. All Expert text and interactive controls are React. */
export function drawExpertArtwork(context:CanvasRenderingContext2D,cards:CanvasImageSource,tiles:CanvasImageSource,page:readonly ExpertCommand[]){
  context.clearRect(0,0,400,224);context.imageSmoothingEnabled=false;
  for(const c of page){
    if(c.kind==='picture'&&c.card>=16&&c.card!==66&&c.cropSlot===undefined)
      context.drawImage(cards,c.card%8*112,Math.floor(c.card/8)*64,112,64,c.x,c.y-16,112,64);
    if(c.kind==='tiles')for(let row=0;row<c.rows;row++)for(let col=0;col<c.columns;col++){
      const tile=c.first+row*c.columns+col;
      context.drawImage(tiles,tile%32*16,Math.floor(tile/32)*16,16,16,c.x+col*16,c.y-16+row*16,16,16);
    }
  }
}
