"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isFiOsPlatformAdminFullSessionBypass, loadProxyFiUserRowForPlatformAdminTenant, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { insertFiTaxLocalisationAuditEvent } from "@/src/lib/taxLocalisation/taxLocalisationAudit.server";
import { getTaxLocalisationAccess } from "@/src/lib/taxLocalisation/taxLocalisationAccess.server";
import { mergeTaxLocalisationFromStorage } from "@/src/lib/taxLocalisation/taxLocalisationMerge";
import {
  loadTaxLocalisationDocumentForScope,
  upsertTaxLocalisationDocument,
} from "@/src/lib/taxLocalisation/taxLocalisationSettings.server";
import type { FiTaxLocalisationDocument } from "@/src/lib/taxLocalisation/taxLocalisationTypes";
import { FI_TAX_COUNTRY_REGIONS, FI_TAX_CURRENCIES } from "@/src/lib/taxLocalisation/taxLocalisationTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function errMsg(e: unknown): string {
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => JSON.parse(stableStringify(x))));
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = o[k];
  return JSON.stringify(sorted);
}

const saveSchema = z.object({
  tenantId: z.string().uuid(),
  clinicId: z.string().uuid().nullable().optional(),
  document: z.unknown(),
});

function parseDocument(raw: unknown): FiTaxLocalisationDocument {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid document.");
  }
  const o = raw as Record<string, unknown>;
  const country = String(o.countryRegion ?? "");
  const currency = String(o.currency ?? "");
  if (!(FI_TAX_COUNTRY_REGIONS as readonly string[]).includes(country)) {
    throw new Error("Invalid country / region.");
  }
  if (!(FI_TAX_CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error("Invalid currency.");
  }
  const effectiveFrom = typeof o.effectiveFrom === "string" ? o.effectiveFrom : new Date().toISOString();
  return mergeTaxLocalisationFromStorage({
    countryRegion: country,
    currency,
    effectiveFrom,
    taxProfile: o.taxProfile,
    invoiceSettings: o.invoiceSettings,
    receiptSettings: o.receiptSettings,
  });
}

export type TaxLocalisationSaveResult = { ok: true } | { ok: false; error: string };

export async function saveTaxLocalisationSettingsAction(body: unknown): Promise<TaxLocalisationSaveResult> {
  try {
    const parsed = saveSchema.parse(body);
    const tid = parsed.tenantId.trim();
    const cid = parsed.clinicId?.trim() || null;

    await rejectStaffPinSessionForRestrictedMutation(tid);

    const access = await getTaxLocalisationAccess(tid);
    if (!access.canView) {
      return { ok: false, error: "Not allowed to view tax settings for this tenant." };
    }
    if (!access.canEdit) {
      return { ok: false, error: "You do not have permission to edit tax & localisation settings." };
    }

    const authId = await resolveAuthUserId(null);
    let actorFiUserId = access.actorFiUserId;
    if (!actorFiUserId && authId && (await isFiOsPlatformAdminFullSessionBypass(authId))) {
      const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, authId);
      actorFiUserId = proxy?.id ?? null;
    }
    if (!actorFiUserId) {
      return { ok: false, error: "Could not resolve actor for audit trail." };
    }

    const doc = parseDocument(parsed.document);

    const supabase = supabaseAdmin();
    let existingQ = supabase.from("fi_tax_localisation_settings").select("id").eq("tenant_id", tid);
    existingQ = cid ? existingQ.eq("clinic_id", cid) : existingQ.is("clinic_id", null);
    const { data: existingRow, error: exErr } = await existingQ.maybeSingle();
    if (exErr) return { ok: false, error: exErr.message };

    const before = await loadTaxLocalisationDocumentForScope({ tenantId: tid, clinicId: cid });

    const taxBefore = before
      ? {
          countryRegion: before.countryRegion,
          currency: before.currency,
          effectiveFrom: before.effectiveFrom,
          taxProfile: before.taxProfile,
        }
      : null;
    const taxAfter = {
      countryRegion: doc.countryRegion,
      currency: doc.currency,
      effectiveFrom: doc.effectiveFrom,
      taxProfile: doc.taxProfile,
    };
    const invBefore = before?.invoiceSettings ?? doc.invoiceSettings;
    const invAfter = doc.invoiceSettings;

    await upsertTaxLocalisationDocument({ tenantId: tid, clinicId: cid, document: doc });

    const isCreate = !existingRow;
    if (isCreate) {
      await insertFiTaxLocalisationAuditEvent({
        tenantId: tid,
        clinicId: cid,
        eventKind: "tax_settings.created",
        actorFiUserId,
        detail: { snapshot: doc },
      });
    } else {
      if (!taxBefore || stableStringify(taxBefore) !== stableStringify(taxAfter)) {
        await insertFiTaxLocalisationAuditEvent({
          tenantId: tid,
          clinicId: cid,
          eventKind: "tax_settings.updated",
          actorFiUserId,
          detail: { before: taxBefore, after: taxAfter },
        });
      }
      if (stableStringify(invBefore) !== stableStringify(invAfter)) {
        await insertFiTaxLocalisationAuditEvent({
          tenantId: tid,
          clinicId: cid,
          eventKind: "invoice_settings.updated",
          actorFiUserId,
          detail: { before: invBefore, after: invAfter },
        });
      }
    }

    revalidatePath(`/fi-admin/${tid}/settings/tax-localisation`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    return { ok: false, error: errMsg(e) };
  }
}
