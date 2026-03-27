/**
 * POST /api/fi/events
 * Additive FI event facade for HLI/HairAudit event ingestion.
 */
import { NextResponse } from "next/server";
import { ingestFiEvent } from "@/lib/fi/events/ingest";

export const dynamic = "force-dynamic";

function getFailureStatus(message: string): number {
  const clientErrorPatterns = [
    /is required/i,
    /must be/i,
    /^unsupported /i,
    /^invalid json body\.$/i,
  ];

  if (clientErrorPatterns.some((pattern) => pattern.test(message))) {
    return 400;
  }

  return 500;
}

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
    }

    const result = await ingestFiEvent(body);
    return NextResponse.json(result, { status: result.ok ? 200 : getFailureStatus(result.message) });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}
