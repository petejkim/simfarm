import {useEffect,useRef,useState} from 'react';
import {readEditStatus} from '../formats/edit-status';
export function EditStatus({codes,text}:{codes:readonly number[];text:Uint8Array}){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  return <div ref={root} className="edit-status" onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);button.current?.focus();}}}>
    <button ref={button} className="edit-status-current" aria-label="Edit message history" aria-expanded={open} onClick={()=>setOpen(!open)}>{codes.length?readEditStatus(text,codes[0]):''}</button>
    {open&&<ol className="edit-status-history" aria-label="Recent Edit messages" onClick={()=>{setOpen(false);button.current?.focus();}}>{codes.map((code,i)=><li key={i}>{readEditStatus(text,code)}</li>)}</ol>}
  </div>;
}
