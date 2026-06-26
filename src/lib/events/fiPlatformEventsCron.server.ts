/**
 * GET handler for `/api/cron/platform-events/process`.
 * GC-10B: drains pending FI Platform Event Bus deliveries on a schedule.
 */
import { NextRequest, NextResponse } from "next/server";

import { processFiEventDeliveries } from "@/src/lib/events/fiEventProcessor.server";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";

export const FI_PLATFORM_EVENTS_CRON_MAX_BATCH = 100;

export type PlatformEventsProcessCronResponse = {
  success: boolean;
  processed: number;
  failed: number;
  durationMs: number;
  source: "vercel_cron";
};

export type PlatformEventsProcessCronOptions = {
  getEnv?: (key: string) => string | undefined;
  processDeliveries?: typeof processFiEventDeliveries;
};

function resolveGetEnv(opts?: PlatformEventsProcessCronOptions): (key: string) => string | undefined {
  return opts?.getEnv ?? ((key) => process.env[key]);
}

function parseCronQueryParams(
  req: NextRequest
): { limit?: number } | NextResponse<{ success: false; error: string }> {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  if (limitRaw == null || limitRaw.trim() === "") {
    return {};
  }

  const parsed = Number(limitRaw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return NextResponse.json({ success: false, error: "Invalid limit." }, { status: 400 });
  }

  return { limit: Math.min(parsed, FI_PLATFORM_EVENTS_CRON_MAX_BATCH) };
}

export async function handlePlatformEventsProcessCronGet(
  req: NextRequest,
  opts?: PlatformEventsProcessCronOptions
): Promise<Response> {
  if (req.method !== "GET") {
    return NextResponse.json({ success: false, error: "Method not allowed." }, { status: 405 });
  }

  const getEnv = resolveGetEnv(opts);
  const auth = assertCronAuthorized(
    req,
    [getEnv("CRON_SECRET") ?? "", getEnv("FI_PLATFORM_EVENTS_CRON_SECRET") ?? ""],
    { alternateTimingSafeHeaderName: "x-fi-platform-events-secret" }
  );
  if (auth) return auth;

  if (getEnv("FI_PLATFORM_EVENTS_CRON_DISABLED") === "1") {
    logStructured("warn", "fi_platform_events_cron_disabled", {
      reason: "FI_PLATFORM_EVENTS_CRON_DISABLED",
    });
    const body: PlatformEventsProcessCronResponse = {
      success: true,
      processed: 0,
      failed: 0,
      durationMs: 0,
      source: "vercel_cron",
    };
    return NextResponse.json(body);
  }

  const parsed = parseCronQueryParams(req);
  if (parsed instanceof NextResponse) return parsed;

  const processDeliveries = opts?.processDeliveries ?? processFiEventDeliveries;
  const startedAt = Date.now();

  try {
    const result = await processDeliveries({
      limit: parsed.limit ?? FI_PLATFORM_EVENTS_CRON_MAX_BATCH,
      nowMs: startedAt,
    });

    const durationMs = Date.now() - startedAt;
    const processed = result.delivered;
    const failed = result.failed;

    logStructured("info", "fi_platform_events_cron_complete", {
      processed,
      failed,
      durationMs,
      source: "vercel_cron",
    });

    const body: PlatformEventsProcessCronResponse = {
      success: true,
      processed,
      failed,
      durationMs,
      source: "vercel_cron",
    };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    const durationMs = Date.now() - startedAt;
    logStructured("error", "fi_platform_events_cron_failed", { message, durationMs });
    return NextResponse.json({ success: false, error: "Processor unavailable." }, { status: 500 });
  }
}
