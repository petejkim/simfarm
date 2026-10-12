import type { CSSProperties } from 'react';

export const CONDITION_WORDS = ['BAD', 'POOR', 'FAIR', 'HIGH'] as const;
export const CONDITION_LETTERS = ['X', 'C', 'B', 'A'] as const;

/** Source condition badge (sell-condition.png, one shared ring) with the grade letter centred in the
 * ring's interior and the word centred below it, both as HTML text. Used by Sell, Examine and Schedule;
 * the caller's class only positions the 32×32 badge. */
export function ConditionBadge({ quality, artwork, className, label, style }: {
  quality: number; artwork: HTMLImageElement; className: string; label?: string; style?: CSSProperties;
}) {
  return <span className={`condition-badge ${className}`} aria-label={label}
    style={{ ...style, '--condition-badge': `url("${artwork.src}")` } as CSSProperties}>
    <span className="condition-letter">{CONDITION_LETTERS[quality]}</span>
    <span className="condition-word">{CONDITION_WORDS[quality]}</span>
  </span>;
}
