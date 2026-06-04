import type { EditableClinicalDetailKey, EditableClinicalDetailsPayload } from "./clinicalDetailsPolicy";
import { EDITABLE_CLINICAL_DETAIL_KEYS } from "./clinicalDetailsPolicy";

function stableJsonStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

function textEq(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

function jsonObjEq(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return stableJsonStringify(a) === stableJsonStringify(b);
}

/**
 * Returns which editable keys differ between two normalized payloads (for safe activity metadata only).
 */
export function clinicalDetailsChangedKeys(
  before: EditableClinicalDetailsPayload,
  after: EditableClinicalDetailsPayload
): EditableClinicalDetailKey[] {
  const changed: EditableClinicalDetailKey[] = [];
  for (const key of EDITABLE_CLINICAL_DETAIL_KEYS) {
    if (key === "clinical_flags" || key === "metadata") {
      const a = before[key];
      const b = after[key];
      if (!jsonObjEq(a, b)) changed.push(key);
    } else if (!textEq(before[key], after[key])) {
      changed.push(key);
    }
  }
  return changed;
}
