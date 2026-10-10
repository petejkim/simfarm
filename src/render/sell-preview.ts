import type { SellProduct } from '../simulation/sell-products';
/** Original4c610: row-major item image at48,row, vertically centered for16px items. */
export function drawSellPreview(context: CanvasRenderingContext2D, rows: readonly SellProduct[], tiles: CanvasImageSource, maskedTiles: CanvasImageSource) {
  context.clearRect(0,0,192,256);context.imageSmoothingEnabled=false;
  rows.forEach((product,row)=>{
    if(product.tile===null||product.width>4||product.height>4)return;
    for(let y=0;y<product.height;y++)for(let x=0;x<product.width;x++){
      const tile=product.tile+y*product.width+x, masked=tile>=848&&tile<1048,index=masked?tile-848:tile;
      context.drawImage(masked?maskedTiles:tiles,index%32*16,Math.floor(index/32)*16,16,16,48+x*16,96+row*32+(product.height===1?8:0)+y*16,16,16);
    }
  });
}
