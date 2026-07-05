/**
 * SurgeryOS Phase 2 — pure graft count model, reconciliation, and alert derivation.
 *
 * @deprecated Compatibility barrel. Import from the focused modules instead:
 * - `@/src/lib/surgeryOs/surgeryOsGraftCounting` — vocabulary, counting math, validation
 * - `@/src/lib/surgeryOs/surgeryOsGraftSessionLocks` — theatre-tablet session locks
 * - `@/src/lib/surgeryOs/surgeryOsGraftReconciliation` — tray review + reconciliation gate
 * - `@/src/lib/surgeryOs/surgeryOsGraftAlerts` — alert thresholds and derivation
 * - `@/src/lib/surgeryOs/surgeryOsGraftSummary` — end-of-surgery export assembly
 */

export * from "./surgeryOsGraftCounting";
export * from "./surgeryOsGraftSessionLocks";
export * from "./surgeryOsGraftReconciliation";
export * from "./surgeryOsGraftAlerts";
export * from "./surgeryOsGraftSummary";
