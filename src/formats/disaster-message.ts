import {parseEventText,type EventTextLine} from './event-text';
import type {DisasterNoticeId} from '../simulation/events';

/** Overlay10 start36574/stop36d16; rows in events.dat, portraits in alltiles.btl. */
export const DISASTER_MESSAGES:Record<DisasterNoticeId,{record:number;portrait:number;mandatory:boolean}>={
  frost:{record:49,portrait:56,mandatory:false},wind:{record:48,portrait:57,mandatory:false},
  'crop-circles':{record:50,portrait:65,mandatory:true},'toxic-land':{record:51,portrait:59,mandatory:true},
  tornado:{record:52,portrait:63,mandatory:true},drought:{record:53,portrait:58,mandatory:false},
  flood:{record:54,portrait:62,mandatory:false},swarm:{record:55,portrait:47,mandatory:false},
  'wind-ended':{record:57,portrait:57,mandatory:false},'tornado-ended':{record:20,portrait:63,mandatory:false},
  'drought-ended':{record:58,portrait:58,mandatory:false},'flood-ended':{record:56,portrait:62,mandatory:false},
};
/** Same bounded256-byte loader4a2ee and word renderer882e as financial messages; titles use its `~`/backtick markup. */
export function readDisasterMessage(bytes:Uint8Array,id:DisasterNoticeId):EventTextLine[] {
  const entry=DISASTER_MESSAGES[id];
  if(!entry)throw new Error('Unknown disaster message');
  const offset=entry.record*256;
  if(bytes.length<offset+256)throw new Error('Truncated disaster message');
  return parseEventText(new TextDecoder('ascii').decode(bytes.subarray(offset,offset+254)).split('\0')[0]);
}
