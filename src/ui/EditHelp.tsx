import {useEffect,useLayoutEffect,useRef} from 'react';
import {EDIT_HELP_LABELS} from '../formats/edit-help';

/** Attached palette legend, not a movable document window. */
export function EditHelp({artwork,onClose,onAdvanced}:{artwork:HTMLImageElement;onClose:()=>void;onAdvanced:()=>void}){
  const root=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{root.current?.focus({preventScroll:true});},[]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{
      const target=event.target as Element;
      if(!root.current?.contains(target)&&!target.closest('[data-edit-help-trigger]'))onClose();
    };
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[onClose]);
  return <aside ref={root} className="edit-help" tabIndex={-1} aria-label="Edit tool help" onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();document.querySelector<HTMLButtonElement>('[data-edit-help-trigger]')?.focus();}
  }}>
    <div className="edit-help-artwork"><img src={artwork.src} width={88} height={200} alt="" draggable={false}/>
      {EDIT_HELP_LABELS.map(([text,y])=><span key={text} style={{top:y}}>{text}</span>)}
    </div>
    <button onClick={onAdvanced}>Advanced controls</button>
  </aside>;
}
