/**
 * GET /patient/[tenantId]/visual-summary/pdf
 * Patient portal PDF download for approved visual summaries only.
 *
 * Query: caseId (required), reportType (optional)
 */
import { NextRequest, NextResponse } from "next/server";

import { loadPatientPortalVisualSummaryPdf } from "@/src/lib/imaging-os/patientVisualSummaryPortalPdf.server";
import { resolvePatientPortalAccess } from "@/src/lib/patientPortal/patientPortalAccess.server";

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

  const access = await resolvePatientPortalAccess(tid);
  if (access.status !== "linked") {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId")?.trim() ?? "";
  const reportType = url.searchParams.get("reportType");

  const result = await loadPatientPortalVisualSummaryPdf({
    tenantId: tid,
    patientId: access.patientId,
    caseId,
    reportTypeRaw: reportType,
  });

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