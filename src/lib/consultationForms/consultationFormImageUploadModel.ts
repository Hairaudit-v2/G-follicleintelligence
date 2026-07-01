/** ConsultationOS `image_upload` field value shape (persisted in form instance JSON). */

export type ConsultationImageUploadEntry = {
  image_id: string;
  filename: string;
  uploaded_at: string;
};

export type ConsultationImageUploadFieldValue = {
  image_ids: string[];
  uploads?: ConsultationImageUploadEntry[];
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeConsultationImageUploadValue(
  value: unknown
): ConsultationImageUploadFieldValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { image_ids: [], uploads: [] };
  }
  const o = value as Record<string, unknown>;
  const imageIds = Array.isArray(o.image_ids)
    ? o.image_ids.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const uploads = Array.isArray(o.uploads)
    ? o.uploads.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        const imageId = typeof row.image_id === "string" ? row.image_id.trim() : "";
        if (!imageId) return [];
        return [
          {
            image_id: imageId,
            filename:
              typeof row.filename === "string" && row.filename.trim()
                ? row.filename.trim()
                : "image",
            uploaded_at:
              typeof row.uploaded_at === "string" && row.uploaded_at.trim()
                ? row.uploaded_at.trim()
                : nowIso(),
          },
        ];
      })
    : [];
  return { image_ids: imageIds, uploads };
}