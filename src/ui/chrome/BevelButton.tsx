import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from 'react';

/** Raised button: the black frame is the button background behind 1px padding (all sides, or top/left
 * for cells that share a neighbour's frame), around a 2px CSS bevel face holding a sprite or HTML caption.
 * Pressed (persistent) and :active (momentary) swap the bevel colours.
 *
 * Touch (native, user report): iOS drops :active when the finger lifts, before the tap's click arrives, so a launcher
 * whose click presses it showed down → up → down. A touch therefore holds the button down (is-held) from pointerdown
 * until its click has run, so the release renders together with the click's own state change. A finger lifted off
 * the button, a cancelled touch, or a click that never arrives releases it. */
export function BevelButton({ frame = 'all', pressed, shadow, className, faceClassName, faceStyle, children, ...button }: {
  frame?: 'all' | 'top-left'; pressed?: boolean; shadow?: boolean; className?: string; faceClassName?: string;
  faceStyle?: CSSProperties; children?: ReactNode; ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'type'>) {
  const [held, setHeld] = useState(false), timer = useRef(0);
  const release = () => { clearTimeout(timer.current); setHeld(false); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const touch = (event: PointerEvent<HTMLButtonElement>) => event.pointerType !== 'mouse';
  return <button {...button} type="button" data-frame={frame} data-shadow={shadow || undefined}
    aria-pressed={pressed === undefined ? button['aria-pressed'] : pressed}
    className={`bevel-button${pressed ? ' is-pressed' : ''}${held ? ' is-held' : ''}${className ? ` ${className}` : ''}`}
    onPointerDown={event => { if (touch(event) && event.isPrimary && !button.disabled) { clearTimeout(timer.current); setHeld(true); } button.onPointerDown?.(event); }}
    onPointerUp={event => {
      if (touch(event)) {
        // Touch pointers are captured by the button, so check where the finger actually lifted.
        if (!event.currentTarget.contains(document.elementFromPoint(event.clientX, event.clientY))) release();
        else { clearTimeout(timer.current); timer.current = window.setTimeout(release, 500); }
      }
      button.onPointerUp?.(event);
    }}
    onPointerCancel={event => { release(); button.onPointerCancel?.(event); }}
    onClick={event => { button.onClick?.(event); release(); }}>
    <span className={`bevel-button-face${faceClassName ? ` ${faceClassName}` : ''}`} style={faceStyle}>{children}</span>
  </button>;
}
