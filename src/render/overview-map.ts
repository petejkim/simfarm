import type { Scenario } from '../formats/scenario';
import type { Palette, Raster } from '../formats/graphics';
import type { MapMiniature, MapMode } from '../formats/map-window';

/** Map overlay8:341de..34a0a. Original packed miniature indices, not scaled
 * main-map sprites. Native extra crop slots use the first crop's MBM shapes. */
export function overviewTiles(world: Scenario, mode: MapMode, moisture: number): Uint16Array {
  if (!Number.isInteger(mode) || mode<0 || mode>8 || !Number.isInteger(moisture) || moisture< -128 || moisture>127 ||
    world.cells.length!==9216 || world.regionalConditions.length!==1008) throw new Error('Invalid overview state');
  const out = new Uint16Array(9216);
  for(let x=0;x<96;x++)for(let y=0;y<96;y++){
    const index=x*96+y,cell=world.cells[index];let tile=cell.terrain&2047;
    if(tile>=1280&&tile<1344)tile=688+(tile-1280)%8;
    else if(tile>=1344&&tile<1376)tile=539+(tile-1344)%4;
    else if(tile>=1376&&tile<1384)tile=816;
    else if(tile>=1384&&tile<1392)tile=832;
    if(mode===1){const owner=world.regionalConditions[((x>>3)*12+(y>>3))*7+1];
      if(owner>3)throw new Error('Invalid overview ownership');
      if(owner)tile=[464,495,463,466][owner];
    }else if(mode===7)tile=cell.terrain&0x2000?495:467+moisture+cell.attribute;
    else if(mode>=2){
      const field=cell.overlay&0x1000?world.fields.find(f=>f.contains(x,y)):undefined;
      if(mode===8){if(field)tile=495-(field.bytes[19]>>3);}
      else tile=field?464+(field.bytes[({2:32,3:29,4:22,5:20,6:21} as const)[mode as 2|3|4|5|6]]>>3):mode===3?495:464;
    }
    if(tile>=960)throw new Error('Overview tile outside miniature atlas');
    out[index]=tile;
  }
  return out;
}
export function renderOverview(world: Scenario, atlas: MapMiniature, palette: Palette, mode: MapMode, moisture: number,
  selected: {x:number;y:number}): Raster {
  if(atlas.width!==64||atlas.height!==60||atlas.rgba.length!==15360||atlas.inverted.width!==64||atlas.inverted.height!==60||atlas.inverted.rgba.length!==15360||palette.length!==16 ||
    ![selected.x,selected.y].every(n=>Number.isInteger(n)&&n>=0&&n<12))throw new Error('Invalid overview graphics');
  const tiles=overviewTiles(world,mode,moisture),rgba=new Uint8Array(192*192*4);
  for(let x=0;x<96;x++)for(let y=0;y<96;y++){
    const tile=tiles[x*96+y],sx=(tile&31)*2,sy=(tile>>5)*2;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      // Source0863:075a ->0416:059f sets VGA XOR logical operation18.
      const source=mode===1&&(x>>3)===selected.x&&(y>>3)===selected.y?atlas.inverted:atlas;
      let color=source.rgba.subarray(((sy+dy)*64+sx+dx)*4,((sy+dy)*64+sx+dx+1)*4);
      if(mode===1&&((x*2+dx)%16===0||(y*2+dy)%16===0))color=Uint8Array.from([...palette[1],255]);
      rgba.set(color,((y*2+dy)*192+x*2+dx)*4);
    }
  }
  return {width:192,height:192,rgba};
}

/**35095..35131 repeats each2×2 tile464..495 four times vertically. */
export function renderOverviewLegend(atlas: Raster): Raster {
  if(atlas.width!==64||atlas.height!==60||atlas.rgba.length!==15360)throw new Error('Invalid miniature legend atlas');
  const rgba=new Uint8Array(64*8*4);
  for(let i=0;i<32;i++)for(let y=0;y<8;y++){
    const tile=464+i,p=(((tile>>5)*2+y%2)*64+(tile&31)*2)*4;
    rgba.set(atlas.rgba.subarray(p,p+8),(y*64+i*2)*4);
  }
  return {width:64,height:8,rgba};
}
