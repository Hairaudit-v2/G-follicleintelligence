/**
 * POST /api/public/platform-review
 * Public enterprise Platform & Migration Review enquiry.
 *
 * Destination decision (FI-WEB-REFRESH-1D):
 * A. Email notification to sales (continuity with prior mailto sales@ path).
 * Does not dual-write to HubSpot or native tenant LeadFlow (no public tenant lead path).
 */

import { NextResponse } from "next/server";

import {
  formatPlatformReviewEmailBody,
  platformReviewDuplicateFingerprint,
  validatePlatformReviewForm,
  type PlatformReviewFormValues,
} from "@/lib/marketing/platformReviewFormSchema";
import { sendResendEmailHttp } from "@/src/lib/email/resendHttpSend.server";
import { logStructured } from "@/src/lib/server/structuredLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;

type Bucket = { count: number; resetAt: number };

const recentFingerprints = new Map<string, number>();
const rateByIp = new Map<string, Bucket>();

function pruneMaps(now: number) {
  for (const [k, ts] of recentFingerprints) {
    if (now - ts > DUPLICATE_WINDOW_MS) recentFingerprints.delete(k);
  }
  for (const [k, bucket] of rateByIp) {
    if (now > bucket.resetAt) rateByIp.delete(k);
  }
}

function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function allowRate(ip: string, now: number): boolean {
  const bucket = rateByIp.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateByIp.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_MAX) return false;
  bucket.count += 1;
  return true;
}

function asFormValues(body: unknown): PlatformReviewFormValues | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const bool = (k: string) => o[k] === true || o[k] === "true" || o[k] === "on";
  return {
    firstName: str("firstName"),
    lastName: str("lastName"),
    workEmail: str("workEmail"),
    phone: str("phone"),
    role: str("role"),
    organisation: str("organisation"),
    country: str("country"),
    cityRegion: str("cityRegion"),
    locations: str("locations"),
    staffCount: str("staffCount"),
    monthlyEnquiries: str("monthlyEnquiries"),
    monthlyConsultations: str("monthlyConsultations"),
    monthlyProcedures: str("monthlyProcedures"),
    crmSystem: str("crmSystem"),
    bookingSystem: str("bookingSystem"),
    patientRecordSystem: str("patientRecordSystem"),
    imagingSystem: str("imagingSystem"),
    trainingSystem: str("trainingSystem"),
    otherSystems: str("otherSystems"),
    primaryInterest: str("primaryInterest"),
    adoptionStage: str("adoptionStage"),
    mainProblems: str("mainProblems"),
    priorityWorkflows: str("priorityWorkflows"),
    additionalContext: str("additionalContext"),
    preferredTimezone: str("preferredTimezone"),
    preferredContactMethod: str("preferredContactMethod") || "Either",
    consentContact: bool("consentContact"),
    companyWebsite: str("companyWebsite"),
    submissionKey: str("submissionKey"),
    landingPage: str("landingPage"),
    referrer: str("referrer"),
    utmSource: str("utmSource"),
    utmMedium: str("utmMedium"),
    utmCampaign: str("utmCampaign"),
    utmContent: str("utmContent"),
    utmTerm: str("utmTerm"),
  };
}

export async function POST(request: Request) {
  const now = Date.now();
  pruneMaps(now);

  const ip = clientIp(request);
  if (!allowRate(ip, now)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const raw = asFormValues(json);
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: silent success to reduce bot retries without creating a lead.
  if (raw.companyWebsite.trim()) {
    logStructured("info", "platform_review_honeypot", { ip_hash: ip.slice(0, 8) });
    return NextResponse.json({ ok: true });
  }

  const validated = validatePlatformReviewForm(raw);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: "Please correct the highlighted fields.", errors: validated.errors },
      { status: 400 }
    );
  }

  const values = validated.values;
  const fingerprint = platformReviewDuplicateFingerprint(values);
  const last = recentFingerprints.get(fingerprint);
  if (last && now - last < DUPLICATE_WINDOW_MS) {
    return NextResponse.json(
      {
        ok: false,
        code: "duplicate",
        error: "This enquiry appears to have already been submitted recently.",
      },
      { status: 409 }
    );
  }

  const toEmail =
    process.env.PLATFORM_REVIEW_TO_EMAIL?.trim() ||
    process.env.SALES_INBOUND_EMAIL?.trim() ||
    "sales@follicleintelligence.ai";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.PLATFORM_REVIEW_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "";

  const subject = `Platform review: ${values.organisation} — ${values.primaryInterest}`;
  const text = formatPlatformReviewEmailBody(values);

  if (!apiKey || !fromEmail) {
    logStructured("error", "platform_review_email_not_configured", {
      has_api_key: Boolean(apiKey),
      has_from: Boolean(fromEmail),
      interest: values.primaryInterest,
      adoption: values.adoptionStage,
      // no email/PII in logs
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Enquiry delivery is temporarily unavailable. Please email sales@follicleintelligence.ai.",
      },
      { status: 503 }
    );
  }

  try {
    await sendResendEmailHttp(
      {
        apiKey,
        from: fromEmail,
        to: [toEmail],
        subject,
        text,
      },
      { delivery_path: "public_platform_review" }
    );
  } catch {
    logStructured("error", "platform_review_email_send_failed", {
      delivery_path: "public_platform_review",
      interest: values.primaryInterest,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "We could not send your enquiry right now. Please try again or email sales@follicleintelligence.ai.",
      },
      { status: 503 }
    );
  }

  recentFingerprints.set(fingerprint, now);

  logStructured("info", "platform_review_enquiry_accepted", {
    interest: values.primaryInterest,
    adoption: values.adoptionStage,
    crm: values.crmSystem,
    locations: values.locations,
    has_utm: Boolean(values.utmSource || values.utmCampaign),
  });

  return NextResponse.json({ ok: true });
}
