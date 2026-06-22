import { NextResponse } from "next/server";

import { receiveIiohrCompetencyExport } from "@/src/lib/academy-os/academyCompetencyReceiver.server";
import { evaluateIiohrCompetencyExportAuth } from "@/src/lib/academy-os/iiohrCompetencyExportAuth.server";

export const dynamic = "force-dynamic";

/**
 * IIOHR Academy → FI OS competency export receiver.
 * Authenticate with header `x-iiohr-competency-export-secret` matching `IIOHR_FI_COMPETENCY_EXPORT_SECRET`.
 * Requires `IIOHR_FI_COMPETENCY_EXPORT_ENABLED=true`.
 */
export async function POST(req: Request) {
  try {
    const auth = evaluateIiohrCompetencyExportAuth(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.httpStatus });
    }

    const rawBody = await req.json().catch(() => null);
    const result = await receiveIiohrCompetencyExport(rawBody);

    if (result.ok) {
      return NextResponse.json(
        {
          ok: true,
          status: result.status,
          staffId: result.staffId,
          identityResolution: result.identityResolution,
          projectionsUpserted: result.projectionsUpserted,
          exportEventId: result.exportEventId,
          importEventId: result.importEventId,
        },
        { status: 200 }
      );
    }

    const httpStatus =
      result.status === "validation_failed"
        ? 400
        : result.status === "unresolved_staff"
          ? 422
          : 500;

    return NextResponse.json(
      {
        ok: false,
        status: result.status,
        error: result.error,
        importEventId: result.importEventId ?? null,
      },
      { status: httpStatus }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Request failed." }, { status: 500 });
  }
}
