/**
 * POST /api/fi/copy-check
 * Run claim-safety validation on text. Use for "copy check" testing.
 */
import { NextResponse } from "next/server";
import { validateClaimSafety } from "@/src/lib/fi/copy/claimSafety";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : String(body.text ?? "");

    const result = validateClaimSafety(text);

    return NextResponse.json({
      ok: result.ok,
      violations: result.ok ? [] : result.violations,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}
