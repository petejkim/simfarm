/** Popup37b3c..37e2e: column-major16px icons at row17,34,...; text stays in React. */
export function drawFieldToolMenu(context:CanvasRenderingContext2D,codes:number[],tiles:CanvasImageSource,maskedTiles:CanvasImageSource,geometry:{width:number;height:number}){
  context.clearRect(0,0,geometry.width,geometry.height);context.imageSmoothingEnabled=false;
  codes.forEach((code,i)=>{const masked=code>848&&code<1048,index=masked?code-848:code;
    context.drawImage(masked?maskedTiles:tiles,index%32*16,Math.floor(index/32)*16,16,16,Math.floor(i/8)*112,17+i%8*17,16,16);
  });
}
