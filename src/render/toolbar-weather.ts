/** Source2a518..2a552: three forecast tiles204+code, starting at the current day. */
export function drawToolbarWeather(context:CanvasRenderingContext2D,tiles:CanvasImageSource,forecast:readonly number[]){
  context.clearRect(0,0,48,16);context.imageSmoothingEnabled=false;
  forecast.slice(0,3).forEach((code,i)=>{
    const tile=204+code;
    context.drawImage(tiles,tile%32*16,Math.floor(tile/32)*16,16,16,i*16,0,16,16);
  });
}
