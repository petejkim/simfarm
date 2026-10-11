/** Message44 dispatcher3035c[44] selects portrait74; common loader reads record44. */
export const WATER_STORAGE_MESSAGE={record:44,portrait:74} as const;
export function readWaterStorageMessage(bytes:Uint8Array):string {
  const offset=WATER_STORAGE_MESSAGE.record*256;
  if(bytes.length<offset+256)throw new Error('Truncated water storage message');
  return new TextDecoder('ascii').decode(bytes.subarray(offset,offset+254)).split('\0')[0]
    .replace(/@/g,' ').replace(/\s+/g,' ').trim();
}
