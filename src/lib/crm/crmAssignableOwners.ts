/**
 * FI-PIPELINE — canonical CRM lead-owner options (pure).
 *
 * Staff-first, name-first, seed-free. Shared by loaders and mutation validation.
 */

import { CRM_MUTATION_ROLES_LOWER } from "@/src/lib/crm/crmGatePolicy";
import {
  isCrmAssigneeEligible,
  type CrmAssigneeStaffSignal,
} from "@/src/lib/crm/crmAssigneeEligibility";

// ---------------------------------------------------------------------------
// Option contract
// ---------------------------------------------------------------------------

export type CrmOwnerOption = {
  /** fi_users.id — required for primary_owner_user_id writes */
  userId: string;
  staffId?: string | null;
  /** Primary visible label (never a full personal email when a name exists) */
  displayName: string;
  /** Secondary line e.g. work email · role */
  secondaryLabel?: string | null;
  roleLabel?: string | null;
  email?: string | null;
  isAssignable: boolean;
  isCurrentHistoricalOwner?: boolean;
};

/** Backward-compatible shell picker row (maps onto existing UI). */
export type CrmShellOwnerPickerRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  staff_role?: string | null;
  role?: string | null;
  fi_user_id?: string | null;
  is_active?: boolean;
};

// ---------------------------------------------------------------------------
// Input rows (structural — no DB coupling)
// ---------------------------------------------------------------------------

export type CrmAssignableStaffInput = {
  staffId: string;
  fullName: string | null;
  staffRole: string | null;
  workEmail: string | null;
  fiUserId: string | null;
  isActive: boolean;
  employmentStatus?: string | null;
  archivedAt?: string | null;
};

export type CrmAssignableUserInput = {
  userId: string;
  email: string | null;
  role: string | null;
  /** Optional person/display name from user metadata if ever available */
  displayName?: string | null;
};

// ---------------------------------------------------------------------------
// System / seed identity (structural + anchored patterns)
// ---------------------------------------------------------------------------

/**
 * Deterministic exclusion of seed/system/automation identities.
 * Anchored on known seed conventions and account markers — not bare "test" substrings
 * (avoids excluding legitimate people named Test…).
 */
export function isSystemOrSeedIdentity(input: {
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  staffRole?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const meta = input.metadata ?? null;
  if (meta) {
    if (meta.is_seed === true || meta.is_test === true || meta.is_system === true) return true;
    if (
      meta.account_type === "seed" ||
      meta.account_type === "system" ||
      meta.account_type === "service"
    ) {
      return true;
    }
    const src = String(meta.source ?? meta.seed_source ?? "")
      .trim()
      .toLowerCase();
    if (src === "seed" || src === "crm_seed" || src === "smoketest" || src === "system")
      return true;
  }

  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  const local = email.includes("@") ? email.split("@")[0]! : email;
  const domain = email.includes("@") ? email.split("@")[1]! : "";
  const name = String(input.fullName ?? "")
    .trim()
    .toLowerCase();
  const role = String(input.role ?? "")
    .trim()
    .toLowerCase();
  const staffRole = String(input.staffRole ?? "")
    .trim()
    .toLowerCase();

  // Known Evolved CRM seed accounts (exact local-part prefixes)
  if (/^evolved\.crm\.seed\d*$/.test(local)) return true;
  if (/^crm\.seed\d*$/.test(local)) return true;
  if (/^seed[0-9]+$/.test(local)) return true;
  if (local === "seed" || local === "seed1" || local === "seed2" || local === "seed3") return true;

  // Smoke / automation locals (anchored)
  if (/^smoketest([+._-].*)?$/.test(local)) return true;
  if (/^smoke[-_]?test([+._-].*)?$/.test(local)) return true;
  if (/^smoke\+[a-z0-9._-]+$/.test(local)) return true;
  if (local.startsWith("noreply") || local.startsWith("no-reply")) return true;
  if (local === "system" || local === "automation" || local === "service") return true;
  if (
    local.startsWith("system+") ||
    local.startsWith("service+") ||
    local.startsWith("automation+")
  ) {
    return true;
  }

  // Disposable / placeholder domains only
  if (
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net" ||
    domain.endsWith(".test") ||
    domain === "localhost"
  ) {
    return true;
  }

  // Display-name seed markers
  if (/^evolved\.crm\.seed\d*$/i.test(name)) return true;
  if (/^crm seed\s*\d*$/i.test(name)) return true;

  // Non-human roles
  if (role === "system" || role === "service" || role === "bot" || role === "automation")
    return true;
  if (staffRole === "system" || staffRole === "service" || staffRole === "bot") return true;

  return false;
}

// ---------------------------------------------------------------------------
// Display name
// ---------------------------------------------------------------------------

/**
 * Primary label precedence:
 * staff full name → user display name → email local-part (degraded) → "Team member"
 */
export function buildCrmOwnerDisplayName(input: {
  staffFullName?: string | null;
  userDisplayName?: string | null;
  email?: string | null;
}): { displayName: string; usedEmailFallback: boolean } {
  const staff = String(input.staffFullName ?? "").trim();
  if (staff) return { displayName: staff, usedEmailFallback: false };

  const user = String(input.userDisplayName ?? "").trim();
  if (user && !user.includes("@")) return { displayName: user, usedEmailFallback: false };

  const email = String(input.email ?? "").trim();
  if (email.includes("@")) {
    const local = email.split("@")[0]!.trim();
    if (local) return { displayName: local, usedEmailFallback: true };
  }
  if (email) return { displayName: email, usedEmailFallback: true };

  return { displayName: "Team member", usedEmailFallback: false };
}

export function buildCrmOwnerSecondaryLabel(input: {
  workEmail?: string | null;
  roleLabel?: string | null;
}): string | null {
  const parts: string[] = [];
  const email = String(input.workEmail ?? "").trim();
  // Prefer work-style secondary email; still ok to show work email as secondary
  if (email && email.includes("@")) parts.push(email);
  const role = String(input.roleLabel ?? "").trim();
  if (role) parts.push(role);
  return parts.length ? parts.join(" · ") : null;
}

function formatRoleLabel(role: string | null | undefined): string | null {
  const r = String(role ?? "").trim();
  if (!r) return null;
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Resolve assignable options (pure)
// ---------------------------------------------------------------------------

export type ResolveCrmAssignableOwnersResult = {
  options: CrmOwnerOption[];
  shellRows: CrmShellOwnerPickerRow[];
  diagnostics: {
    staffInputCount: number;
    userInputCount: number;
    eligibleCount: number;
    excludedSeedCount: number;
    excludedIneligibleCount: number;
    emailFallbackCount: number;
  };
};

/**
 * Staff-first owner options. One option per fi_userId.
 * Staff without fi_user_id cannot own leads (FK is fi_users.id) — skipped.
 * Staffless CRM mutation-role users may be included only when no staff rows exist for them.
 */
export function resolveCrmAssignableOwners(input: {
  staff: readonly CrmAssignableStaffInput[];
  users: readonly CrmAssignableUserInput[];
}): ResolveCrmAssignableOwnersResult {
  const usersById = new Map(input.users.map((u) => [u.userId.trim(), u]));
  const staffByUserId = new Map<string, CrmAssignableStaffInput[]>();

  for (const s of input.staff) {
    const uid = s.fiUserId?.trim();
    if (!uid) continue;
    const list = staffByUserId.get(uid) ?? [];
    list.push(s);
    staffByUserId.set(uid, list);
  }

  let excludedSeedCount = 0;
  let excludedIneligibleCount = 0;
  let emailFallbackCount = 0;

  const options: CrmOwnerOption[] = [];
  const seenUsers = new Set<string>();

  // 1) Staff-first: one option per fi_user with ≥1 eligible staff row
  for (const [userId, rows] of staffByUserId) {
    seenUsers.add(userId);
    const user = usersById.get(userId);
    const signals: CrmAssigneeStaffSignal[] = rows.map((r) => ({
      isActive: r.isActive,
      employmentStatus: r.employmentStatus ?? null,
      archivedAt: r.archivedAt ?? null,
    }));

    // Prefer best active row for labels
    const labelRow = rows.find((r) => r.isActive && !r.archivedAt) ?? rows[0]!;

    if (
      isSystemOrSeedIdentity({
        email: labelRow.workEmail ?? user?.email,
        fullName: labelRow.fullName,
        role: user?.role,
        staffRole: labelRow.staffRole,
      })
    ) {
      excludedSeedCount += 1;
      continue;
    }

    const eligible = isCrmAssigneeEligible({
      fiUserId: userId,
      role: user?.role ?? null,
      email: labelRow.workEmail ?? user?.email ?? null,
      staffRows: signals,
    });
    if (!eligible) {
      excludedIneligibleCount += 1;
      continue;
    }

    const { displayName, usedEmailFallback } = buildCrmOwnerDisplayName({
      staffFullName: labelRow.fullName,
      userDisplayName: user?.displayName,
      email: labelRow.workEmail ?? user?.email,
    });
    if (usedEmailFallback) emailFallbackCount += 1;

    const roleLabel = formatRoleLabel(labelRow.staffRole ?? user?.role);
    const secondaryLabel = buildCrmOwnerSecondaryLabel({
      workEmail: labelRow.workEmail ?? user?.email,
      roleLabel,
    });

    options.push({
      userId,
      staffId: labelRow.staffId,
      displayName,
      secondaryLabel,
      roleLabel,
      email: labelRow.workEmail ?? user?.email ?? null,
      isAssignable: true,
    });
  }

  // 2) Staffless CRM operators only (narrow)
  for (const user of input.users) {
    const userId = user.userId.trim();
    if (!userId || seenUsers.has(userId)) continue;
    if (staffByUserId.has(userId)) continue;

    const role = String(user.role ?? "")
      .trim()
      .toLowerCase();
    if (!CRM_MUTATION_ROLES_LOWER.has(role)) {
      excludedIneligibleCount += 1;
      continue;
    }

    if (
      isSystemOrSeedIdentity({
        email: user.email,
        fullName: user.displayName,
        role: user.role,
      })
    ) {
      excludedSeedCount += 1;
      continue;
    }

    const eligible = isCrmAssigneeEligible({
      fiUserId: userId,
      role: user.role,
      email: user.email,
      staffRows: null,
    });
    if (!eligible) {
      excludedIneligibleCount += 1;
      continue;
    }

    const { displayName, usedEmailFallback } = buildCrmOwnerDisplayName({
      userDisplayName: user.displayName,
      email: user.email,
    });
    if (usedEmailFallback) emailFallbackCount += 1;

    const roleLabel = formatRoleLabel(user.role);
    options.push({
      userId,
      staffId: null,
      displayName,
      secondaryLabel: buildCrmOwnerSecondaryLabel({
        workEmail: user.email,
        roleLabel,
      }),
      roleLabel,
      email: user.email,
      isAssignable: true,
    });
  }

  options.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const shellRows: CrmShellOwnerPickerRow[] = options.map((o) => ({
    id: o.userId,
    email: o.email ?? null,
    full_name: o.displayName,
    staff_role: o.roleLabel ?? null,
    role: null,
    is_active: true,
  }));

  return {
    options,
    shellRows,
    diagnostics: {
      staffInputCount: input.staff.length,
      userInputCount: input.users.length,
      eligibleCount: options.length,
      excludedSeedCount,
      excludedIneligibleCount,
      emailFallbackCount,
    },
  };
}

/**
 * Pure mutation check: same seed + eligibility rules as the picker.
 */
export function assertCrmOwnerAssignablePure(input: {
  userId: string;
  email?: string | null;
  role?: string | null;
  displayName?: string | null;
  staffRows?: readonly CrmAssigneeStaffSignal[] | null;
}): { ok: true } | { ok: false; reason: string } {
  if (
    isSystemOrSeedIdentity({
      email: input.email,
      fullName: input.displayName,
      role: input.role,
    })
  ) {
    return { ok: false, reason: "seed_or_system" };
  }
  const eligible = isCrmAssigneeEligible({
    fiUserId: input.userId,
    role: input.role,
    email: input.email,
    staffRows: input.staffRows ?? null,
  });
  if (!eligible) return { ok: false, reason: "ineligible" };
  return { ok: true };
}

/** Option label for native &lt;select&gt;: name first; email only as secondary. */
export function formatCrmOwnerOptionLabel(option: {
  full_name?: string | null;
  email?: string | null;
  staff_role?: string | null;
}): string {
  const name = String(option.full_name ?? "").trim();
  const email = String(option.email ?? "").trim();
  const role = String(option.staff_role ?? "").trim();
  if (name && !name.includes("@")) {
    const bits = [name];
    if (role) bits.push(role);
    else if (email && email.includes("@")) bits.push(email);
    return bits.join(" · ");
  }
  if (email.includes("@")) return email.split("@")[0]!;
  return email || "Team member";
}
