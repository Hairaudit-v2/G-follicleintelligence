import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { postIiohrHrStaffSyncHttp } from "@/src/lib/staffImport/iiohrHrStaffSyncPost.server";

export const dynamic = "force-dynamic";

/**
 * IIOHR HR → FI staff sync (producer). Authenticate with header `x-iiohr-sync-secret`
 * matching env `IIOHR_HR_SYNC_SECRET`. Does not accept HR documents — only operational staff rows + bounded metadata.
 */
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const tid = tenantId?.trim();
    if (!tid) {
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });
    }

    const { httpStatus, body } = await postIiohrHrStaffSyncHttp(req, tid);

    const summary = body.summary as { commit?: boolean } | undefined;
    if (body.ok === true && summary?.commit === true) {
      const base = `/fi-admin/${tid}`;
      revalidatePath(`${base}/hr/staff-import`);
      revalidatePath(`${base}/staff`);
      revalidatePath(`${base}/calendar`);
      revalidatePath(base);
    }

    return NextResponse.json(body, { status: httpStatus });
  } catch {
    return NextResponse.json({ ok: false, error: "Request failed." }, { status: 500 });
  }
}
