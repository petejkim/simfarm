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
