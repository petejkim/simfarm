import {readBitmap,type Palette,type Raster} from './graphics';

/** Direct chooser3c04e..3c3a7; coordinates relative to bitmap origin96,96. */
export const TOWN_CHOICES=[
  {choice:'residential',label:'Residential',x:16},
  {choice:'commercial',label:'Commercial',x:104},
  {choice:'airport',label:'Airport',x:192},
  {choice:'recreational',label:'Recreational',x:280},
] as const;
export const TOWN_INSTRUCTIONS='The town is purchasing a new plot of land. The mayor is asking voters to decide what kind of plot should be built. Click on your preference for what kind of plot the town should build.';
export const TOWN_TEXT_MASKS=[{x:8,y:104,width:352,height:16},{x:68,y:132,width:232,height:72}] as const;

export function readTownChoiceArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==368||r.height!==224)throw new Error('Invalid town choice artwork');
  for(const m of TOWN_TEXT_MASKS)for(let y=m.y;y<m.y+m.height;y++)for(let x=m.x;x<m.x+m.width;x++){
    const i=(y*r.width+x)*4;
    if(r.rgba[i]===0&&r.rgba[i+1]===0&&r.rgba[i+2]===0)r.rgba.set([...palette[12],255],i);
  }
  return r;
}

/** Overlay7:081e/file338ee swaps two bevel lines, leaving the picture intact. */
export function townChoicePressedArtwork(palette:Palette):Raster {
  const r={width:73,height:73,rgba:new Uint8Array(73*73*4)};
  const h=(x:number,end:number,y:number,c:number)=>{for(;x<=end;x++)r.rgba.set([...palette[c],255],(y*73+x)*4);};
  const v=(x:number,y:number,end:number,c:number)=>{for(;y<=end;y++)r.rgba.set([...palette[c],255],(y*73+x)*4);};
  h(1,70,1,13);h(1,69,2,13);v(1,1,70,13);v(2,1,69,13);
  h(2,71,71,15);h(3,71,70,15);v(71,2,71,15);v(70,3,71,15);
  return r;
}
