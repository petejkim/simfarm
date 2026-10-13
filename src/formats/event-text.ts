/** One displayed line of an events.dat message. */
export interface EventTextLine { text: string; centered: boolean }

/** Layout markup of word renderer882e..8931 (shared by events.dat messages). Loader4a2ee has already turned `@`
 * padding into spaces. `~` (0x7e) is a forced line break: 8912..891c advance y by 8 and reset x. A backtick (0x60) is
 * drawn as a blank 8-pixel cell (88d0..88d6 rewrite it to a space before drawing), which the source uses to indent
 * titles to the centre of the 224-pixel text area; natively such a segment is centred with CSS instead. CR/LF and
 * runs of spaces remain word separators. */
export function parseEventText(text: string): EventTextLine[] {
  return text.replace(/@/g, ' ').split('~').map(segment => ({
    centered: /^\s*`/.test(segment),
    text: segment.replace(/`/g, ' ').replace(/\s+/g, ' ').trim(),
  })).filter(line => line.text);
}
