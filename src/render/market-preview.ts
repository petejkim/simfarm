import {cropBadgeTile} from '../formats/crop-slots';
/** Source4a776: bars, then the grid/reference lines, then crop badges/frame. */
export function drawMarketPreview(context:CanvasRenderingContext2D,tiles:CanvasImageSource,palette:readonly number[][],
  view:{page:number;cropCount:number;slot:number;history:{top:number|null}[]}){
  context.clearRect(0,0,320,208);context.imageSmoothingEnabled=false;
  const color=(n:number)=>{context.fillStyle=`rgb(${palette[n].join(',')})`;};
  color(12);context.fillRect(24,20,120,140);
  color(3);view.history.forEach((sample,i)=>{if(sample.top!==null)context.fillRect(25+i*4,sample.top,4,160-sample.top);});
  color(14);for(let x=24;x<148;x+=4)context.fillRect(x,20,1,141);
  for(let y=20;y<160;y+=4)context.fillRect(24,y,121,1);
  color(1);context.fillRect(24,92,121,2);
  for(let i=0;i<16&&view.page*16+i<view.cropCount;i++)for(let part=0;part<4;part++){
    const tile=cropBadgeTile(view.page*16+i,part);
    context.drawImage(tiles,tile%32*16,Math.floor(tile/32)*16,16,16,176+i%4*32+part%2*16,8+Math.floor(i/4)*32+Math.floor(part/2)*16,16,16);
  }
  if(Math.floor(view.slot/16)===view.page){const i=view.slot%16,x=176+i%4*32,y=8+Math.floor(i/4)*32;
    color(8);context.fillRect(x,y,32,2);context.fillRect(x,y+30,32,2);context.fillRect(x,y,2,32);context.fillRect(x+30,y,2,32);
  }
}
