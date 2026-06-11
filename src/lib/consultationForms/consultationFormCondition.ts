import type { ConsultationFormCondition } from "./consultationFormTypes";

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/**
 * Evaluates conditional display for a field given current form values (flat fieldId → value).
 */
export function evaluateConsultationFormCondition(
  condition: ConsultationFormCondition | undefined,
  values: Record<string, unknown>
): boolean {
  if (!condition) return true;
  const cur = values[condition.fieldId];
  const empty = isEmptyValue(cur);

  switch (condition.operator) {
    case "isEmpty":
      return empty;
    case "isNotEmpty":
      return !empty;
    case "equals":
      return cur === condition.value;
    case "notEquals":
      return cur !== condition.value;
    case "in": {
      const arr = Array.isArray(condition.value) ? condition.value : [];
      return arr.some((x) => x === cur);
    }
    case "notIn": {
      const arr = Array.isArray(condition.value) ? condition.value : [];
      return !arr.some((x) => x === cur);
    }
    case "containsAny": {
      const wanted = Array.isArray(condition.value) ? condition.value.map(String) : [];
      if (!Array.isArray(cur)) return false;
      const curStr = cur.map((x) => String(x));
      return wanted.some((w) => curStr.includes(w));
    }
    default:
      return true;
  }
}
