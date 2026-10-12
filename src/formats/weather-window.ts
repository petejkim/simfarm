import { Binary } from './binary';
import { decodePlanar,readBitmap,type Palette,type Raster } from './graphics';

/** Lettering in weather.bmp. Only black glyph pixels are replaced, retaining
 * the wallpaper's original white pattern and the instrument artwork. */
export const WEATHER_LABELS=[
  {x:108,y:28,width:120,height:10,text:"Today's Weather"},
  {x:103,y:157,width:132,height:11,text:'Five Day Forecast'},
  {x:14,y:160,width:73,height:11,text:'Evaporation'},
  {x:272,y:150,width:36,height:21,text:'Wind\nSpeed'},
  {x:270,y:36,width:29,height:20,text:'Avg\nRain'},
  {x:270,y:65,width:29,height:27,text:'Rain\nto\nDate'},
  {x:12,y:47,width:7,height:9,text:'F'},{x:12,y:63,width:7,height:9,text:'C'},
  {x:52,y:36,width:18,height:9,text:'100'},{x:57,y:63,width:13,height:9,text:'32'},
  {x:63,y:76,width:7,height:7,text:'0'},{x:86,y:36,width:12,height:9,text:'40'},
  {x:87,y:63,width:6,height:9,text:'0'},{x:63,y:92,width:7,height:7,text:'F'},
  {x:82,y:91,width:7,height:9,text:'C'},
  {x:233,y:30,width:13,height:10,text:'60'},{x:233,y:48,width:13,height:10,text:'40'},
  {x:233,y:66,width:13,height:10,text:'20'},{x:239,y:86,width:7,height:9,text:'0'},
  {x:28,y:129,width:10,height:6,text:'Lo',fill:15},{x:53,y:129,width:9,height:6,text:'Hi',fill:15},
] as const;
export function readWeatherArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==336||r.height!==192)throw new Error('Invalid Weather artwork');
  for(const m of WEATHER_LABELS)for(let y=m.y;y<m.y+m.height;y++)for(let x=m.x;x<m.x+m.width;x++){
    const i=(y*r.width+x)*4;
    if(r.rgba[i]===0&&r.rgba[i+1]===0&&r.rgba[i+2]===0)r.rgba.set([...palette['fill' in m?m.fill:12],255],i);
  }
  return r;
}
/** Source1dfd7/1e01e: four112×32 planar pictures,20-byte library header,
 * each record has a2-byte length and1792 picture bytes. */
export function readWeatherScenes(bytes:Uint8Array,palette:Palette):Raster {
  const b=new Binary(bytes);
  if(bytes.length!==7196||b.u16(0)!==1||b.u16(18)!==4)throw new Error('Invalid Weather scene library');
  const rgba=new Uint8Array(448*32*4);
  for(let i=0;i<4;i++){
    if(b.u16(20+i*1794)!==1792)throw new Error('Invalid Weather scene record');
    const r=decodePlanar(b.slice(22+i*1794,1792),112,32,palette);
    for(let y=0;y<32;y++)rgba.set(r.rgba.subarray(y*448,(y+1)*448),(y*448+i*112)*4);
  }
  return {width:448,height:32,rgba};
}
/** Startup3fc4a reads1024 bytes; animation1dbdf selects two32×32 frames. */
export function readWeatherVane(bytes:Uint8Array,palette:Palette):Raster {
  if(bytes.length!==1024)throw new Error('Invalid Weather vane');
  const rgba=new Uint8Array(64*32*4);
  for(let i=0;i<2;i++){
    const r=decodePlanar(bytes.subarray(i*512,(i+1)*512),32,32,palette);
    for(let y=0;y<32;y++)rgba.set(r.rgba.subarray(y*128,(y+1)*128),(y*64+i*32)*4);
  }
  return {width:64,height:32,rgba};
}
/** The 8×8 wallpaper tile behind Weather's instruments, cut from the cleaned
 * bitmap at client (0,26), just below the header panels. The pattern repeats
 * every 8 pixels in both directions across the clean areas of weather.bmp. */
export function readWeatherWallpaper(clean:Raster):Raster {
  const rgba=new Uint8Array(8*8*4);
  for(let y=0;y<8;y++)rgba.set(clean.rgba.subarray(((26+y)*clean.width+8)*4,((26+y)*clean.width+16)*4),y*32);
  return {width:8,height:8,rgba};
}
