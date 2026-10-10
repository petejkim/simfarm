import {cropBadgeTile} from '../formats/crop-slots';
import type {EvaluationView} from '../simulation/evaluation-view';

export function drawEvaluationPreview(context:CanvasRenderingContext2D,tiles:CanvasImageSource,palette:readonly number[][],view:EvaluationView,page:number){
  context.clearRect(0,0,352,192);context.imageSmoothingEnabled=false;
  const tile=(id:number,x:number,y:number)=>context.drawImage(tiles,id%32*16,Math.floor(id/32)*16,16,16,x,y,16,16);
  const fill=(color:number,x:number,y:number,width:number,height:number)=>{context.fillStyle=`rgb(${palette[color].join(',')})`;context.fillRect(x,y,width,height);};
  view.gauges.forEach((g,i)=>{fill(g.color,192,8+i*16,g.width,8);fill(14,192+g.width,8+i*16,80-g.width,8);});
  tile(200+view.season,304,16);
  for(let i=0;i<8;i++){
    const x=Math.floor(i/2)*32,y=112+i%2*32;
    if(view.problems[i])for(let p=0;p<4;p++)tile(539+(16+i)*4+p,16+x+p%2*16,y+Math.floor(p/2)*16);
    const crop=view.suggestions[page*8+i];
    if(crop)for(let p=0;p<4;p++)tile(cropBadgeTile(crop.slot,p),152+x+p%2*16,y+Math.floor(p/2)*16);
  }
}
