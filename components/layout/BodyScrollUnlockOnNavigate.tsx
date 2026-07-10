"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  forceUnlockBodyScroll,
  getBodyScrollLockCount,
} from "@/src/lib/dom/bodyScrollLock";

/**
 * Safety valve for the marketing site and shared portal chrome.
 *
 * If body scroll was left locked (orphan overflow:hidden from a race or third-party
 * remove-scroll) after a soft navigation and no app locks are held, clear it.
 */
export function BodyScrollUnlockOnNavigate() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    // Defer one frame so in-page lock effects can re-acquire if still open.
    const id = window.requestAnimationFrame(() => {
      if (getBodyScrollLockCount() > 0) return;
      const overflow = document.body.style.overflow;
      if (overflow === "hidden") {
        forceUnlockBodyScroll();
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      }
      // react-remove-scroll leftover attribute (Radix menus/dialogs)
      if (document.body.hasAttribute("data-scroll-locked")) {
        document.body.removeAttribute("data-scroll-locked");
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
        document.body.style.marginRight = "";
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
