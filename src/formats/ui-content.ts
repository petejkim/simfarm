import { EXPERT_CARD_IDS, readExpertDeck, type ExpertCommand, type ExpertDeck } from './expert-cards';
import { readEventMessage, type EventMessageText } from './event-messages';
import { readEditStatus } from './edit-status';

export interface UiContentData {
  version: 1;
  expertCards: { id: number; commands: readonly ExpertCommand[] }[];
  eventMessages: EventMessageText[];
  editStatuses: string[];
}
export interface UiContent {
  expertDeck: ExpertDeck;
  eventMessages: readonly EventMessageText[];
  editStatuses: readonly string[];
}

/** Import-time decoding of all supplied cards and complete message records.
 * Raw imports retain unread bytes/padding and the partial final events.dat record. */
export function decodeUiContent(read: (name: string) => Uint8Array): UiContentData {
  const events = read('events.dat'), quick = read('qmessage.dat');
  if (events.length !== 16282 || quick.length !== 4866) throw new Error('Invalid UI message resource sizes');
  return {
    version: 1,
    expertCards: [...readExpertDeck(id => read(`card${id}.hc`))].map(([id, commands]) => ({ id, commands })),
    eventMessages: Array.from({ length: 63 }, (_, id) => readEventMessage(events, id)),
    editStatuses: Array.from({ length: 76 }, (_, id) => readEditStatus(quick, id)),
  };
}

/** Validate predecoded display data without interpreting binary records in the browser. */
export function readUiContentJson(value: unknown): UiContent {
  const fail = (): never => { throw new Error('Invalid UI content bundle'); };
  const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
  const integer = (v: unknown, max = 65535): number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : fail();
  const text = (v: unknown, max: number): string => typeof v === 'string' && v.length <= max && !v.includes('\0') ? v : fail();
  const array = (v: unknown, count: number): unknown[] => Array.isArray(v) && v.length === count ? v : fail();
  const data = object(value);
  if (data.version !== 1) fail();
  const expertDeck = new Map<number, readonly ExpertCommand[]>();
  array(data.expertCards, 43).forEach((entry, index) => {
    const card = object(entry);
    if (card.id !== EXPERT_CARD_IDS[index] || !Array.isArray(card.commands) || card.commands.length > 128) fail();
    let links = 0, sounds = 0;
    const commands = (card.commands as unknown[]).map((entry): ExpertCommand => {
      const c = object(entry), x = integer(c.x, 400), y = integer(c.y, 240), point = { x, y };
      const target = () => { const id = integer(c.target, 255); if (id !== 255 && !EXPERT_CARD_IDS.includes(id)) fail(); links++; return id; };
      let command: ExpertCommand, width: number, height: number;
      switch (c.kind) {
        case 'picture': width = 112; height = 64; command = { kind: c.kind, ...point, card: integer(c.card, 79) }; break;
        case 'text': width = integer(c.width, 400); height = 8; command = { kind: c.kind, ...point, width, text: text(c.text, 513) }; break;
        case 'crop': width = 256; height = 8; command = { kind: c.kind, ...point, slot: integer(c.slot, 15) }; break;
        case 'tiles': {
          const columns = integer(c.columns, 25), rows = integer(c.rows, 15), first = integer(c.first, 847);
          if (!columns || !rows || first + columns * rows > 848) fail();
          width = columns * 16; height = rows * 16; command = { kind: c.kind, ...point, columns, rows, first }; break;
        }
        case 'link': width = integer(c.width, 400); height = integer(c.height, 240); command = { kind: c.kind, ...point, width, height, target: target() }; break;
        case 'button':
          if (!['CANCEL', 'NEXT', 'PREV', 'CLOSE'].includes(c.caption as string)) fail();
          width = 48; height = 24; command = { kind: c.kind, ...point, target: target(), caption: c.caption as 'CANCEL' | 'NEXT' | 'PREV' | 'CLOSE' }; break;
        case 'sound':
          if (c.sound !== 'rooster') fail(); sounds++;
          width = integer(c.width, 400); height = integer(c.height, 240); command = { kind: c.kind, ...point, width, height, sound: 'rooster' }; break;
        default: return fail();
      }
      if (y < 16 || !width || !height || x + width > 400 || y + height > 240 || links > 16 || sounds > 4) fail();
      return command;
    });
    expertDeck.set(card.id as number, commands);
  });
  const eventMessages = array(data.eventMessages, 63).map((entry): EventMessageText => {
    const m = object(entry);
    if (!Array.isArray(m.lines) || m.lines.length > 254) fail();
    return { paragraph: text(m.paragraph, 254), physicalText: text(m.physicalText, 256), lines: (m.lines as unknown[]).map(entry => {
      const line = object(entry); if (typeof line.centered !== 'boolean') fail();
      return { text: text(line.text, 254), centered: line.centered as boolean };
    }) };
  });
  const editStatuses = array(data.editStatuses, 76).map(entry => text(entry, 62));
  return { expertDeck, eventMessages, editStatuses };
}
