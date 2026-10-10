import { Binary } from './binary';

export interface MenuRect { x: number; y: number; width: number; height: number }
export interface OriginalMenuItem {
  offset: number; labelOffset: number; label: string; next: number; previous: number; flags: number;
}
export interface OriginalMenu {
  offset: number; title: string; popup: MenuRect; header: MenuRect; next: number;
  callback: { offset: number; segment: number }; items: OriginalMenuItem[];
}
export interface MainMenus { background: number; foreground: number; menus: OriginalMenu[] }
const DS = 0x846f0;
const titles = [0x5acb, 0x5ad0, 0x5ad8, 0x5ade, 0x5ae6];

/** Initialized 6190 menu chain installed at EXE3f8da; not executable callbacks. */
export function readOriginalMainMenus(bytes: Uint8Array): MainMenus {
  const b = new Binary(bytes);
  const word = (offset: number) => b.u16(DS + offset);
  function pointer(offset: number): number {
    const address = word(offset), segment = word(offset + 2);
    if (address === 0 && segment === 0) return 0;
    if (segment !== 0x6190 || address === 0) throw new Error('Invalid main-menu data pointer');
    return address;
  }
  function label(offset: number): string {
    const result: number[] = [];
    for (let i = 0; i < 80 && offset + i < 0x10000; i++) {
      const value = b.slice(DS + offset + i, 1)[0];
      if (value === 0 && result.length) return String.fromCharCode(...result);
      if (value < 32 || value > 126) throw new Error('Invalid main-menu text');
      result.push(value);
    }
    throw new Error('Unterminated main-menu text');
  }
  function rect(offset: number): MenuRect {
    return { x: word(offset), y: word(offset + 2), width: word(offset + 4), height: word(offset + 6) };
  }
  const menus: OriginalMenu[] = [], seen = new Set<number>();
  let offset = 0xa874;
  while (offset) {
    if (seen.has(offset) || menus.length >= titles.length) throw new Error('Invalid main-menu chain');
    seen.add(offset); b.slice(DS + offset, 30);
    const count = word(offset + 16), items: OriginalMenuItem[] = [], itemSeen = new Set<number>();
    if (count < 1 || count > 32) throw new Error('Invalid main-menu item count');
    let itemOffset = pointer(offset + 18), previous = 0;
    while (itemOffset) {
      if (itemSeen.has(itemOffset) || items.length >= count) throw new Error('Invalid main-menu item chain');
      itemSeen.add(itemOffset); b.slice(DS + itemOffset, 14);
      const labelOffset = pointer(itemOffset), back = pointer(itemOffset + 8);
      if (!labelOffset || back !== previous) throw new Error('Invalid main-menu item backlink');
      const next = pointer(itemOffset + 4);
      items.push({ offset: itemOffset, labelOffset, label: label(labelOffset), next, previous: back, flags: word(itemOffset + 12) });
      previous = itemOffset; itemOffset = next;
    }
    if (items.length !== count) throw new Error('Main-menu item count mismatch');
    menus.push({ offset, title: label(titles[menus.length]), popup: rect(offset), header: rect(offset + 8),
      next: pointer(offset + 22), callback: { offset: word(offset + 26), segment: word(offset + 28) }, items });
    offset = pointer(offset + 22);
  }
  if (menus.length !== titles.length) throw new Error('Main-menu count mismatch');
  return readMainMenusData({ background: b.slice(DS + 0x5b01, 1)[0], foreground: b.slice(DS + 0x5b02, 1)[0], menus });
}

/** Validate the small imported JSON before using its geometry and text in React. */
export function readMainMenusData(value: unknown): MainMenus {
  const fail = (): never => { throw new Error('Invalid main-menu metadata'); };
  const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
  const integer = (v: unknown, max = 0xffff): number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : fail();
  const text = (v: unknown): string => typeof v === 'string' && /^[ -~]{1,79}$/.test(v) ? v : fail();
  const rect = (v: unknown): MenuRect => {
    const r = object(v), x = integer(r.x, 639), y = integer(r.y, 479), width = integer(r.width, 640), height = integer(r.height, 480);
    if (!width || !height || x + width > 640 || y + height > 480) fail();
    return { x, y, width, height };
  };
  const data = object(value);
  if (!Array.isArray(data.menus) || data.menus.length !== 5) return fail();
  const menus = data.menus.map((entry): OriginalMenu => {
    const m = object(entry), callback = object(m.callback);
    if (!Array.isArray(m.items) || !m.items.length || m.items.length > 32) return fail();
    const items = m.items.map((entry): OriginalMenuItem => {
      const i = object(entry);
      return { offset: integer(i.offset), labelOffset: integer(i.labelOffset), label: text(i.label), next: integer(i.next), previous: integer(i.previous), flags: integer(i.flags) };
    });
    if (new Set(items.map(i => i.offset)).size !== items.length || items.some((i, n) => !i.offset || !i.labelOffset || i.previous !== (items[n - 1]?.offset ?? 0) || i.next !== (items[n + 1]?.offset ?? 0))) fail();
    return { offset: integer(m.offset), title: text(m.title), popup: rect(m.popup), header: rect(m.header), next: integer(m.next),
      callback: { offset: integer(callback.offset), segment: integer(callback.segment) }, items };
  });
  if (new Set(menus.map(m => m.offset)).size !== menus.length || menus.some((m, n) => !m.offset || m.next !== (menus[n + 1]?.offset ?? 0))) fail();
  return { background: integer(data.background, 15), foreground: integer(data.foreground, 15), menus };
}
