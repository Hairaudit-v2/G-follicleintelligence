import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildExpenseDocumentStoragePath,
  FI_FINANCIAL_DOCUMENTS_BUCKET,
  assertAllowedExpenseDocumentFile,
} from "@/src/lib/financialOs/expenses/expenseDocumentStorageCore";
import {
  mapExpenseDocumentRow,
  ocrResultToExpenseDraft,
  ocrResultToPayload,
  type FiExpenseDocumentRow,
} from "@/src/lib/financialOs/expenses/expenseOcrCore";
import { resolveExpenseOcrProvider } from "@/src/lib/financialOs/expenses/expenseOcrProviderResolve.server";
import {
  categoryCodeToIdMap,
  ensureExpenseCategoriesForTenant,
  loadExpenseById,
} from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import { mapExpenseRow, type FiExpenseRow } from "@/src/lib/financialOs/expenses/expenseTypes";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

async function writeAudit(input: {
  tenantId: string;
  action: string;
  actorFiUserId?: string | null;
  expenseId?: string | null;
  next?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  supabase?: SupabaseClient;
}): Promise<void> {
  const db = client(input.supabase);
  const { error } = await db.from("fi_expense_audit_events").insert({
    tenant_id: input.tenantId.trim(),
    expense_id: input.expenseId ?? null,
    action: input.action,
    actor_fi_user_id: input.actorFiUserId ?? null,
    previous: input.previous ?? {},
    next: input.next ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function uploadExpenseDocument(input: {
  tenantId: string;
  file: File | Blob;
  contentType: string;
  originalFilename: string;
  docKind: "receipt" | "invoice" | "other";
  expenseId?: string | null;
  createDraftExpense?: boolean;
  runOcrInline?: boolean;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<{
  document: FiExpenseDocumentRow;
  expense: FiExpenseRow | null;
  ocr_applied: boolean;
}> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const db = client(input.supabase);

  const allowed = assertAllowedExpenseDocumentFile({
    size: input.file.size,
    type: input.contentType,
    name: input.originalFilename,
  });
  if (!allowed.ok) throw new Error(allowed.error);

  let expenseId = input.expenseId?.trim() || null;
  let expense: FiExpenseRow | null = null;

  if (expenseId) {
    expense = await loadExpenseById(tid, expenseId, db);
    if (!expense) throw new Error("Expense not found.");
  } else if (input.createDraftExpense) {
    await ensureExpenseCategoriesForTenant(tid, db);
    const today = new Date().toISOString().slice(0, 10);
    const { data: expData, error: expErr } = await db
      .from("fi_expenses")
      .insert({
        tenant_id: tid,
        status: "draft",
        expense_date: today,
        amount_cents: 0,
        currency: "AUD",
        description: `Receipt upload: ${input.originalFilename}`.slice(0, 500),
        vendor_name: null,
        category_id: null,
        created_by_fi_user_id: input.actorFiUserId ?? null,
        metadata: {
          source: "receipt_upload",
          original_filename: input.originalFilename,
        },
      })
      .select("*")
      .single();
    if (expErr) throw new Error(expErr.message);
    expense = mapExpenseRow(expData as Record<string, unknown>);
    expenseId = expense.id;
    await writeAudit({
      tenantId: tid,
      action: "created",
      actorFiUserId: input.actorFiUserId,
      expenseId,
      next: { source: "receipt_upload", status: "draft" },
      supabase: db,
    });
  }

  const documentId = randomUUID();
  const storagePath = buildExpenseDocumentStoragePath({
    tenantId: tid,
    expenseId,
    documentId,
    originalFilename: input.originalFilename,
    contentType: allowed.contentType,
  });

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const { error: upErr } = await db.storage
    .from(FI_FINANCIAL_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: allowed.contentType,
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: docData, error: docErr } = await db
    .from("fi_expense_documents")
    .insert({
      id: documentId,
      tenant_id: tid,
      expense_id: expenseId,
      doc_kind: input.docKind,
      storage_bucket: FI_FINANCIAL_DOCUMENTS_BUCKET,
      storage_path: storagePath,
      content_type: allowed.contentType,
      byte_size: buffer.byteLength,
      ocr_status: "pending",
      ocr_provider: null,
      ocr_payload: {},
      created_by_fi_user_id: input.actorFiUserId ?? null,
      metadata: { original_filename: input.originalFilename },
    })
    .select("*")
    .single();
  if (docErr) {
    await db.storage.from(FI_FINANCIAL_DOCUMENTS_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(docErr.message);
  }

  let document = mapExpenseDocumentRow(docData as Record<string, unknown>);
  let ocrApplied = false;

  if (input.runOcrInline !== false) {
    const processed = await processExpenseDocumentOcr({
      tenantId: tid,
      documentId: document.id,
      actorFiUserId: input.actorFiUserId,
      applyToExpense: Boolean(expenseId),
      supabase: db,
    });
    document = processed.document;
    if (processed.expense) expense = processed.expense;
    ocrApplied = true;
  }

  return { document, expense, ocr_applied: ocrApplied };
}

export async function processExpenseDocumentOcr(input: {
  tenantId: string;
  documentId: string;
  actorFiUserId?: string | null;
  applyToExpense?: boolean;
  supabase?: SupabaseClient;
}): Promise<{ document: FiExpenseDocumentRow; expense: FiExpenseRow | null }> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);

  const { data: docRaw, error: loadErr } = await db
    .from("fi_expense_documents")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", input.documentId.trim())
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!docRaw) throw new Error("Document not found.");

  let document = mapExpenseDocumentRow(docRaw as Record<string, unknown>);
  if (document.tenant_id !== tid) throw new Error("Tenant isolation violation.");

  await db
    .from("fi_expense_documents")
    .update({ ocr_status: "processing" })
    .eq("tenant_id", tid)
    .eq("id", document.id);

  const { data: blob, error: dlErr } = await db.storage
    .from(document.storage_bucket)
    .download(document.storage_path);
  if (dlErr || !blob) {
    const { data: failed } = await db
      .from("fi_expense_documents")
      .update({
        ocr_status: "failed",
        ocr_payload: { error: dlErr?.message ?? "Download failed." },
      })
      .eq("tenant_id", tid)
      .eq("id", document.id)
      .select("*")
      .single();
    return {
      document: mapExpenseDocumentRow((failed ?? docRaw) as Record<string, unknown>),
      expense: null,
    };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const filename =
    typeof document.metadata.original_filename === "string"
      ? document.metadata.original_filename
      : null;

  const provider = resolveExpenseOcrProvider();
  const result = await provider.extract({
    bytes,
    contentType: document.content_type || "application/octet-stream",
    filename,
  });

  const payload = ocrResultToPayload(result);
  const { data: updatedDoc, error: updErr } = await db
    .from("fi_expense_documents")
    .update({
      ocr_status: result.ocr_status,
      ocr_provider: result.provider,
      ocr_payload: payload,
    })
    .eq("tenant_id", tid)
    .eq("id", document.id)
    .select("*")
    .single();
  if (updErr) throw new Error(updErr.message);
  document = mapExpenseDocumentRow(updatedDoc as Record<string, unknown>);

  let expense: FiExpenseRow | null = null;
  if (input.applyToExpense !== false && document.expense_id) {
    expense = await applyOcrResultToExpense({
      tenantId: tid,
      expenseId: document.expense_id,
      result,
      actorFiUserId: input.actorFiUserId,
      supabase: db,
    });
  }

  await writeAudit({
    tenantId: tid,
    action: "ocr_completed",
    actorFiUserId: input.actorFiUserId,
    expenseId: document.expense_id,
    next: {
      document_id: document.id,
      ocr_status: result.ocr_status,
      confidence: result.confidence,
      requires_manual_review: result.requires_manual_review,
    },
    supabase: db,
  });

  return { document, expense };
}

async function applyOcrResultToExpense(input: {
  tenantId: string;
  expenseId: string;
  result: import("./expenseOcrCore").ExpenseOcrResult;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<FiExpenseRow> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const existing = await loadExpenseById(tid, input.expenseId, db);
  if (!existing) throw new Error("Expense not found for OCR apply.");
  if (existing.status === "void" || existing.status === "posted") {
    return existing;
  }

  const draft = ocrResultToExpenseDraft(input.result);
  const categories = await ensureExpenseCategoriesForTenant(tid, db);
  const codeMap = categoryCodeToIdMap(categories);
  const categoryId = draft.suggested_category_code
    ? (codeMap.get(draft.suggested_category_code.toLowerCase()) ?? null)
    : null;

  // Only fill empty / zero fields so manual edits are preserved.
  const patch: Record<string, unknown> = {
    metadata: {
      ...existing.metadata,
      ocr: {
        provider: input.result.provider,
        confidence: input.result.confidence,
        requires_manual_review: draft.needs_review,
        review_reasons: draft.review_reasons,
      },
    },
  };

  if (!existing.vendor_name && draft.vendor_name) patch.vendor_name = draft.vendor_name;
  if (
    (!existing.description || existing.description.startsWith("Receipt upload:")) &&
    draft.description
  ) {
    patch.description = draft.description;
  }
  if (existing.amount_cents === 0 && draft.amount_cents > 0) {
    patch.amount_cents = draft.amount_cents;
  }
  if (draft.expense_date) patch.expense_date = draft.expense_date;
  if (!existing.category_id && categoryId) patch.category_id = categoryId;
  if (draft.currency) patch.currency = draft.currency;

  // Keep draft status when OCR is incomplete.
  if (draft.needs_review) {
    patch.status = "draft";
  } else if (existing.status === "draft" && draft.amount_cents > 0) {
    patch.status = "reviewed";
    patch.reviewed_by_fi_user_id = input.actorFiUserId ?? null;
  }

  const { data, error } = await db
    .from("fi_expenses")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapExpenseRow(data as Record<string, unknown>);
}

export async function loadExpenseDocumentsForTenant(
  tenantId: string,
  limit = 30,
  supabase?: SupabaseClient
): Promise<FiExpenseDocumentRow[]> {
  const tid = tenantId.trim();
  const db = client(supabase);
  const { data, error } = await db
    .from("fi_expense_documents")
    .select("*")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapExpenseDocumentRow(r as Record<string, unknown>));
}

export async function createExpenseDocumentSignedUrl(input: {
  tenantId: string;
  documentId: string;
  ttlSec?: number;
  supabase?: SupabaseClient;
}): Promise<string> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const { data, error } = await db
    .from("fi_expense_documents")
    .select("storage_bucket, storage_path, tenant_id")
    .eq("tenant_id", tid)
    .eq("id", input.documentId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Document not found.");
  const row = data as { storage_bucket: string; storage_path: string; tenant_id: string };
  if (row.tenant_id !== tid) throw new Error("Tenant isolation violation.");

  const { data: signed, error: sErr } = await db.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, input.ttlSec ?? 300);
  if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "Could not sign URL.");
  return signed.signedUrl;
}
