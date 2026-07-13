/**
 * FI-PIPELINE-MORE-LIVE-DIAGNOSTIC — PHI-safe More menu trace (window.__moreLog).
 * Enable with NEXT_PUBLIC_FI_PIPELINE_MORE_DIAG=1 on the deployed build.
 */

export type PipelineMoreLogEntry = {
  ts: number;
  event: string;
  instance?: string;
  cardIndex?: number;
  open?: boolean;
  loadTier?: "shell" | "full";
  dismissalReason?: string;
  detail?: string;
};

declare global {
  interface Window {
    __moreLog?: PipelineMoreLogEntry[];
  }
}

export function isPipelineMoreDiagnosticEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NEXT_PUBLIC_FI_PIPELINE_MORE_DIAG === "1";
}

export function moreLog(
  event: string,
  fields?: Omit<PipelineMoreLogEntry, "ts" | "event">
): void {
  if (!isPipelineMoreDiagnosticEnabled()) return;
  const entry: PipelineMoreLogEntry = {
    ts: Date.now(),
    event,
    ...fields,
  };
  if (!window.__moreLog) window.__moreLog = [];
  window.__moreLog.push(entry);
  console.info("[pipeline-more]", event, fields ?? "");
}