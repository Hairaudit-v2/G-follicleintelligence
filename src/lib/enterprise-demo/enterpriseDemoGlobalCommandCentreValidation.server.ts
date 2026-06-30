import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { ENTERPRISE_DEMO_TENANT_SLUG } from "./enterpriseDemoConstants";
import { loadGlobalCommandCentrePayload } from "./enterpriseDemoGlobalCommandCentreLoader.server";
import {
  appendGlobalCommandCentreValidationCheck,
  finalizeGlobalCommandCentreValidationReport,
  TITAN_DEMO_EXPECTED_CONSULTATION_QUOTES,
  TITAN_DEMO_EXPECTED_SURGERIES,
  TITAN_DEMO_SYNTHETIC_IMAGE_PATH_PREFIX,
  validateGlobalCommandCentrePayloadForDemo,
  validateSyntheticImageStoragePath,
  type GlobalCommandCentreValidationReport,
} from "./enterpriseDemoGlobalCommandCentreValidationModel";
import { resolveEnterpriseDemoTenant } from "./enterpriseDemoTenantAccess.server";

export async function runGlobalCommandCentreDemoValidation(
  tenantIdOrSlug?: string,
  now: Date = new Date()
): Promise<GlobalCommandCentreValidationReport> {
  const checks: GlobalCommandCentreValidationReport["checks"] = [];
  const validatedAt = now.toISOString();
  const lookupKey = tenantIdOrSlug?.trim() || ENTERPRISE_DEMO_TENANT_SLUG;

  let resolved: Awaited<ReturnType<typeof resolveEnterpriseDemoTenant>>;
  try {
    resolved = await resolveEnterpriseDemoTenant(lookupKey);
  } catch (e) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "demo_tenant",
      label: "IHRG enterprise demo tenant",
      severity: "fail",
      detail: e instanceof Error ? e.message : "Tenant lookup failed.",
    });
    return finalizeGlobalCommandCentreValidationReport({
      tenantId: lookupKey,
      tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
      validatedAt,
      checks,
    });
  }

  if (!resolved) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "demo_tenant",
      label: "IHRG enterprise demo tenant",
      severity: "fail",
      detail: `Tenant "${ENTERPRISE_DEMO_TENANT_SLUG}" not found or not marked enterprise_simulation. Run npm run seed:enterprise-demo.`,
    });
    return finalizeGlobalCommandCentreValidationReport({
      tenantId: tenantIdOrSlug?.trim() || ENTERPRISE_DEMO_TENANT_SLUG,
      tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
      validatedAt,
      checks,
    });
  }

  appendGlobalCommandCentreValidationCheck(checks, {
    id: "demo_tenant",
    label: "IHRG enterprise demo tenant",
    severity: "pass",
    detail: `Resolved ${resolved.tenantName} (${resolved.tenantId}).`,
  });

  let payload: Awaited<ReturnType<typeof loadGlobalCommandCentrePayload>>;
  try {
    payload = await loadGlobalCommandCentrePayload(resolved.tenantId, now);
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "command_centre_payload",
      label: "Global Command Centre payload loads",
      severity: "pass",
      detail: `Loaded dashboard data for ${payload.todayYmd}.`,
    });
  } catch (e) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "command_centre_payload",
      label: "Global Command Centre payload loads",
      severity: "fail",
      detail: e instanceof Error ? e.message : "Payload load failed.",
    });
    return finalizeGlobalCommandCentreValidationReport({
      tenantId: resolved.tenantId,
      tenantSlug: resolved.tenantSlug,
      validatedAt,
      checks,
    });
  }

  validateGlobalCommandCentrePayloadForDemo(payload, checks);

  const supabase = supabaseAdmin();
  const tid = resolved.tenantId;

  try {
    const { count: surgeryCount, error: surgeryErr } = await supabase
      .from("fi_surgeries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .filter("metadata->>enterprise_demo_surgery", "eq", "true");
    if (surgeryErr) {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "seed_surgeries",
        label: "Seeded demo surgeries",
        severity: "fail",
        detail: surgeryErr.message,
      });
    } else if ((surgeryCount ?? 0) >= TITAN_DEMO_EXPECTED_SURGERIES) {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "seed_surgeries",
        label: "Seeded demo surgeries",
        severity: "pass",
        detail: `${surgeryCount} demo surgeries (expected ${TITAN_DEMO_EXPECTED_SURGERIES}).`,
      });
    } else {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "seed_surgeries",
        label: "Seeded demo surgeries",
        severity: "warn",
        detail: `${surgeryCount ?? 0} demo surgeries — expected ${TITAN_DEMO_EXPECTED_SURGERIES}.`,
      });
    }

    const { count: invoiceCount, error: invoiceErr } = await supabase
      .from("fi_invoices")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .or("metadata->>enterprise_demo.eq.true,metadata->>enterprise_demo_invoice.eq.true");
    if (invoiceErr) {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "seed_invoices",
        label: "Seeded demo invoices",
        severity: "fail",
        detail: invoiceErr.message,
      });
    } else if ((invoiceCount ?? 0) >= TITAN_DEMO_EXPECTED_CONSULTATION_QUOTES) {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "seed_invoices",
        label: "Seeded demo invoices",
        severity: "pass",
        detail: `${invoiceCount} demo invoices (expected at least ${TITAN_DEMO_EXPECTED_CONSULTATION_QUOTES} consultation quotes).`,
      });
    } else {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "seed_invoices",
        label: "Seeded demo invoices",
        severity: "warn",
        detail: `${invoiceCount ?? 0} demo invoices — expected at least ${TITAN_DEMO_EXPECTED_CONSULTATION_QUOTES}.`,
      });
    }

    const { data: imageSample, error: imageErr } = await supabase
      .from("fi_patient_images")
      .select("storage_path")
      .eq("tenant_id", tid)
      .filter("metadata->>enterprise_demo_image", "eq", "true")
      .limit(5);
    if (imageErr) {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "synthetic_image_paths",
        label: "Synthetic imaging placeholders",
        severity: "fail",
        detail: imageErr.message,
      });
    } else if (!imageSample?.length) {
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "synthetic_image_paths",
        label: "Synthetic imaging placeholders",
        severity: "warn",
        detail:
          "No demo patient images found — ImagingOS seed may be missing. Command centre does not render images.",
      });
    } else {
      const invalid = imageSample.filter(
        (row) => !validateSyntheticImageStoragePath(String(row.storage_path ?? ""))
      );
      appendGlobalCommandCentreValidationCheck(checks, {
        id: "synthetic_image_paths",
        label: "Synthetic imaging placeholders",
        severity: invalid.length === 0 ? "pass" : "fail",
        detail:
          invalid.length === 0
            ? `Sampled paths use metadata-only prefix "${TITAN_DEMO_SYNTHETIC_IMAGE_PATH_PREFIX}" — no real files required.`
            : `${invalid.length} sampled image path(s) missing synthetic prefix.`,
      });
    }
  } catch (e) {
    appendGlobalCommandCentreValidationCheck(checks, {
      id: "seed_depth_checks",
      label: "Seed depth checks",
      severity: "fail",
      detail: e instanceof Error ? e.message : "Seed depth validation failed.",
    });
  }

  return finalizeGlobalCommandCentreValidationReport({
    tenantId: resolved.tenantId,
    tenantSlug: resolved.tenantSlug,
    validatedAt,
    checks,
  });
}
