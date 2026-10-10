import type {FinanceNoticeId} from '../simulation/events';

/** Overlay4 jump table3035c, after3025f removes the mandatory flag128. */
export const FINANCE_MESSAGES:Record<FinanceNoticeId,{record:number;portrait:number}>={
  36:{record:36,portrait:76},39:{record:39,portrait:76},
  159:{record:31,portrait:76},161:{record:33,portrait:74},162:{record:34,portrait:74},
  163:{record:35,portrait:76},165:{record:37,portrait:75},166:{record:38,portrait:74},
  168:{record:40,portrait:75},169:{record:41,portrait:74},170:{record:42,portrait:75},
};
/** Loader4a2ee reads256 bytes, converts @ to spaces and terminates at254.
 * Renderer882e treats CR/LF and padding as whitespace, then wraps words. */
export function readFinanceMessage(bytes:Uint8Array,id:FinanceNoticeId):string {
  const entry=FINANCE_MESSAGES[id];
  if(!entry)throw new Error('Unknown financial message');
  const offset=entry.record*256;
  if(bytes.length<offset+256)throw new Error('Truncated financial message');
  return new TextDecoder('ascii').decode(bytes.subarray(offset,offset+254)).split('\0')[0]
    .replace(/@/g,' ').replace(/\s+/g,' ').trim();
}
