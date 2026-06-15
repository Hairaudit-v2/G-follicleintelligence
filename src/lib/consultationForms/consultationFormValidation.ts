import { bodyAreaMapHasAnnotations } from "./bodyAreaMapModel";
import { evaluateConsultationFormCondition } from "./consultationFormCondition";
import {
  getClinicalNoteText,
  getVoiceNoteTranscript,
  isValidClinicalNoteValueShape,
  isValidVoiceNoteValueShape,
} from "./consultationFormNoteModel";
import type { ConsultationFormField, ConsultationFormSchema } from "./consultationFormTypes";

function isEmptyForRequired(v: unknown, field: ConsultationFormField): boolean {
  if (v === null || v === undefined) return true;
  if (field.type === "body_area_map" && field.required) {
    return !bodyAreaMapHasAnnotations(v, field.bodyAreaMapViews);
  }
  if (field.type === "voice_note" && field.required) {
    return getVoiceNoteTranscript(v).trim() === "";
  }
  if (field.type === "clinical_note" && field.required) {
    return getClinicalNoteText(v).trim() === "";
  }
  if (typeof v === "boolean") return false;
  if (typeof v === "number") return Number.isNaN(v);
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (field.type === "body_area_map" && !field.required) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return Object.keys(v as object).length === 0;
    }
  }
  if ((field.type === "voice_note" || field.type === "clinical_note") && !field.required) {
    if (field.type === "voice_note") return getVoiceNoteTranscript(v).trim() === "";
    return getClinicalNoteText(v).trim() === "";
  }
  return false;
}

export type ConsultationFormValidationIssue = {
  fieldId: string;
  label: string;
  message: string;
};

/**
 * True when a body_area_map value is acceptable for submit: object (or null), and if `annotations`
 * is present it must be an array. Missing `annotations` is treated as valid (normalized to [] on read).
 */
export function isValidBodyAreaMapJsonShape(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (!("annotations" in o)) return true;
  return Array.isArray(o.annotations);
}

export function validateConsultationFormRequiredFields(
  schema: ConsultationFormSchema,
  values: Record<string, unknown>
): ConsultationFormValidationIssue[] {
  const issues: ConsultationFormValidationIssue[] = [];

  for (const section of schema.sections) {
    if (!evaluateConsultationFormCondition(section.showWhen, values)) continue;
    for (const field of section.fields) {
      if (!field.required) continue;
      if (!evaluateConsultationFormCondition(field.showWhen, values)) continue;

      const v = values[field.id];
      if (isEmptyForRequired(v, field)) {
        issues.push({
          fieldId: field.id,
          label: field.label,
          message: `${field.label} is required.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Optional strict check: every body_area_map field value must include an `annotations` array key.
 */
export function validateBodyAreaMapShapesInValues(
  schema: ConsultationFormSchema,
  values: Record<string, unknown>
): ConsultationFormValidationIssue[] {
  const issues: ConsultationFormValidationIssue[] = [];
  for (const section of schema.sections) {
    if (!evaluateConsultationFormCondition(section.showWhen, values)) continue;
    for (const field of section.fields) {
      if (field.type !== "body_area_map") continue;
      const v = values[field.id];
      if (v === null || v === undefined) continue;
      if (!isValidBodyAreaMapJsonShape(v)) {
        issues.push({
          fieldId: field.id,
          label: field.label,
          message: `${field.label}: invalid body area map (annotations must be an array when present).`,
        });
      }
    }
  }
  return issues;
}

export function validateVoiceNoteClinicalNoteShapesInValues(
  schema: ConsultationFormSchema,
  values: Record<string, unknown>
): ConsultationFormValidationIssue[] {
  const issues: ConsultationFormValidationIssue[] = [];
  for (const section of schema.sections) {
    if (!evaluateConsultationFormCondition(section.showWhen, values)) continue;
    for (const field of section.fields) {
      const v = values[field.id];
      if (v === null || v === undefined) continue;
      if (field.type === "voice_note" && !isValidVoiceNoteValueShape(v)) {
        issues.push({
          fieldId: field.id,
          label: field.label,
          message: `${field.label}: invalid voice note value (expected transcript string).`,
        });
      }
      if (field.type === "clinical_note" && !isValidClinicalNoteValueShape(v)) {
        issues.push({
          fieldId: field.id,
          label: field.label,
          message: `${field.label}: invalid clinical note value (expected note string).`,
        });
      }
    }
  }
  return issues;
}
