import { useEffect, useLayoutEffect, useRef } from 'react';
import type { GameAssets } from '../assets/game-assets';
import type { Scenario } from '../formats/scenario';
import { cropPlantTile } from '../formats/crop-slots';
import { drawFieldToolMenu } from '../render/field-tool-menu';
import { FIELD_TOOL_MENUS, SPRAY_TOOLS, type FieldMapTool } from '../formats/field-tool-menu';

/** Original Edit popups, not floating document windows. No bitmap text. */
export function FieldToolMenu({kind,assets,world,tiles,onChoose,onClose}:{kind:'plant'|'spray';assets:GameAssets;world:Scenario;
  tiles:CanvasImageSource;onChoose:(tool:FieldMapTool)=>void;onClose:()=>void}){
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const geometry={...FIELD_TOOL_MENUS[kind],...(kind==='plant'?{width:Math.ceil(world.cropFiles.length/8)*112}:{})};
  const items=kind==='plant'?world.cropFiles.map((file,slot)=>{
    const crop=assets.catalog.crops.find(c=>`${c.id}.crp`===file)!;
    const available=world.farm.autoBuySeeds||world.seedDefinitions[slot].count>0;
    return {label:crop.name,caption:available?crop.name:'NONE OWNED',tile:cropPlantTile(slot),tool:{kind:'plant' as const,cropSlot:slot}};
  }):SPRAY_TOOLS.map(tool=>({...tool,caption:tool.label,tool:{kind:tool.kind}}));
  useLayoutEffect(()=>{root.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus({preventScroll:true});},[kind]);
  useEffect(()=>{if(canvas.current)drawFieldToolMenu(canvas.current.getContext('2d')!,items.map(i=>i.tile),tiles,assets.maskedTiles,geometry);},[kind,world,tiles,assets]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))onClose();};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[onClose]);
  // Keep source popup coordinates; the permanent map has no outer frame.
  return <div ref={root} className="field-tool-menu" role="menu" aria-label={geometry.title} style={{left:geometry.x,top:geometry.y,width:geometry.width,height:geometry.height}}
    onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
      const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('[role=menuitem]')],i=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next=event.key==='ArrowDown'?i+1:event.key==='ArrowUp'?i-1:event.key==='ArrowRight'?i+8:event.key==='ArrowLeft'?i-8:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
      if(next!==null){event.preventDefault();event.stopPropagation();buttons[Math.max(0,Math.min(buttons.length-1,next))]?.focus();}
    }}>
    <canvas ref={canvas} width={geometry.width} height={geometry.height} aria-hidden="true"/>
    <span className="field-tool-title">{geometry.title}</span>
    {items.map((item,i)=><button key={item.label} role="menuitem" data-field-tool={item.tool.kind==='plant'?item.tool.cropSlot:item.tool.kind}
      title={item.label} aria-label={item.label} style={{left:Math.floor(i/8)*112,top:17+(i%8)*17,width:112,height:17}}
      onClick={()=>onChoose(item.tool)}><span>{item.caption}</span></button>)}

  </div>;
}
