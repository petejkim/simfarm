import {readBitmap,type Palette,type Raster} from './graphics';

/** DS a3dd..a43e, drawn at x144/y88 with nine-pixel line pitch. */
export const ABOUT_INTRO=['    Concept','  Programming','      And','    Design','      By','  Eric Albers','Leaping Lizard','   Software'] as const;
export const ABOUT_TEXT_MASKS=[
  {x:108,y:2,width:180,height:40,color:15},
  {x:96,y:184,width:216,height:24,color:12},
] as const;
export function readAboutArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==400||r.height!==224)throw new Error('Invalid About artwork');
  for(const m of ABOUT_TEXT_MASKS)for(let y=m.y;y<m.y+m.height;y++)for(let x=m.x;x<m.x+m.width;x++)
    r.rgba.set([...palette[m.color],255],(y*r.width+x)*4);
  return r;
}
export function readAboutLogo(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==104||r.height!==112)throw new Error('Invalid About logo');
  // Keep the lizard illustration, replace both bitmap caption lines with HTML.
  for(let y=90;y<112;y++)for(let x=0;x<104;x++)r.rgba.set([...palette[12],255],(y*104+x)*4);
  return r;
}
/** Original callback3e026 reads twelve lines per page and stops at a backtick. */
export function readAboutCredits(bytes:Uint8Array):string[][] {
  if(!bytes.length||bytes.length>32768||bytes.some(b=>b!==10&&b!==13&&(b<32||b>126)))throw new Error('Invalid About credits');
  const lines=new TextDecoder().decode(bytes).split(/\r?\n/),end=lines.findIndex(line=>line.startsWith('`'));
  if(end<0||lines.slice(0,end).some(line=>line.length>79))throw new Error('Invalid About credits boundary');
  const pages:string[][]=[];
  for(let i=0;i<end;i+=12)pages.push(lines.slice(i,Math.min(i+12,end)).map(line=>line.trimEnd()));
  return pages;
}
