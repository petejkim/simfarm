import type {WeatherWindowView} from '../simulation/weather-view';

export function drawWeatherPreview(context:CanvasRenderingContext2D,assets:{sky:CanvasImageSource;ground:CanvasImageSource;vane:CanvasImageSource},
  tiles:CanvasImageSource,gauges:CanvasImageSource,palette:readonly number[][],view:WeatherWindowView,frame:number){
  context.clearRect(0,0,336,192);context.imageSmoothingEnabled=false;
  const tile=(id:number,x:number,y:number)=>context.drawImage(tiles,id%32*16,Math.floor(id/32)*16,16,16,x,y,16,16);
  tile(200+view.season,16,5);tile(200+view.nextSeason,304,5);
  context.drawImage(assets.sky,view.sky*112,0,112,32,112,48,112,32);
  context.drawImage(assets.ground,view.season*112,0,112,32,112,80,112,32);
  context.drawImage(assets.vane,(frame&1)*32,0,32,32,272,104,32,32);
  context.drawImage(gauges,view.evaporationFrame*48,0,48,24,24,104,48,24);
  const fill=(color:number,x:number,y:number,width:number,height:number)=>{context.fillStyle=`rgb(${palette[color].join(',')})`;context.fillRect(x,y,width,height);};
  fill(15,72,36,8,44);fill(3,72,80-view.temperatureHeight,8,view.temperatureHeight);
  fill(15,248,36,8,55);fill(6,248,91-view.rainHeight,8,view.rainHeight);
  view.forecast.forEach((code,i)=>tile(204+code,112+i*24,136));
}
