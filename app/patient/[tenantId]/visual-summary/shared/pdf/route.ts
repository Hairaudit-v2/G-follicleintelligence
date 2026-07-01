/**
 * GET /patient/[tenantId]/visual-summary/shared/pdf?token=...
 * Unauthenticated PDF download via signed share token (approved summaries only).
 */
import { NextRequest, NextResponse } from "next/server";

import { loadSharedPatientVisualSummaryPdf } from "@/src/lib/imaging-os/patientVisualSummarySharedPdf.server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) {
    return NextResponse.json({ ok: false, error: "Missing tenant." }, { status: 400 });
  }

  const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing share token." }, { status: 400 });
  }

  const result = await loadSharedPatientVisualSummaryPdf({ tenantId: tid, token });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}