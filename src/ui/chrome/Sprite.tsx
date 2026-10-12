import type { CSSProperties } from 'react';

/** One frame of an image atlas, shown at 1× with pixelated scaling. */
export function Sprite({ image, x, y, width, height, className, style, label }: {
  image: string; x: number; y: number; width: number; height: number; className?: string; style?: CSSProperties; label?: string;
}) {
  return <span className={`sprite${className ? ` ${className}` : ''}`} role={label ? 'img' : undefined} aria-label={label}
    style={{ backgroundImage: `url("${image}")`, backgroundPosition: `${-x}px ${-y}px`, width, height, ...style }} />;
}
/** Background-position style for a sprite face inside another element (e.g. a BevelButton face). */
export const spriteFace = (image: string, x: number, y: number): CSSProperties =>
  ({ backgroundImage: `url("${image}")`, backgroundPosition: `${-x}px ${-y}px` });
