import { NextResponse } from "next/server";

import { processHliTrichoscopyEvent } from "@/src/lib/integrations/hliTrichoscopy/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated inbound HLI trichoscopy events.
 * Signature verification runs before service-role clinical mutations.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const result = await processHliTrichoscopyEvent({
    headers: request.headers,
    rawBody,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason, error: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    receiptId: result.receiptId,
    duplicate: Boolean(result.duplicate),
    ignored: Boolean(result.ignored),
  });
}
