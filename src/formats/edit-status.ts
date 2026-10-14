/** Reader4a0be uses code*64, reads62 bytes and terminates at62. */
export function readEditStatus(bytes:Uint8Array|readonly string[],code:number):string {
  if(!Number.isInteger(code)||code<0||code>=76)throw new Error('Invalid Edit status code');
  if(!(bytes instanceof Uint8Array)){
    if(typeof bytes[code]!=='string')throw new Error('Truncated Edit status record');
    return bytes[code];
  }
  const offset=code*64;if(bytes.length<offset+64)throw new Error('Truncated Edit status record');
  return new TextDecoder('ascii').decode(bytes.subarray(offset,offset+62)).split('\0')[0].replace(/@/g,' ').trim();
}
