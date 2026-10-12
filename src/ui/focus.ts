/** Move focus to a panel that just appeared, unless the user is working in an open menu.
 * Panels load asynchronously; taking focus from an expanded menu would close it under the user. */
export function focusUnlessClaimed(element: HTMLElement | null) {
  if (!element) return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest('[role="menu"],[aria-expanded="true"]')) return;
  element.focus();
}
