import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";

import { CrmAccessError } from "./crmGate";
import { extractFiAdminKeyFromRequestParts } from "./fiAdminKeyTransport";

export function extractAdminKeyFromRequest(req: Request, body?: unknown): string | undefined {
  const url = new URL(req.url);
  return extractFiAdminKeyFromRequestParts({
    urlSearchParams: url.searchParams,
    headers: req.headers,
    body,
    configuredApiKey: process.env.FI_ADMIN_API_KEY,
  });
}

export function crmJsonOk(payload: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...payload }, { status });
}

export function crmJsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function mapCrmRouteError(e: unknown): NextResponse {
  if (e instanceof StaffPinMutationBlockedError) {
    return crmJsonError(e.status, e.message);
  }
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
