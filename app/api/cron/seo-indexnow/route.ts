/**
 * POST or GET /api/cron/seo-indexnow
 * Pings IndexNow (Bing + api.indexnow.org) with public sitemap URLs.
 * Auth: Bearer CRON_SECRET (Vercel Cron) or x-fi-cron-secret header.
 */
import { NextRequest, NextResponse } from "next/server";

import { pingIndexNow } from "@/lib/seo/indexnow";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const auth = assertCronAuthorized(req, [process.env.CRON_SECRET ?? ""], {
    alternateTimingSafeHeaderName: "x-fi-cron-secret",
  });
  if (auth) return auth;

  try {
    const result = await pingIndexNow();
    if (result.submitted === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "INDEXNOW_KEY not configured",
      });
    }

    logStructured("info", "seo_indexnow_ping", {
      submitted: result.submitted,
      endpoint_count: result.results.length,
      all_ok: result.results.every((r) => r.ok),
    });

    const allOk = result.results.every((r) => r.ok);
    return NextResponse.json({
      ok: allOk,
      submitted: result.submitted,
      results: result.results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "seo_indexnow_ping_failed", { message });
    return NextResponse.json({ ok: false, error: "IndexNow ping failed." }, { status: 500 });
  }
}
