import type { HTMLAttributes } from 'react';

/** Sunken 2px bevel box (shadow top/left, light bottom/right); size comes from the caller's class or style. */
export function SunkenInset({ className, as: Tag = 'span', ...rest }: HTMLAttributes<HTMLElement> & { as?: 'span' | 'div' }) {
  return <Tag {...rest} className={`sunken-inset${className ? ` ${className}` : ''}`} />;
}
