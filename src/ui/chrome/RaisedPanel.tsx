import type { HTMLAttributes } from 'react';

/** Non-interactive raised panel with the BevelButton structure: a 1px ink frame (the panel's own background
 * behind padding), a 2px raised bevel around a face, and an optional 1px drop shadow. */
export function RaisedPanel({ shadow, className, faceClassName, children, ...rest }: HTMLAttributes<HTMLDivElement> & { shadow?: boolean; faceClassName?: string }) {
  return <div {...rest} data-shadow={shadow || undefined} className={`raised-panel${className ? ` ${className}` : ''}`}>
    <div className={`raised-panel-face${faceClassName ? ` ${faceClassName}` : ''}`}>{children}</div>
  </div>;
}
