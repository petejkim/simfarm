import {readFileSync,type PathOrFileDescriptor} from 'node:fs';
import {gunzipSync} from 'node:zlib';

/** Independently decode downloaded checkpoints, including old JSON fixtures. */
export function readSaveText(path:PathOrFileDescriptor):string{
  const bytes=readFileSync(path);
  return (bytes[0]===0x1f&&bytes[1]===0x8b?gunzipSync(bytes):bytes).toString('utf8');
}
