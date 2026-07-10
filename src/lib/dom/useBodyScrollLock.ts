"use client";

import { useEffect } from "react";

import { lockBodyScroll } from "./bodyScrollLock";

/**
 * Locks document body scroll while `locked` is true.
 * Safe when multiple components lock concurrently (reference-counted).
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    return lockBodyScroll();
  }, [locked]);
}
