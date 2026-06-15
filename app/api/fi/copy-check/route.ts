/**
 * POST /api/fi/copy-check
 * Run claim-safety validation on text. Use for "copy check" testing.
 *
 * **Production:** disabled by default (returns 404) to avoid unauthenticated CPU abuse.
 * Opt in with `FI_ENABLE_PUBLIC_COPY_CHECK=true` only behind additional edge controls.
 */
import { NextResponse } from "next/server";
import { validateClaimSafety } from "@/src/lib/fi/copy/claimSafety";

export const dynamic = "force-dynamic";

const AFFIRMATIVE = new Set(["1", "true", "yes"]);

function isPublicCopyCheckEnabled(): boolean {
  const raw = process.env.FI_ENABLE_PUBLIC_COPY_CHECK;
  if (raw === undefined || raw === "") return false;
  return AFFIRMATIVE.has(raw.trim().toLowerCase());
}

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production" && !isPublicCopyCheckEnabled()) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }

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
