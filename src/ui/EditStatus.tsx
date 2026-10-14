import {useEffect,useRef,useState} from 'react';
import {readEditStatus} from '../formats/edit-status';
import {formatToolCost} from './tool-cost';
/** The selected tool's cost follows the current message: the original draws it in the Edit titlebar, which the
 * native workspace removed. */
export function EditStatus({codes,text,cost=null}:{codes:readonly number[];text:readonly string[];cost?:number|null}){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  return <div ref={root} className="edit-status" onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);button.current?.focus();}}}>
    <button ref={button} className="edit-status-current" aria-label="Edit message history" aria-expanded={open} onClick={()=>setOpen(!open)}>{codes.length?readEditStatus(text,codes[0]):''}{cost!==null&&<span className="edit-status-cost">{` (${formatToolCost(cost)})`}</span>}</button>
    {open&&<ol className="edit-status-history" aria-label="Recent Edit messages" onClick={()=>{setOpen(false);button.current?.focus();}}>{codes.map((code,i)=><li key={i}>{readEditStatus(text,code)}</li>)}</ol>}
  </div>;
}
