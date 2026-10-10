import { Binary } from './binary';
import { decodePlanar, readBitmap, type Palette, type Raster } from './graphics';

export const BUY_CATEGORIES = ['machinery', 'seeds', 'livestock', 'buildings', 'chemicals'] as const;
export type BuyCategory = typeof BUY_CATEGORIES[number];
export interface BuyCatalog { groups: Record<BuyCategory, number[]>; tileBases: number[] }
/** Source DSb516 boundaries and b51e types; category callbacks47f16..47f59. */
export function readBuyCatalog(exe: Uint8Array): BuyCatalog {
  const b = new Binary(exe), ds = 0x846f0, starts = [...b.slice(ds + 0xb516, 6)];
  if (starts.join() !== '0,4,20,28,37,41') throw new Error('Unsupported Buy catalog boundaries');
  const order = Array.from({ length: 41 }, (_, i) => b.u16(ds + 0xb51e + i * 2));
  return { groups: { machinery: order.slice(20,28), seeds: order.slice(4,20), livestock: order.slice(0,4), buildings: order.slice(28,37), chemicals: order.slice(37,41) },
    tileBases: Array.from({ length: 160 }, (_, i) => b.u16(0x4f4be + i * 2)) };
}
export function readBuyCatalogData(value: unknown): BuyCatalog {
  const v = value as BuyCatalog;
  const expected = { machinery: [0,1,2,3,4,5,7,8], seeds: Array.from({length:16},(_,i)=>192+i), livestock:[161,162,163,160], buildings:Array.from({length:9},(_,i)=>64+i), chemicals:[220,221,222,223] };
  if (!v || BUY_CATEGORIES.some(c => !Array.isArray(v.groups?.[c]) || v.groups[c].join() !== expected[c].join()) ||
    !Array.isArray(v.tileBases) || v.tileBases.length !== 160 || v.tileBases.some(n => !Number.isInteger(n) || n < 0 || n > 1047)) throw new Error('Invalid Buy catalog');
  return { groups: structuredClone(v.groups), tileBases: [...v.tileBases] };
}
/** The original reader480ae seeks graphic*128; keep physical offsets, including
 * irregular CRLF boundaries in the supplied file. Raw bytes stay imported. */
export function readItemText(bytes: Uint8Array, graphic: number): string {
  if (!Number.isInteger(graphic) || graphic < 0) throw new Error('Invalid item text index');
  return new Binary(bytes).text(graphic * 128, 128).replace(/\r?\n/g, ' ').replace(/@/g, '').replace(/~/g, '\n').replace(/ +/g, ' ').trim();
}
/** Loader4a202: header20, record stride0xe02, unknown word then112×64 planes. */
export function readBuyCards(bytes: Uint8Array, palette: Palette): Raster {
  const b = new Binary(bytes), count = b.u16(18);
  if (count !== 80 || bytes.length !== 20 + count * 3586) throw new Error('Invalid original item card library');
  const width = 112 * 8, height = 64 * 10, rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < count; i++) {
    const card = decodePlanar(b.slice(22 + i * 3586, 3584),112,64,palette);
    for (let y = 0; y < 64; y++) rgba.set(card.rgba.subarray(y * 448,(y+1)*448), (((i >> 3)*64+y)*width+(i%8)*112)*4);
  }
  return { width, height, rgba };
}
export const BUY_TEXT_MASKS = [
  { x:168,y:110,width:44,height:12 }, { x:168,y:142,width:28,height:12 },
  { x:170,y:190,width:28,height:12 }, { x:202,y:190,width:44,height:12 },
] as const;
export function readBuyArtwork(bytes: Uint8Array, palette: Palette): Raster {
  const raster = readBitmap(bytes,palette);
  if (raster.width !== 256 || raster.height !== 224) throw new Error('Invalid Buy artwork dimensions');
  for (const r of BUY_TEXT_MASKS) for (let y=r.y;y<r.y+r.height;y++) for(let x=r.x;x<r.x+r.width;x++)
    raster.rgba.set([...palette[12],255],(y*256+x)*4);
  return raster;
}
