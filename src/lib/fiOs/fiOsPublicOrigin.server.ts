import "server-only";

import { headers } from "next/headers";

function firstForwardedValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

/**
 * Public origin for FI OS (Zapier URLs, docs). Uses proxy headers when present, else
 * {@link process.env.NEXT_PUBLIC_SITE_URL}, else localhost.
 */
export async function resolveFiOsPublicOrigin(): Promise<string> {
  const h = await headers();
  const host = firstForwardedValue(h.get("x-forwarded-host")) ?? h.get("host")?.trim() ?? null;
  const protoRaw = firstForwardedValue(h.get("x-forwarded-proto")) ?? "http";
  const proto = protoRaw.split("/")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fallback && fallback.length > 0) return fallback.replace(/\/+$/, "");
  return "http://localhost:3000";
}
