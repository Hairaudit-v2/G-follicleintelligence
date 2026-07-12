/**
 * Reference-counted document body scroll lock.
 *
 * Multiple overlays (mobile nav, search, quick-create, drawers, workspace panels)
 * must not each save/restore `body.style.overflow` independently — that races and
 * can leave `overflow: hidden` stuck after the last overlay closes.
 *
 * Usage:
 *   const unlock = lockBodyScroll();
 *   // … later
 *   unlock();
 */

let lockCount = 0;
let savedOverflow: string | null = null;
let savedPaddingRight: string | null = null;

function isBrowser(): boolean {
  return typeof document !== "undefined" && typeof document.body !== "undefined";
}

/** Active lock holders (for diagnostics / tests). */
export function getBodyScrollLockCount(): number {
  return lockCount;
}

/**
 * Acquire a body scroll lock. Returns a release function (safe to call once;
 * subsequent calls are no-ops).
 */
export function lockBodyScroll(): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    // Compensate for scrollbar disappearance to reduce layout shift (desktop).
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (scrollbarGap > 0) {
      savedPaddingRight = document.body.style.paddingRight;
      const computed = window.getComputedStyle(document.body).paddingRight;
      const currentPad = Number.parseFloat(computed || "0") || 0;
      document.body.style.paddingRight = `${currentPad + scrollbarGap}px`;
    } else {
      savedPaddingRight = null;
    }
    document.body.style.overflow = "hidden";
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    if (!isBrowser()) {
      lockCount = Math.max(0, lockCount - 1);
      return;
    }

    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow ?? "";
      if (savedPaddingRight !== null) {
        document.body.style.paddingRight = savedPaddingRight;
      } else {
        document.body.style.paddingRight = "";
      }
      savedOverflow = null;
      savedPaddingRight = null;
    }
  };
}

/**
 * Force-clear all locks (e.g. after a hard navigation edge case).
 * Prefer normal unlock callbacks; this is a safety valve.
 */
export function forceUnlockBodyScroll(): void {
  if (!isBrowser()) {
    lockCount = 0;
    savedOverflow = null;
    savedPaddingRight = null;
    return;
  }
  lockCount = 0;
  document.body.style.overflow = savedOverflow ?? "";
  if (savedPaddingRight !== null) {
    document.body.style.paddingRight = savedPaddingRight;
  } else {
    document.body.style.paddingRight = "";
  }
  // Radix RemoveScroll / modal menus may also pin html overflow or body pointer-events.
  document.documentElement.style.overflow = "";
  document.body.style.pointerEvents = "";
  savedOverflow = null;
  savedPaddingRight = null;
}

/** Test helper — reset module state without touching the DOM. */
export function __resetBodyScrollLockForTests(): void {
  lockCount = 0;
  savedOverflow = null;
  savedPaddingRight = null;
}
