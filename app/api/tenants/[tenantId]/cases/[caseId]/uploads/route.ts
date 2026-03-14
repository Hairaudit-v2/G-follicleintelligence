/**
 * POST /api/tenants/[tenantId]/cases/[caseId]/uploads
 * Upload files with canonical types. Path: tenants/{tenantId}/cases/{caseId}/{type}/{filename}
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFiUploadType, buildFiUploadPath } from "@/lib/fi/uploadTypes";
import { validateUploadFileByType } from "@/lib/fi/validation";

const BUCKET = process.env.FI_STORAGE_BUCKET_INTAKES || "fi-intakes";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; caseId: string }> }
) {
  try {
    const { tenantId, caseId } = await params;
    if (!tenantId || !caseId)
      return NextResponse.json(
        { ok: false, error: "Missing tenantId or caseId." },
        { status: 400 }
      );

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const form = await req.formData();
    const typeRaw = form.get("type");
    const type = normalizeFiUploadType(typeRaw);
    const files = form.getAll("files") as File[];
    if (files.length === 0)
      return NextResponse.json({ ok: false, error: "No files provided." }, { status: 400 });

    const supabase = supabaseAdmin();

    const { data: caseRow } = await supabase
      .from("fi_cases")
      .select("id")
      .eq("id", caseId)
      .eq("tenant_id", tenantId)
      .single();
    if (!caseRow)
      return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });

    const fileRows: {
      type: string;
      filename: string;
      storage_path: string;
      mime_type: string;
      size_bytes: number;
    }[] = [];

    for (const file of files) {
      if (!file?.size) continue;
      const v = validateUploadFileByType(
        { name: file.name, type: file.type, size: file.size },
        type
      );
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

      const storagePath = buildFiUploadPath(tenantId, caseId, type, file.name);

      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

      if (uploadErr)
        return NextResponse.json(
          { ok: false, error: `Upload failed: ${uploadErr.message}` },
          { status: 500 }
        );

      fileRows.push({
        type,
        filename: file.name,
        storage_path: storagePath,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      });
    }

    const inserts = fileRows.map((r) => ({
      tenant_id: tenantId,
      case_id: caseId,
      type: r.type,
      filename: r.filename,
      storage_path: r.storage_path,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
    }));

    const { error: insertErr } = await supabase.from("fi_uploads").insert(inserts);

    if (insertErr)
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      uploaded: fileRows.length,
      files: fileRows.map((r) => ({ filename: r.filename, type: r.type })),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
