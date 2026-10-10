import type { ShopProduct } from '../simulation/shop-product';
/** Source478df..479f9 centers definition graphics on the Buy window's grass
 * inset. Cosmetic grass variation is deterministic and never advances game RNG. */
export function drawShopPreview(context: CanvasRenderingContext2D, product: ShopProduct, tiles: CanvasImageSource, maskedTiles: CanvasImageSource): void {
  context.clearRect(0,0,256,224); context.imageSmoothingEnabled = false;
  const draw = (image: CanvasImageSource, tile: number, x: number, y: number) => context.drawImage(image, tile % 32 * 16, Math.floor(tile / 32) * 16, 16,16,x,y,16,16);
  for (let x=0;x<4;x++) for(let y=0;y<3;y++) draw(tiles,19+(x+y)%4,176+x*16,16+y*16);
  if (product.tile === null || product.width > 4 || product.height > 4) return;
  for(let y=0;y<product.height;y++) for(let x=0;x<product.width;x++) {
    const tile=product.tile+y*product.width+x, masked=tile>=848 && tile<1048;
    draw(masked?maskedTiles:tiles,masked?tile-848:tile,212-product.width*8+x*16,40-product.height*8+y*16);
  }
}
