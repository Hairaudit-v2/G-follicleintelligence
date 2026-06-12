import {
  FI_AI_HAIR_STATES,
  FI_AI_IMAGE_CATEGORIES,
  FI_AI_IMAGE_REVIEW_STATUSES,
  FI_AI_SHAVE_STATES,
  FI_AI_SURGERY_STAGES,
  HLI_CLINICAL_USE_CONTEXTS,
  HLI_SOURCE_SYSTEMS,
  type FiAiHairState,
  type FiAiImageCategory,
  type FiAiImageReviewStatus,
  type FiAiShaveState,
  type FiAiSurgeryStage,
  type HliClinicalUseContext,
  type HliSourceSystem,
} from "./types";

const CAT = new Set<string>(FI_AI_IMAGE_CATEGORIES);
const HAIR = new Set<string>(FI_AI_HAIR_STATES);
const SHAVE = new Set<string>(FI_AI_SHAVE_STATES);
const SURG = new Set<string>(FI_AI_SURGERY_STAGES);
const REV = new Set<string>(FI_AI_IMAGE_REVIEW_STATUSES);
const CTX = new Set<string>(HLI_CLINICAL_USE_CONTEXTS);
const SRC = new Set<string>(HLI_SOURCE_SYSTEMS);

export function isFiAiImageCategory(v: unknown): v is FiAiImageCategory {
  return typeof v === "string" && CAT.has(v);
}

export function normalizeFiAiImageCategory(v: unknown): FiAiImageCategory {
  return isFiAiImageCategory(v) ? v : "unknown";
}

export function isFiAiHairState(v: unknown): v is FiAiHairState {
  return typeof v === "string" && HAIR.has(v);
}

export function normalizeFiAiHairState(v: unknown): FiAiHairState {
  return isFiAiHairState(v) ? v : "unknown";
}

export function isFiAiShaveState(v: unknown): v is FiAiShaveState {
  return typeof v === "string" && SHAVE.has(v);
}

export function normalizeFiAiShaveState(v: unknown): FiAiShaveState {
  return isFiAiShaveState(v) ? v : "unknown";
}

export function isFiAiSurgeryStage(v: unknown): v is FiAiSurgeryStage {
  return typeof v === "string" && SURG.has(v);
}

export function normalizeFiAiSurgeryStage(v: unknown): FiAiSurgeryStage {
  return isFiAiSurgeryStage(v) ? v : "unknown";
}

export function isFiAiImageReviewStatus(v: unknown): v is FiAiImageReviewStatus {
  return typeof v === "string" && REV.has(v);
}

export function normalizeFiAiImageReviewStatus(v: unknown): FiAiImageReviewStatus {
  return isFiAiImageReviewStatus(v) ? v : "pending";
}

export function isHliClinicalUseContext(v: unknown): v is HliClinicalUseContext {
  return typeof v === "string" && CTX.has(v);
}

export function normalizeHliClinicalUseContext(v: unknown): HliClinicalUseContext {
  return isHliClinicalUseContext(v) ? v : "unknown";
}

export function isHliSourceSystem(v: unknown): v is HliSourceSystem {
  return typeof v === "string" && SRC.has(v);
}

export function clampConfidence(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
