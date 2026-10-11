/** Original22504: ten signed-byte slots initialized-1, cursor0; adjacent duplicates suppressed. */
export interface EditStatusHistory {codes:number[];cursor:number}
export function createEditStatus():EditStatusHistory{return {codes:Array(10).fill(-1),cursor:0};}
export function appendEditStatus(history:EditStatusHistory,code:number):void {
  if(!Number.isInteger(code)||code<0||code>=76)throw new Error('Invalid Edit status code');
  if(history.codes[history.cursor]===code)return;
  history.cursor=(history.cursor+1)%10;history.codes[history.cursor]=code;
}
/** SF-172: source computes this index, then accidentally reads the physical slot. */
export function recentEditStatuses(history:EditStatusHistory):number[]{
  return Array.from({length:10},(_,i)=>history.codes[(history.cursor-i+10)%10]).filter(code=>code>=0);
}

/** Palette214f0 branches and Spray383e8/38436/3847c/384c4. */
export const EDIT_TOOL_STATUSES={
  'Move object':6,'View object':64,'Paved road':35,'Dirt road':36,'Fence':32,'Gate':33,
  'Ditch':40,'Valve':25,'Hay':41,'Trough':34,'Trees':37,'Bulldoze':63,
} as const;
export const SPRAY_STATUSES={fertilizer:14,pesticide:15,herbicide:31,fungicide:16} as const;
/** Includes Move pickup7, Bulldoze cash42 and SF-173 corrected busy feedback61. */
export type EditToolStatusCode=7|42|61|17|typeof EDIT_TOOL_STATUSES[keyof typeof EDIT_TOOL_STATUSES]|typeof SPRAY_STATUSES[keyof typeof SPRAY_STATUSES];
export function isEditToolStatus(code:number):code is EditToolStatusCode {
  return code===42||code===7||code===61||code===17||Object.values(EDIT_TOOL_STATUSES).some(n=>n===code)||Object.values(SPRAY_STATUSES).some(n=>n===code);
}
