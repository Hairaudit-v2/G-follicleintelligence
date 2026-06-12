/**
 * Constant-time UTF-8 string comparison for cron/webhook shared secrets (fixed-length buffers).
 */
import { timingSafeEqual } from "node:crypto";

export const CRON_OR_WEBHOOK_SECRET_MIN_LENGTH = 16;

export function timingSafeUtf8Equal(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
