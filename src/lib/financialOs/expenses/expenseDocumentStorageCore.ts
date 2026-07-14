/** Pure helpers for FinancialOS expense document storage (no DB I/O). */

export const FI_FINANCIAL_DOCUMENTS_BUCKET = "fi-financial-documents";
export const FI_EXPENSE_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

export const FI_EXPENSE_DOCUMENT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/csv",
  "text/plain",
]);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
};

export function assertAllowedExpenseDocumentFile(file: {
  size: number;
  type?: string | null;
  name?: string | null;
}): { ok: true; contentType: string } | { ok: false; error: string } {
  if (!file || file.size <= 0) return { ok: false, error: "File is empty." };
  if (file.size > FI_EXPENSE_DOCUMENT_MAX_BYTES) {
    return {
      ok: false,
      error: `File must be ${FI_EXPENSE_DOCUMENT_MAX_BYTES / (1024 * 1024)}MB or smaller.`,
    };
  }
  let contentType = (file.type || "").trim().toLowerCase();
  if (!contentType && file.name?.toLowerCase().endsWith(".csv")) {
    contentType = "text/csv";
  }
  if (!contentType && file.name?.toLowerCase().endsWith(".pdf")) {
    contentType = "application/pdf";
  }
  if (!FI_EXPENSE_DOCUMENT_ALLOWED_MIME.has(contentType)) {
    return {
      ok: false,
      error: "File must be JPEG, PNG, WEBP, HEIC, PDF, or CSV.",
    };
  }
  return { ok: true, contentType };
}

export function buildExpenseDocumentStoragePath(input: {
  tenantId: string;
  expenseId?: string | null;
  importId?: string | null;
  documentId: string;
  originalFilename: string;
  contentType: string;
}): string {
  const tid = input.tenantId.trim();
  const base = input.originalFilename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "document";
  const ext =
    MIME_EXT[input.contentType] ?? (base.includes(".") ? base.split(".").pop() : null) ?? "bin";
  const safe = base.replace(/\.[^.]+$/, "") || "document";
  const folder = input.expenseId?.trim()
    ? `expenses/${input.expenseId.trim()}`
    : input.importId?.trim()
      ? `imports/${input.importId.trim()}`
      : "inbox";
  return `${tid}/${folder}/${input.documentId}/${safe}.${ext}`;
}

export const EXPENSE_RECEIPT_UPLOAD_FIELDS = {
  tenantId: "tenantId",
  adminKey: "adminKey",
  file: "file",
  docKind: "doc_kind",
  expenseId: "expense_id",
  createDraftExpense: "create_draft_expense",
} as const;

export type ExpenseReceiptUploadFields =
  | {
      ok: true;
      tenantId: string;
      adminKey: string | null;
      file: File;
      contentType: string;
      docKind: "receipt" | "invoice" | "other";
      expenseId: string | null;
      createDraftExpense: boolean;
    }
  | { ok: false; error: string };

export function readExpenseReceiptUploadFormData(formData: FormData): ExpenseReceiptUploadFields {
  const tenantId = String(formData.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.tenantId) ?? "").trim();
  if (!tenantId) return { ok: false, error: "tenantId is required." };

  const adminRaw = formData.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.adminKey);
  const adminKey = typeof adminRaw === "string" && adminRaw.trim() ? adminRaw.trim() : null;

  const file = formData.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.file);
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };

  const allowed = assertAllowedExpenseDocumentFile(file);
  if (!allowed.ok) return allowed;

  const docKindRaw = String(formData.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.docKind) ?? "receipt")
    .trim()
    .toLowerCase();
  const docKind = docKindRaw === "invoice" || docKindRaw === "other" ? docKindRaw : "receipt";

  const expenseIdRaw = String(formData.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.expenseId) ?? "").trim();
  const expenseId = expenseIdRaw || null;

  const createDraft =
    String(formData.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.createDraftExpense) ?? "")
      .trim()
      .toLowerCase() === "true" ||
    String(formData.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.createDraftExpense) ?? "") === "1";

  return {
    ok: true,
    tenantId,
    adminKey,
    file,
    contentType: allowed.contentType,
    docKind,
    expenseId,
    createDraftExpense: createDraft && !expenseId,
  };
}
