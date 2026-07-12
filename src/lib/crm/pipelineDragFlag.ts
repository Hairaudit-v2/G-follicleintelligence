/**
 * FI-PIPELINE-STABILITY-GATE — desktop drag kill-switch.
 *
 * Default OFF. Native HTML5 stage drag is optional; the core operational workflow
 * (More overflow actions, Move stage, Contact) must never depend on it. This flag
 * exists as a safety rollback: disable drag entirely while More is under diagnosis,
 * and only re-enable once More passes live staging.
 *
 * Env: `FI_PIPELINE_ENABLE_DESKTOP_DRAG=true` (also accepts `1`, `yes`, `on`).
 * Anything else — unset, empty, `false`, `0` — keeps drag disabled.
 *
 * Pure + test-safe: no `server-only`, no env read here (caller passes the raw value).
 */
export function parsePipelineDesktopDragEnabled(raw: string | undefined | null): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/** Resolve the desktop-drag feature flag from the environment (default OFF). */
export function isPipelineDesktopDragEnabledFromEnv(): boolean {
  return parsePipelineDesktopDragEnabled(process.env.FI_PIPELINE_ENABLE_DESKTOP_DRAG);
}
