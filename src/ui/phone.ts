import { useSyncExternalStore } from 'react';

/** Phone layouts (native, user request): a touch screen whose short side is at most 500 CSS px. Matches the
 * style.css phone queries (portrait max-width, landscape max-height); tablets keep the desktop layout. */
export const PHONE_QUERY = '(pointer: coarse) and (max-width: 500px), (pointer: coarse) and (max-height: 500px)';

export function usePhone(): boolean {
  return useSyncExternalStore(change => {
    const query = matchMedia(PHONE_QUERY); query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, () => matchMedia(PHONE_QUERY).matches);
}

/** Touch-first devices (primary pointer is coarse), as used by TouchNotice and the #app zoom in style.css. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(change => {
    const query = matchMedia(COARSE_POINTER_QUERY); query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, () => matchMedia(COARSE_POINTER_QUERY).matches);
}
