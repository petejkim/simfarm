import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react';

/** Raised button: the black frame is the button background behind 1px padding (all sides, or top/left
 * for cells that share a neighbour's frame), around a 2px CSS bevel face holding a sprite or HTML caption.
 * Pressed (persistent) and :active (momentary) swap the bevel colours. */
export function BevelButton({ frame = 'all', pressed, shadow, className, faceClassName, faceStyle, children, ...button }: {
  frame?: 'all' | 'top-left'; pressed?: boolean; shadow?: boolean; className?: string; faceClassName?: string;
  faceStyle?: CSSProperties; children?: ReactNode; ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
  return <button type="button" {...button} data-frame={frame} data-shadow={shadow || undefined}
    aria-pressed={pressed === undefined ? button['aria-pressed'] : pressed}
    className={`bevel-button${pressed ? ' is-pressed' : ''}${className ? ` ${className}` : ''}`}>
    <span className={`bevel-button-face${faceClassName ? ` ${faceClassName}` : ''}`} style={faceStyle}>{children}</span>
  </button>;
}
