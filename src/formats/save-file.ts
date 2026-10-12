import {MAX_SAVE_BYTES} from './native-save';

/** File transport only; the canonical checkpoint schema remains unchanged. */
export async function compressSave(text:string):Promise<Blob>{
  const input=new Blob([text]);
  if(input.size>MAX_SAVE_BYTES)throw new Error('The save is too large.');
  const data=await new Response(input.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return new Blob([data],{type:'application/gzip'});
}

/** Detect gzip by bytes, so renamed downloads and legacy JSON/SSM still load. */
export async function readSaveFile(file:Blob,signal?:AbortSignal):Promise<Uint8Array>{
  if(file.size>MAX_SAVE_BYTES)throw new Error('The file is too large.');
  signal?.throwIfAborted();
  const header=new Uint8Array(await file.slice(0,2).arrayBuffer());
  const stream=header[0]===0x1f&&header[1]===0x8b
    ?file.stream().pipeThrough(new DecompressionStream('gzip')):file.stream();
  const reader=stream.getReader(),chunks:Uint8Array[]=[];
  let length=0;
  const abort=()=>{void reader.cancel(signal?.reason).catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try{
    signal?.throwIfAborted();
    while(true){
      const {done,value}=await reader.read();signal?.throwIfAborted();
      if(done)break;
      length+=value.byteLength;
      if(length>MAX_SAVE_BYTES)throw new Error('The expanded file is too large.');
      chunks.push(value);
    }
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return bytes;
  }finally{
    signal?.removeEventListener('abort',abort);
    await reader.cancel().catch(()=>{});reader.releaseLock();
  }
}
