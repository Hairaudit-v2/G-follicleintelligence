import { NextResponse } from "next/server";
import {
  authorizeInternalImagingClassifierRequest,
  FI_IMAGING_HDR_SOURCE_SYSTEM,
} from "@/src/lib/security/internalImagingClassifierAuth";
import { parseUnifiedImageClassifyRequest } from "@/src/lib/imaging/unifiedClassifier/unifiedImageClassifyRequest";
import { classifyUnifiedImageRequest } from "@/src/lib/imaging/unifiedClassifier/unifiedImageClassifyService.server";
import { logImagingClassifierEvent } from "@/src/lib/imaging/unifiedClassifier/imagingClassifierObservability";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    logImagingClassifierEvent("fi_imaging_classifier_validation_failed", {
      reason: "invalid_json",
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseUnifiedImageClassifyRequest(body);
  if (!parsed.ok) {
    logImagingClassifierEvent("fi_imaging_classifier_validation_failed", {
      reason: parsed.error,
      field: parsed.field ?? null,
    });
    return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  }

  const auth = authorizeInternalImagingClassifierRequest({
    req,
    rawBody,
    bodySourceSystem: parsed.data.source_system,
  });

  if (!auth.ok) {
    const status = auth.httpStatus;
    const message =
      auth.reason === "missing_token_config" || auth.reason === "missing_hmac_secret"
        ? "Service unavailable"
        : auth.reason === "unsupported_source"
          ? "Unsupported source_system"
          : "Unauthorized";
    return NextResponse.json({ error: message, code: auth.reason }, { status });
  }

  const sourceHeader = req.headers.get(FI_IMAGING_HDR_SOURCE_SYSTEM)?.trim();
  if (sourceHeader && sourceHeader !== parsed.data.source_system) {
    return NextResponse.json(
      { error: "x-fi-source-system header mismatch", code: "source_header_mismatch" },
      { status: 400 }
    );
  }

  const outcome = await classifyUnifiedImageRequest(parsed.data);
  if (!outcome.ok) {
    return NextResponse.json(
      { success: false, error: { code: outcome.code, message: outcome.message } },
      { status: outcome.httpStatus }
    );
  }

  return NextResponse.json(outcome.result);
}
