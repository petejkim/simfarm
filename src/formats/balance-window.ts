import {readBitmap,type Palette,type Raster} from './graphics';

export const BALANCE_LABELS=[
  {x:24,y:8,width:176,text:'ASSETS',fill:8,light:true},{x:208,y:8,width:168,text:'EXPENDITURES',fill:8,light:true},
  ...['Cash','Machinery','Land','Futures','Livestock'].map((text,i)=>({x:24,y:24+i*8,width:112,text,fill:i%2?15:12,light:false})),
  {x:24,y:88,width:112,text:'TOTAL ASSETS',fill:13,light:true},
  {x:24,y:104,width:176,text:'ANNUAL REVENUE',fill:8,light:true},
  ...['Crop Sales','Machinery Sales','Land Sales','Futures Sold','Animal Sales'].map((text,i)=>({x:24,y:120+i*8,width:120,text,fill:i%2?15:12,light:false})),
  ...['Seed','Machinery','Land Purchases','Futures Losses','Structures','Livestock','Chemicals','Loan Interest','Leased Machines','Taxes','Miscellaneous'].map((text,i)=>({x:208,y:24+i*8,width:120,text,fill:i%2?15:12,light:false})),
  {x:208,y:152,width:112,text:'TOTAL EXPENSES',fill:13,light:true},
  {x:24,y:168,width:112,text:'TOTAL REVENUE',fill:13,light:true},
  {x:208,y:168,width:104,text:'PROFIT/LOSS',fill:13,light:true},
  {x:24,y:184,width:168,text:'Estimated Taxes',fill:12,light:false},
  {x:24,y:192,width:168,text:'Quarterly Loan Payment',fill:15,light:false},
  {x:332,y:190,width:40,height:12,text:'CLOSE',fill:12,light:false},
];
/** cashflow.bmp: solid row backgrounds allow removing just lettering. */
export function readBalanceArtwork(bytes:Uint8Array,palette:Palette):Raster {
  const r=readBitmap(bytes,palette);
  if(r.width!==400||r.height!==224)throw new Error('Invalid Balance Sheet artwork');
  for(const m of BALANCE_LABELS)for(let y=m.y;y<m.y+('height' in m?m.height!:8);y++)for(let x=m.x;x<m.x+m.width;x++){
    const i=(y*r.width+x)*4,c=m.light?255:0;
    if(r.rgba[i]===c&&r.rgba[i+1]===c&&r.rgba[i+2]===c)r.rgba.set([...palette[m.fill],255],i);
  }
  return r;
}
