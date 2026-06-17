import { NextResponse } from "next/server";
import {
  authorizeHairauditClassifierRequest,
  warnIfStubModeInProduction,
} from "@/src/lib/security/hairauditClassifierAuth";
import {
  classifyHairAuditImageRequest,
  parseHairAuditImageClassifyRequest,
} from "@/src/lib/hairaudit/fiOsHairAuditImageClassifyService";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(req: Request) {
  warnIfStubModeInProduction();

  if (!authorizeHairauditClassifierRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseHairAuditImageClassifyRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const outcome = await classifyHairAuditImageRequest(parsed.data);
  if (!outcome.ok) {
    return NextResponse.json(
      { error: "Classification provider not ready", code: outcome.code },
      { status: outcome.status }
    );
  }

  return NextResponse.json(outcome.result);
}
