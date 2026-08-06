import {
  resolveCanonicalServiceRole,
  type CanonicalServiceRoleId,
} from "@/src/lib/services/setup/canonicalServiceRoles";

export type LegacyRoleMigrationResult = {
  canonicalRoles: CanonicalServiceRoleId[];
  unknownLegacyRoles: string[];
  /** Original tokens after split/trim (for audit). */
  sourceTokens: string[];
};

/**
 * Migrate comma-separated (or array) legacy role values into canonical selections.
 * Unknown values are preserved for admin review — never silently discarded.
 */
export function migrateLegacyServiceRoles(
  input: string | string[] | null | undefined
): LegacyRoleMigrationResult {
  const tokens =
    typeof input === "string"
      ? input.split(",")
      : Array.isArray(input)
        ? input
        : [];

  const sourceTokens = tokens
    .map((t) => String(t ?? "").trim())
    .filter(Boolean);

  const canonicalRoles: CanonicalServiceRoleId[] = [];
  const seenCanonical = new Set<string>();
  const unknownLegacyRoles: string[] = [];
  const seenUnknown = new Set<string>();

  for (const token of sourceTokens) {
    const resolved = resolveCanonicalServiceRole(token);
    if (resolved) {
      if (!seenCanonical.has(resolved)) {
        seenCanonical.add(resolved);
        canonicalRoles.push(resolved);
      }
      continue;
    }
    const key = token.toLowerCase();
    if (!seenUnknown.has(key)) {
      seenUnknown.add(key);
      unknownLegacyRoles.push(token);
    }
  }

  return { canonicalRoles, unknownLegacyRoles, sourceTokens };
}

/** Split UI free-text the same way the old editor saved roles. */
export function splitCommaSeparatedRoles(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
