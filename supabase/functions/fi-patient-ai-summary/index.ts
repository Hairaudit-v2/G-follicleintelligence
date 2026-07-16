/**
 * Supabase Edge Function skeleton — AI Patient Summary (operational only).
 *
 * Prefer the Next.js server action `generatePatientAiSummaryAction` for
 * authenticated FI OS sessions (tenant membership + RLS-aware loaders).
 *
 * This Edge Function is for optional async / batch paths. It:
 *  - Validates tenant_id + patient_id
 *  - Refuses to accept free-text clinical notes
 *  - Documents the safety-first contract
 *
 * Deploy: set XAI_API_KEY secret; call with service role or verified JWT.
 * Full generation logic lives in the app (`patientAiSummary.server.ts`) so
 * guardrails stay single-source of truth — keep this skeleton thin.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DISCLAIMER =
  "This is a summary of recorded operational data only — always verify clinically.";

const BLOCKED = [
  "diagnose",
  "prescribe",
  "dosage",
  "treatment plan",
  "finasteride",
  "minoxidil",
] as const;

type RequestBody = {
  tenant_id?: string;
  patient_id?: string;
  /** Operational facts only — never raw clinical notes. */
  facts?: Record<string, unknown>;
  /** If true, return schema only (health check). */
  dry_run?: boolean;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "POST only" });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const tenantId = String(body.tenant_id ?? "").trim();
  const patientId = String(body.patient_id ?? "").trim();
  if (!tenantId || !patientId) {
    return json(400, { ok: false, error: "tenant_id and patient_id required" });
  }

  // Reject payloads that smuggle free-text notes
  const facts = body.facts ?? {};
  const factsBlob = JSON.stringify(facts).toLowerCase();
  if (
    "admin_note" in facts ||
    "clinical_note" in facts ||
    "soap" in facts ||
    "medication_list" in facts
  ) {
    return json(400, {
      ok: false,
      error: "facts must not include clinical note or medication free text",
      disclaimer: DISCLAIMER,
    });
  }

  for (const phrase of BLOCKED) {
    if (factsBlob.includes(phrase)) {
      return json(400, {
        ok: false,
        error: `facts contain blocked operational keyword: ${phrase}`,
        disclaimer: DISCLAIMER,
      });
    }
  }

  if (body.dry_run) {
    return json(200, {
      ok: true,
      dry_run: true,
      message:
        "Contract OK. Use Next.js generatePatientAiSummary for production generation.",
      disclaimer: DISCLAIMER,
      tenant_id: tenantId,
      patient_id: patientId,
    });
  }

  // Intentionally not calling xAI here — single implementation in the app server
  // prevents prompt drift. Wire a shared package later if Edge needs full generation.
  return json(501, {
    ok: false,
    error:
      "Generation is implemented in the FI OS server action (patientAiSummary.server). " +
      "Call generatePatientAiSummaryAction from the app, or extend this function with the shared module.",
    disclaimer: DISCLAIMER,
    tenant_id: tenantId,
    patient_id: patientId,
  });
});
