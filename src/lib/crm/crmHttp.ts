import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CrmAccessError, parseAdminKeyFromUnknown } from "./crmGate";

export function extractAdminKeyFromRequest(req: Request, body?: unknown): string | undefined {
  const headerVal = req.headers.get("x-fi-admin-key")?.trim();
  if (headerVal) return headerVal;
  const url = new URL(req.url);
  const q = url.searchParams.get("adminKey")?.trim();
  if (q) return q;
  return parseAdminKeyFromUnknown(body);
}

export function crmJsonOk(payload: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...payload }, { status });
}

export function crmJsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function mapCrmRouteError(e: unknown): NextResponse {
  if (e instanceof CrmAccessError) {
    return crmJsonError(e.status, e.message);
  }
  if (e instanceof ZodError) {
    const first = e.errors[0]?.message ?? "Invalid request.";
    return crmJsonError(400, first);
  }
  if (e instanceof Error) {
    return crmJsonError(500, e.message);
  }
  return crmJsonError(500, "Unexpected error.");
}
