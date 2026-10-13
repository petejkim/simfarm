import { Binary } from './binary';
import { decodePlanar,type Palette,type Raster } from './graphics';

/** Original illustration66, including its FARM BUREAU cap logo. */
export function readExpertPortrait(bytes:Uint8Array,palette:Palette):Raster {
  const b=new Binary(bytes);
  if(b.u16(18)!==80||bytes.length!==20+80*3586)throw new Error('Invalid Expert portrait library');
  return decodePlanar(b.slice(22+66*3586,3584),112,64,palette);
}

/** Native toolbar launcher face for the Farm Expert (user-chosen design, no source equivalent): the 52×52
 * square around the expert's head in portrait 66 (x33,y1), halved by keeping every other pixel from the
 * first column and row. The result is 26×26, the launcher face size, in original palette colours only. */
export const EXPERT_LAUNCHER_CROP={x:33,y:1,size:52} as const;
export function expertLauncherFace(portrait:Raster):Raster {
  if(portrait.width!==112||portrait.height!==64)throw new Error('Invalid Expert portrait');
  const {x,y}=EXPERT_LAUNCHER_CROP,rgba=new Uint8Array(26*26*4);
  for(let row=0;row<26;row++)for(let col=0;col<26;col++){
    const from=((y+row*2)*112+x+col*2)*4;rgba.set(portrait.rgba.subarray(from,from+4),(row*26+col)*4);
  }
  return {width:26,height:26,rgba};
}

/** Supplied CARD*.HC resources; overlay28 at4c820 interprets this data. */
export const EXPERT_CARD_IDS = [1,2,5,6,7,8,...Array.from({length:28},(_,i)=>10+i),...Array.from({length:9},(_,i)=>40+i)];
interface Point { x:number; y:number }
interface Rectangle extends Point { width:number; height:number }
export type ExpertCommand =
  | ({kind:'picture';card:number;cropSlot?:number}&Point)
  | ({kind:'text';width:number;text:string}&Point)
  | ({kind:'crop';slot:number}&Point)
  | ({kind:'tiles';columns:number;rows:number;first:number}&Point)
  | ({kind:'link';target:number}&Rectangle)
  | ({kind:'button';target:number;caption:'CANCEL'|'NEXT'|'PREV'|'CLOSE'}&Point)
  | ({kind:'sound';sound:'rooster'}&Rectangle);
export type ExpertDeck = ReadonlyMap<number, readonly ExpertCommand[]>;

/** Source8932 skips @/physical padding, treats ~ as a line break. */
export function expertText(text:string):string {
  return text.split('\0')[0].replace(/[@\r\n\t ]+/g,' ').replace(/`/g,' ').replace(/ *~ */g,'\n').trim();
}

/** Deliberately bounded native reader, not an executable interpreter. Only the
 * eight operations present in the supplied deck are enabled. Coordinates stay
 * relative to the full original window, including its16px title. */
export function readExpertCard(bytes:Uint8Array):ExpertCommand[] {
  if(bytes.length<1||bytes.length>513)throw new Error('Invalid Expert card size');
  const b=new Binary(bytes),commands:ExpertCommand[]=[];
  let cursor=0,links=0,sounds=0;
  const word=()=>{const n=b.u16(cursor);cursor+=2;return n;};
  const string=()=>{
    const start=cursor;while(cursor<bytes.length&&bytes[cursor]!==0)cursor++;
    if(cursor===bytes.length)throw new Error('Unterminated Expert text');
    const value=b.text(start,cursor-start);cursor++;return value;
  };
  const point=()=>({x:word(),y:word()});
  const rectangle=()=>{const p=point(),x2=word(),y2=word();return {...p,width:x2-p.x,height:y2-p.y};};
  const bounds=(r:Rectangle)=>{
    if(r.x<0||r.y<16||r.width<=0||r.height<=0||r.x+r.width>400||r.y+r.height>240)throw new Error('Invalid Expert coordinates');
  };
  while(cursor<bytes.length){
    const opcode=bytes[cursor++];let command:ExpertCommand;
    switch(opcode){
      case 0x83:command={kind:'link',...rectangle(),target:word()};links++;break;
      case 0x84:{
        const p=point(),frame=word(),target=word();
        const caption=({3:'CANCEL',13:'NEXT',14:'PREV'} as const)[frame as 3|13|14];
        if(!caption)throw new Error('Invalid Expert button');
        command={kind:'button',...p,target,caption};links++;break;
      }
      case 0x86:{const card=word();if(card>=80)throw new Error('Invalid Expert picture');command={kind:'picture',card,...point()};break;}
      case 0x87:{const p=point(),width=word(),text=expertText(string());command={kind:'text',...p,width,text};break;}
      case 0x89:{const slot=word();if(slot>=16)throw new Error('Invalid Expert crop');command={kind:'crop',slot,...point()};break;}
      case 0x8a:{
        const r=rectangle(),file=string();if(file!=='rooster.voc')throw new Error('Invalid Expert sound');
        command={kind:'sound',...r,sound:'rooster'};sounds++;break;
      }
      case 0x8b:command={kind:'button',...point(),target:255,caption:'CLOSE'};links++;break;
      case 0x8c:{
        const p=point(),columns=word(),rows=word(),first=word();
        if(!columns||!rows||first+columns*rows>848)throw new Error('Invalid Expert tiles');
        command={kind:'tiles',...p,columns,rows,first};break;
      }
      case 0xff:if(cursor!==bytes.length)throw new Error('Trailing Expert bytes');return commands;
      default:throw new Error(`Unsupported Expert opcode ${opcode.toString(16)}`);
    }
    if(links>16||sounds>4)throw new Error('Too many Expert controls');
    if('target' in command&&command.target!==255&&!EXPERT_CARD_IDS.includes(command.target))throw new Error('Invalid Expert target');
    switch(command.kind){
      case 'picture':bounds({...command,width:112,height:64});break;
      case 'button':bounds({...command,width:48,height:24});break;
      case 'crop':bounds({...command,width:256,height:8});break;
      case 'text':bounds({...command,height:8});break;
      case 'tiles':bounds({...command,width:command.columns*16,height:command.rows*16});break;
      default:bounds(command);
    }
    commands.push(command);
  }
  throw new Error('Missing Expert terminator');
}

export function readExpertDeck(read:(id:number)=>Uint8Array):ExpertDeck {
  return new Map(EXPERT_CARD_IDS.map(id=>[id,readExpertCard(read(id))]));
}

/** Extend the original16-slot linked crop chapter to all24 supplied crops.
 * Extra pages64..71 use card11's layout; source buffers/deck remain untouched. */
export function expertPage(deck:ExpertDeck,id:number,cropCount:number):readonly ExpertCommand[] {
  if(!Number.isInteger(cropCount)||cropCount<16||cropCount>24)throw new Error('Invalid Expert crop count');
  const slot=id>=10&&id<=25?id-10:id>=64&&id<64+cropCount-16?id-48:null;
  if(slot===null){const page=deck.get(id);if(!page)throw new Error('Missing Expert page');return page;}
  if(slot<15||cropCount===16)return deck.get(id)!;
  const pageId=(n:number)=>n<16?n+10:n+48;
  const page=deck.get(11)!;
  return page.flatMap((command):ExpertCommand[]=>{
    if(command.kind==='crop')return [{...command,slot}];
    if(command.kind==='picture'&&command.card<16)return [{...command,cropSlot:slot}];
    if(command.kind==='button'&&command.caption==='NEXT')return slot===cropCount-1?[]:[{...command,target:pageId(slot+1)}];
    if(command.kind==='button'&&command.caption==='PREV')return [{...command,x:slot===cropCount-1?288:240,target:pageId(slot-1)}];
    return [command];
  });
}

/** Right edges of a page's 112px pictures and 16px-tile strips. */
function artEdges(page:readonly ExpertCommand[]):number[]{
  return page.flatMap(c=>c.kind==='picture'?[c.x+112]:c.kind==='tiles'?[c.x+c.columns*16]:[]);
}
/** Text or crop description that starts at a picture's or tile strip's right edge (source x136/x96/x232 layouts). */
export function expertTextBesideArt(page:readonly ExpertCommand[],command:ExpertCommand):boolean{
  return (command.kind==='text'||command.kind==='crop')&&artEdges(page).includes(command.x);
}
/** Presentation inference, not a source flag: every page title ("Field Icon Index", "Crop Information", …) is
 * free-standing text with page artwork below it. The welcome paragraph sits below its pictures and is not a title. */
export function expertHeading(page:readonly ExpertCommand[],command:ExpertCommand):boolean{
  return command.kind==='text'&&!expertTextBesideArt(page,command)
    &&page.some(c=>(c.kind==='picture'||c.kind==='tiles')&&c.y>command.y);
}
