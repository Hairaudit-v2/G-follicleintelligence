export const TENANT_BRANDING_BUCKET = "tenant-branding";
export const TENANT_LOGO_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function buildTenantLogoStoragePath(
  tenantId: string,
  originalFilename: string,
  contentType: string
): string {
  const tid = tenantId.trim();
  const base = originalFilename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "logo";
  const ext = MIME_EXT[contentType] ?? base.split(".").pop() ?? "png";
  const hashInput = `${tid}:${Date.now()}:${base}`;
  let hash = 0;
  for (let i = 0; i < hashInput.length; i += 1) {
    hash = (hash * 31 + hashInput.charCodeAt(i)) >>> 0;
  }
  const safeName = base.replace(/\.[^.]+$/, "");
  return `tenant-branding/${tid}/logo/${Date.now()}-${hash.toString(16).slice(0, 12)}-${safeName}.${ext}`;
}

export function assertAllowedTenantLogoFile(file: File): {
  ok: true;
  contentType: string;
} | {
  ok: false;
  error: string;
} {
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size <= 0) return { ok: false, error: "File is empty." };
  if (file.size > TENANT_LOGO_MAX_BYTES) {
    return {
      ok: false,
      error: `Logo must be ${TENANT_LOGO_MAX_BYTES / (1024 * 1024)}MB or smaller.`,
    };
  }
  const contentType = (file.type || "").trim().toLowerCase();
  if (!ALLOWED_LOGO_MIME.has(contentType)) {
    return {
      ok: false,
      error: "Logo must be PNG, JPG, WEBP, or SVG.",
    };
  }
  return { ok: true, contentType };
}
