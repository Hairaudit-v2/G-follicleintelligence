/**
 * Shared types for pipeline stages.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type StageContext = {
  tenantId: string;
  caseId: string;
  modelRunId: string;
  supabase: SupabaseClient;
  updateStage: (stage: string) => Promise<void>;
};

export type StageResult<T> = { ok: true; data: T } | { ok: false; error: string };
