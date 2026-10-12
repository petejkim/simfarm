import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../../src/formats/archive';
const source=(name:string)=>readFileSync(new URL('../../../simfarm-dos/'+name,import.meta.url));
const cursors=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')).find(a=>a.name==='cursors.til')!.bytes;
const exe=source('SIMFARM.EXE');

test('served Edit cursor pixels use startup resource artwork, including both hands',async({page})=>{
  await page.goto('/');
  for(const [name,offset] of [['move-pick',0],['move-drop',256],['edit-view',512],['edit-buy',1024],['edit-spray',1280],['edit-bulldoze',-1]] as const){
    const actual=await page.evaluate(async name=>{
      const img=new Image();img.src=`/assets/${name}.png`;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);
      return {width:img.width,height:img.height,pixels:Array.from(ctx.getImageData(0,0,16,16).data)};
    },name);
    const expected:number[]=[];
    for(let i=0;i<256;i++){
      const bit=128>>(i%8),byte=i>>3;
      const mask=(offset<0?exe[0x85fc8+byte]:cursors[offset+byte])&bit;
      const color=mask&&((offset<0?exe[0x85fe8+byte]:cursors[offset+128+byte])&bit)?255:0;
      expected.push(color,color,color,mask?255:0);
    }
    expect(actual,name).toEqual({width:16,height:16,pixels:expected});
  }
});
