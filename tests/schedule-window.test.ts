import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readPalette, readBitmap, decodePlanar } from '../src/formats/graphics';
import { readScheduleArtwork, readFieldGauges, SCHEDULE_TEXT_MASKS, SCHEDULE_ACTIONS } from '../src/formats/schedule-window';
import { scheduleFieldView, scheduleCropHint } from '../src/simulation/schedule-view';
import { readScenario } from '../src/formats/scenario';
import { GameSimulation } from './support/game';
import { browserCrops } from './support/crop-catalog';
const source=(name:string)=>readFileSync(new URL('../../simfarm-dos/'+name,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(name:string)=>entries.find(e=>e.name===name)!.bytes,palette=readPalette(asset('simfarm.pal'));
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

test('Schedule descriptor, controls, display branches and graphics are pinned to immutable source bytes',()=>{
  assert.equal(hash(exe),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const ds=0x846f0,p=ds+0x5d8c;
  assert.deepEqual([4,6,8,10].map(i=>exe.readUInt16LE(p+i)),[160,80,336,240]);
  assert.equal(exe.subarray(ds+0x5cc2,ds+0x5cca).toString(),'SCHEDULE');
  let node=exe.readUInt16LE(p+48);const buttons=[];
  while(node&&buttons.length<8){buttons.push([10,2,4,6,8].map(i=>exe.readUInt16LE(ds+node+i)));node=exe.readUInt16LE(ds+node+18);}
  assert.equal(node,0);assert.deepEqual(buttons,[[5,82,29,18,23],[6,236,29,18,23],[9,72,104,16,16],[10,248,104,16,16],[29,272,93,48,16],[30,272,77,48,16],[31,272,117,48,16]]);
  assert.equal(exe.readUInt16LE(0x4ec60+0x90c),832);
  assert.deepEqual([...exe.subarray(ds+0x6128,ds+0x612e)],SCHEDULE_ACTIONS.map(a=>a.badge));
  assert.deepEqual([0,2,4,6].map(i=>exe.readUInt16LE(0x4ec60+0x8f2+i)),[915,914,913,912]);
  assert.equal(hash(exe.subarray(0x2d2b2,0x2d97d)),'1dca71a766aeea5e7c9cb238a2eb730b11022b002fba1fcff42d6534e30eccf3');
  assert.equal(hash(exe.subarray(0x2ddec,0x2df9c)),'70be2202f323747262c31b1a1763dd7e62618d259dbbb5a27433d1e7528fb37e');
  assert.equal(hash(exe.subarray(0x4a196,0x4a1fc)),'eeec7751e2fb65a460d1f7516a5573e6962550f9fad5b2a059edd6bc4c0aab00');
  assert.equal(hash(exe.subarray(0xa0c8,0xa114)),'c60c7e08f705f4324418fbd401ce73bd8278bce947eadbd1e570f4c1ebb3bed7');
  const bytes=asset('fdstatus.bmp'),before=Uint8Array.from(bytes),original=readBitmap(bytes,palette),live=readScheduleArtwork(bytes,palette);
  assert.equal(hash(bytes),'38b29a5769e673d984fd13e9ed09b9ffd2c2f059fc21812786e742fce8a9aa3f');
  for(let y=0;y<224;y++)for(let x=0;x<336;x++){
    const p=(y*336+x)*4,mask=SCHEDULE_TEXT_MASKS.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    assert.deepEqual(live.rgba.subarray(p,p+4),mask?Uint8Array.from([...palette[12],255]):original.rgba.subarray(p,p+4));
  }
  assert.deepEqual(Uint8Array.from(bytes),before);
  for(const n of [0,7,8,18824,37639])assert.throws(()=>readScheduleArtwork(bytes.subarray(0,n),palette));
  const wrong=Uint8Array.from(bytes);wrong[0]=21;wrong[2]=192;wrong[3]=1;assert.throws(()=>readScheduleArtwork(wrong,palette));
});

test('all20 field gauges decode independently at576-byte boundaries without changing the archive',()=>{
  const bytes=asset('fldgrph.til'),before=Uint8Array.from(bytes),sheet=readFieldGauges(bytes,palette);
  assert.equal(hash(bytes),'f4f1e37a9465679781786d85d3b2d34b0e3e97757fb0c12bb53eef06a77a5fe6');
  assert.equal(sheet.width,960);assert.equal(sheet.height,24);
  for(let i=0;i<20;i++){
    const original=decodePlanar(bytes.subarray(i*576,(i+1)*576),48,24,palette);
    for(let y=0;y<24;y++)assert.deepEqual(sheet.rgba.subarray((y*960+i*48)*4,(y*960+i*48+48)*4),original.rgba.subarray(y*192,(y+1)*192));
    assert.throws(()=>readFieldGauges(bytes.subarray(0,(i+1)*576-1),palette));
  }
  assert.throws(()=>readFieldGauges(new Uint8Array(11521),palette));assert.deepEqual(Uint8Array.from(bytes),before);
});

test('Schedule reads all original farms and all24 crops without mutating records or checkpoints',()=>{
  for(let id=0;id<8;id++){
    const game=new GameSimulation(readScenario(source(`SCEN${id}.SSM`)),browserCrops).withAllCrops(browserCrops),world=game.getSnapshot().scenario;
    const before=game.save(id);
    for(const field of world.fields.filter(f=>f.active)){
      const crop=browserCrops.find(c=>`${c.id}.crp`===world.cropFiles[field.cropSlot])!;
      for(const month of [0,11,12,48,57]){const view=scheduleFieldView(world,field,crop,month);assert.ok(view.gauges.every(n=>n>=0&&n<15));assert.ok(view.maturityPixels<=75);assert.ok(view.quality>=0&&view.quality<4);}
    }
    for(const file of world.cropFiles){const crop=browserCrops.find(c=>`${c.id}.crp`===file)!;
      assert.equal(scheduleCropHint(crop,'water'),crop.rawDefinition[40]>>>1);
      const heat=crop.rawDefinition[30]|crop.rawDefinition[31]<<8;assert.equal(scheduleCropHint(crop,'temperature'),Math.floor(heat/7)+50);
    }
    assert.equal(game.save(id),before);
  }
});

test('Schedule preserves source gauge thresholds, signed water arithmetic, maturity steps and current-season labels',()=>{
  const world=readScenario(source('SCEN0.SSM')),field=world.fields[1],crop={...browserCrops[0],rawDefinition:[...browserCrops[0].rawDefinition]};
  crop.rawDefinition[30]=crop.rawDefinition[31]=0;crop.rawDefinition[40]=20;crop.rawDefinition[42]=60;crop.rawDefinition[56]=10;
  field.bytes[2]=4;field.bytes[51]=field.bytes[52]=0;field.bytes[34]=10;field.bytes[28]=255;
  const f=new DataView(field.bytes.buffer,field.bytes.byteOffset,field.bytes.byteLength);f.setUint16(18,0,true);
  for(const [water,frame] of [[0,5],[19,5],[20,6],[39,6],[40,7],[59,7],[60,9],[65535,9]]){
    f.setUint16(24,water,true);assert.equal(scheduleFieldView(world,field,crop,0).gauges[3],frame);
  }
  for(const [value,frame] of [[0,0],[51,0],[52,1],[103,1],[104,2],[155,2],[156,3],[207,3],[208,4],[255,4]]){
    for(const offset of [20,21,22,29])field.bytes[offset]=value;
    assert.deepEqual(scheduleFieldView(world,field,crop,0).gauges.filter((_,i)=>i!==3),[frame,frame,frame,10+frame]);
    assert.equal(field.bytes[28],255); // Opening Schedule does not write the original cached soil byte.
  }
  let view=scheduleFieldView(world,field,crop,0);assert.equal(view.maturityPixels,75);assert.equal(view.quality,3);
  for(const [loss,quality] of [[0,3],[16383,3],[16384,2],[32768,1],[49152,0],[65535,0]]){f.setUint16(18,loss,true);assert.equal(scheduleFieldView(world,field,crop,0).quality,quality);}
  crop.rawDefinition[40]=250;crop.rawDefinition[42]=130;f.setUint16(24,32704,true);
  assert.equal(scheduleFieldView(world,field,crop,0).gauges[3],6); // low clamps to0; sign-extended upper=65410, midpoint32705.
  f.setUint16(24,32705,true);assert.equal(scheduleFieldView(world,field,crop,0).gauges[3],7);
  for(const [week,season] of [[0,'Winter'],[9,'Winter'],[10,'Spring'],[23,'Spring'],[24,'Summer'],[34,'Summer'],[35,'Fall'],[44,'Fall'],[45,'Winter'],[47,'Winter']] as const){
    world.farm.calendar.month=Math.floor(week/4);world.farm.calendar.week=week%4;
    view=scheduleFieldView(world,field,crop,57);assert.equal(view.season,season);assert.equal(view.year,world.farm.calendar.year+4);
  }
  for(const month of [-1,58,NaN,.5])assert.throws(()=>scheduleFieldView(world,field,crop,month));
});


test('View object field entry selects its field and copies current month into the Schedule view',()=>{
  assert.equal(exe.subarray(0x38b9b,0x38ba0).toString('hex'),'9ab8015719'); // field finder1b928.
  assert.equal(exe.subarray(0x38bf2,0x38bfd).toString('hex'),'689061688c5d9a2810e624'); // Schedule descriptor/create.
  assert.equal(exe.subarray(0x38c43,0x38c5e).toString('hex'),
    '8a46ce8e062ecc26a230618e0630cc26a056128e0632cc26a2f75d');
  assert.equal(exe.subarray(0x2df0a,0x2df11).toString('hex'),'26a05612a2f75d'); // TODAY copies the same month.
});
