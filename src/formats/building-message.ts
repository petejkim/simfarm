import {readEventMessage,type EventMessages} from './event-messages';
/** Message44 dispatcher3035c[44] selects portrait74; common loader reads record44. */
export const WATER_STORAGE_MESSAGE={record:44,portrait:74} as const;
export function readWaterStorageMessage(bytes:EventMessages):string {
  return readEventMessage(bytes,WATER_STORAGE_MESSAGE.record,'Truncated water storage message').paragraph;
}
