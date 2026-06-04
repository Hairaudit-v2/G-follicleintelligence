import { isPatientImageMetadataObject } from "./patientImagePolicy";
import type { PatientImageCategory } from "./patientImageTypes";

export type PatientImageEditableSnapshot = {
  image_category: PatientImageCategory;
  caption: string | null;
  taken_at: string | null;
  metadata: Record<string, unknown>;
};

function stableStringifyMeta(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export function patientImageDetailChangedKeys(before: PatientImageEditableSnapshot, after: PatientImageEditableSnapshot): string[] {
  const keys: string[] = [];
  if (before.image_category !== after.image_category) keys.push("image_category");
  const bc = before.caption ?? null;
  const ac = after.caption ?? null;
  if (bc !== ac) keys.push("caption");
  const bt = before.taken_at ?? null;
  const at = after.taken_at ?? null;
  if (bt !== at) keys.push("taken_at");
  const bm = isPatientImageMetadataObject(before.metadata) ? before.metadata : {};
  const am = isPatientImageMetadataObject(after.metadata) ? after.metadata : {};
  if (stableStringifyMeta(bm) !== stableStringifyMeta(am)) keys.push("metadata");
  return keys;
}

export function patientImageArchiveChangedKeys(): string[] {
  return ["image_status", "archived_at", "archived_by_user_id", "archive_reason"];
}
