#!/usr/bin/env tsx
/**
 * Idempotent seed: Evolved SMOKETEST fi_payments rows for M4 live bake.
 *
 * Seeds one manual-tracking row (null/manual provider) and one Stripe provider-confirmed row
 * on the golden SMOKETEST patient/case. Prefixes SMOKETEST- per clinic readiness runbook.
 *
 * Usage:
 *   node scripts/run-with-system-ca.mjs tsx scripts/seed-evolved-smoketest-payments.ts
 *   node scripts/run-with-system-ca.mjs tsx scripts/seed-evolved-smoketest-payments.ts --commit
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";

const EVOLVED_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const GOLDEN_PATIENT_ID = "287348d5-18bd-4434-9bab-7caafacbfe86";
const GOLDEN_CASE_ID = "80ae7196-c15e-4929-8e1d-7ceaad5a2a31";

const SMOKETEST_SEED_TAG = "SMOKETEST-PAYMENTS-M4-20260713";

type PaymentSeedSpec = {
  key: string;
  invoiceNumber: string;
  invoiceTitle: string;
  provider: string | null;
  providerPaymentIntentId: string | null;
  status: "manually_recorded" | "succeeded";
  amountCents: number;
};

const PAYMENT_SPECS: PaymentSeedSpec[] = [
  {
    key: "SMOKETEST-PAYMENT-MANUAL",
    invoiceNumber: "SMOKETEST-INV-MANUAL",
    invoiceTitle: "SMOKETEST manual payment invoice",
    provider: null,
    providerPaymentIntentId: null,
    status: "manually_recorded",
    amountCents: 50_000,
  },
  {
    key: "SMOKETEST-PAYMENT-STRIPE",
    invoiceNumber: "SMOKETEST-INV-STRIPE",
    invoiceTitle: "SMOKETEST Stripe payment invoice",
    provider: "stripe",
    providerPaymentIntentId: "SMOKETEST-pi-stripe-m4-20260713",
    status: "succeeded",
    amountCents: 75_000,
  },
];

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

const commit = process.argv.includes("--commit");

type ResolvedContext = {
  tenantId: string;
  patientId: string;
  caseId: string;
  clinicId: string | null;
};

async function resolveContext(): Promise<ResolvedContext> {
  const supabase = supabaseAdmin();

  const { data: tenant, error: tenantErr } = await supabase
    .from("fi_tenants")
    .select("id, slug, name")
    .eq("id", EVOLVED_TENANT_ID)
    .maybeSingle();
  if (tenantErr) throw new Error(tenantErr.message);
  if (!tenant) throw new Error(`Tenant not found: ${EVOLVED_TENANT_ID}`);

  const { data: patient, error: patientErr } = await supabase
    .from("fi_patients")
    .select("id, tenant_id")
    .eq("tenant_id", EVOLVED_TENANT_ID)
    .eq("id", GOLDEN_PATIENT_ID)
    .maybeSingle();
  if (patientErr) throw new Error(patientErr.message);
  if (!patient) {
    throw new Error(`Golden patient not found: ${GOLDEN_PATIENT_ID} on tenant ${EVOLVED_TENANT_ID}`);
  }

  const { data: caseRow, error: caseErr } = await supabase
    .from("fi_cases")
    .select("id, tenant_id, clinic_id, patient_id")
    .eq("tenant_id", EVOLVED_TENANT_ID)
    .eq("id", GOLDEN_CASE_ID)
    .maybeSingle();
  if (caseErr) throw new Error(caseErr.message);
  if (!caseRow) {
    throw new Error(`Golden case not found: ${GOLDEN_CASE_ID} on tenant ${EVOLVED_TENANT_ID}`);
  }

  const clinicId = (caseRow as { clinic_id?: string | null }).clinic_id ?? null;

  return {
    tenantId: EVOLVED_TENANT_ID,
    patientId: GOLDEN_PATIENT_ID,
    caseId: GOLDEN_CASE_ID,
    clinicId: clinicId ? String(clinicId) : null,
  };
}

async function findInvoiceByNumber(
  tenantId: string,
  invoiceNumber: string
): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("invoice_number", invoiceNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String((data as { id: string }).id) : null;
}

async function findPaymentByKey(tenantId: string, key: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payments")
    .select("id, provider, total_cents, status")
    .eq("tenant_id", tenantId)
    .contains("metadata", { smoketest_key: key })
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String((data as { id: string }).id) : null;
}

async function ensureInvoice(
  ctx: ResolvedContext,
  spec: PaymentSeedSpec
): Promise<{ invoiceId: string; created: boolean }> {
  const existingId = await findInvoiceByNumber(ctx.tenantId, spec.invoiceNumber);
  if (existingId) return { invoiceId: existingId, created: false };

  const taxCents = Math.round(spec.amountCents * 0.1);
  const totalCents = spec.amountCents + taxCents;
  const now = new Date().toISOString();

  if (!commit) {
    console.log(`  [dry-run] would create invoice ${spec.invoiceNumber} (${totalCents} cents)`);
    return { invoiceId: `dry-run-invoice-${spec.key}`, created: true };
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .insert({
      tenant_id: ctx.tenantId,
      clinic_id: ctx.clinicId,
      patient_id: ctx.patientId,
      case_id: ctx.caseId,
      invoice_kind: "surgery_deposit",
      status: "partially_paid",
      amount_cents: spec.amountCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      amount_paid_cents: spec.amountCents,
      currency: "AUD",
      invoice_number: spec.invoiceNumber,
      title: spec.invoiceTitle,
      issued_at: now,
      metadata: {
        smoketest_key: spec.key,
        smoketest_seed_tag: SMOKETEST_SEED_TAG,
        smoketest_prefix: "SMOKETEST-",
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { invoiceId: String((data as { id: string }).id), created: true };
}

async function ensurePayment(
  ctx: ResolvedContext,
  spec: PaymentSeedSpec,
  invoiceId: string
): Promise<{ paymentId: string; created: boolean; provider: string | null; totalCents: number }> {
  const existingId = await findPaymentByKey(ctx.tenantId, spec.key);
  if (existingId) {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_payments")
      .select("id, provider, total_cents")
      .eq("id", existingId)
      .single();
    if (error) throw new Error(error.message);
    return {
      paymentId: existingId,
      created: false,
      provider: (data as { provider?: string | null }).provider ?? null,
      totalCents: Number((data as { total_cents: number }).total_cents),
    };
  }

  const taxCents = Math.round(spec.amountCents * 0.1);
  const totalCents = spec.amountCents + taxCents;
  const now = new Date().toISOString();

  if (!commit) {
    console.log(
      `  [dry-run] would create payment ${spec.key} provider=${spec.provider ?? "null"} total=${totalCents}`
    );
    return {
      paymentId: `dry-run-payment-${spec.key}`,
      created: true,
      provider: spec.provider,
      totalCents,
    };
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_payments")
    .insert({
      tenant_id: ctx.tenantId,
      clinic_id: ctx.clinicId,
      patient_id: ctx.patientId,
      case_id: ctx.caseId,
      invoice_id: invoiceId,
      status: spec.status,
      amount_cents: spec.amountCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      currency: "AUD",
      provider: spec.provider,
      provider_payment_intent_id: spec.providerPaymentIntentId,
      provider_ref: spec.key,
      metadata: {
        smoketest_key: spec.key,
        smoketest_seed_tag: SMOKETEST_SEED_TAG,
        smoketest_prefix: "SMOKETEST-",
      },
      created_at: now,
      updated_at: now,
    })
    .select("id, provider, total_cents")
    .single();
  if (error) throw new Error(error.message);

  return {
    paymentId: String((data as { id: string }).id),
    created: true,
    provider: (data as { provider?: string | null }).provider ?? null,
    totalCents: Number((data as { total_cents: number }).total_cents),
  };
}

async function main(): Promise<void> {
  console.log(`Evolved SMOKETEST payment seed (${commit ? "COMMIT" : "dry-run"})`);
  console.log(`Tenant: ${EVOLVED_TENANT_ID}`);
  console.log(`Patient: ${GOLDEN_PATIENT_ID}`);
  console.log(`Case: ${GOLDEN_CASE_ID}\n`);

  const ctx = await resolveContext();
  console.log(`Resolved clinic: ${ctx.clinicId ?? "(none)"}\n`);

  const results: {
    key: string;
    paymentId: string;
    invoiceId: string;
    provider: string | null;
    totalCents: number;
    created: boolean;
  }[] = [];

  for (const spec of PAYMENT_SPECS) {
    console.log(`Processing ${spec.key}…`);
    const { invoiceId, created: invoiceCreated } = await ensureInvoice(ctx, spec);
    const payment = await ensurePayment(ctx, spec, invoiceId);
    results.push({
      key: spec.key,
      paymentId: payment.paymentId,
      invoiceId,
      provider: payment.provider,
      totalCents: payment.totalCents,
      created: payment.created || invoiceCreated,
    });
    console.log(
      `  payment=${payment.paymentId} invoice=${invoiceId} provider=${payment.provider ?? "null"} total=${payment.totalCents} ${payment.created ? "CREATED" : "existing"}`
    );
  }

  console.log("\nSummary:");
  console.log(JSON.stringify({ mode: commit ? "commit" : "dry-run", results }, null, 2));

  if (!commit) {
    console.log("\nRe-run with --commit to apply.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
