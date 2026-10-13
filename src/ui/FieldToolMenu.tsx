import { useEffect, useLayoutEffect, useRef } from 'react';
import type { GameAssets } from '../assets/game-assets';
import type { Scenario } from '../formats/scenario';
import { cropPlantTile } from '../formats/crop-slots';
import { TileSprite } from './chrome/TileSprite';
import { FIELD_TOOL_MENUS, SPRAY_TOOLS, type FieldMapTool } from '../formats/field-tool-menu';
import { cssZoom } from './css-zoom';
import { usePhone } from './phone';

/** Original Edit popups (37b3c..37e2e), not floating document windows: a title row, then menu items in
 * column-major 112×17 cells, each a 16px tile sprite and its caption. Popup37b3c takes the masked atlas
 * only above tile 848. No bitmap text. */
export function FieldToolMenu({kind,assets,world,tiles,onChoose,onClose}:{kind:'plant'|'spray';assets:GameAssets;world:Scenario;
  tiles:HTMLImageElement;onChoose:(tool:FieldMapTool)=>void;onClose:()=>void}){
  const root=useRef<HTMLDivElement>(null),phone=usePhone();
  const geometry={...FIELD_TOOL_MENUS[kind],...(kind==='plant'?{width:Math.ceil(world.cropFiles.length/8)*112}:{})};
  const items=kind==='plant'?world.cropFiles.map((file,slot)=>{
    const crop=assets.catalog.crops.find(c=>`${c.id}.crp`===file)!;
    const available=world.farm.autoBuySeeds||world.seedDefinitions[slot].count>0;
    return {label:crop.name,caption:available?crop.name:'NONE OWNED',tile:cropPlantTile(slot),tool:{kind:'plant' as const,cropSlot:slot}};
  }):SPRAY_TOOLS.map(tool=>({...tool,caption:tool.label,tool:{kind:tool.kind}}));
  // Phones (native, user request): Plant in two columns, 28px rows for tapping, opened beside its palette button.
  // Desktop keeps the source 8-row columns, 17px rows and popup coordinates.
  const columns=phone?Math.min(2,Math.ceil(items.length/8)):Math.max(1,Math.round(geometry.width/112)),rows=phone?Math.ceil(items.length/columns):Math.min(8,items.length);
  useLayoutEffect(()=>{root.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus({preventScroll:true});},[kind]);
  useLayoutEffect(()=>{
    const menu=root.current,workspace=menu?.closest('.edit-workspace'),palette=workspace?.querySelector('.edit-palette');
    const button=workspace?.querySelector(kind==='plant'?'.edit-plant':'.edit-spray');
    if(!phone||!menu||!workspace||!palette||!button)return;
    // Beside the palette next to the button: above the bottom strip (portrait), right of the side palette (landscape);
    // clamped inside the workspace, scrolling if taller. Rects are zoomed screen px; styles are layout px.
    const place=()=>{
      const z=cssZoom(menu),area=workspace.getBoundingClientRect(),strip=palette.getBoundingClientRect(),at=button.getBoundingClientRect();
      const width=area.width/z,height=area.height/z;
      menu.style.maxHeight=`${height}px`;
      const w=menu.offsetWidth,h=menu.offsetHeight,clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v));
      const left=strip.width>strip.height?(at.left+at.width/2-area.left)/z-w/2:(strip.right-area.left)/z;
      const top=strip.width>strip.height?(strip.top-area.top)/z-h:(at.top-area.top)/z;
      menu.style.left=`${clamp(left,width-w)}px`;menu.style.top=`${clamp(top,height-h)}px`;
    };
    place();addEventListener('resize',place);return()=>removeEventListener('resize',place);
  },[phone,kind,columns]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))onClose();};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[onClose]);
  // Keep source popup coordinates; the permanent map has no outer frame.
  return <div ref={root} className="field-tool-menu" role="menu" aria-label={geometry.title} data-phone={phone||undefined}
    style={{...(phone?{}:{left:geometry.x,top:geometry.y}),gridTemplateColumns:`repeat(${columns},112px)`,gridTemplateRows:`auto repeat(${rows},${phone?28:17}px)`}}
    onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
      const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('[role=menuitem]')],i=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next=event.key==='ArrowDown'?i+1:event.key==='ArrowUp'?i-1:event.key==='ArrowRight'?i+rows:event.key==='ArrowLeft'?i-rows:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
      if(next!==null){event.preventDefault();event.stopPropagation();buttons[Math.max(0,Math.min(buttons.length-1,next))]?.focus();}
    }}>
    <span className="field-tool-title">{geometry.title}</span>
    {items.map((item,i)=><button key={item.label} type="button" role="menuitem" data-field-tool={item.tool.kind==='plant'?item.tool.cropSlot:item.tool.kind}
      title={item.label} aria-label={item.label} style={{gridColumn:Math.floor(i/rows)+1,gridRow:i%rows+2}}
      onClick={()=>onChoose(item.tool)}><TileSprite tile={item.tile} atlas={tiles.src} masked={assets.maskedTiles.src} maskStart={849}/><span>{item.caption}</span></button>)}

  </div>;
}
