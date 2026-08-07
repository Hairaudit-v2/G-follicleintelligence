/**
 * FI-DEMO-DAY-2A.4 — Workforce-on-procedure-date loader for Health record overview.
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import {
  composeOverviewWorkforce,
  type WorkforceAssignmentRow,
} from "./patientTwinWorkforceCore";
import type { OverviewWorkforceSection } from "./patientTwinOverviewTypes";

function metaBool(meta: Record<string, unknown> | null | undefined, key: string): boolean | null {
  if (!meta || !(key in meta)) return null;
  const v = meta[key];
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return null;
}

export async function loadPatientTwinWorkforceOnDate(input: {
  tenantId: string;
  caseId: string | null;
  procedureDate: string | null;
}): Promise<{
  section: OverviewWorkforceSection;
  members: WorkforceAssignmentRow[];
}> {
  const tid = input.tenantId.trim();
  const caseId = input.caseId?.trim() || null;
  if (!caseId) {
    const section = composeOverviewWorkforce({
      members: [],
      procedureDate: input.procedureDate,
    });
    return { section, members: [] };
  }

  const supabase = supabaseAdmin();

  const { data: surgeries, error: surgeryError } = await supabase
    .from("fi_surgeries")
    .select("id")
    .eq("tenant_id", tid)
    .eq("case_id", caseId)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (surgeryError) {
    if (isSupabaseMissingRelationError(surgeryError)) {
      return {
        section: composeOverviewWorkforce({ members: [], procedureDate: input.procedureDate }),
        members: [],
      };
    }
    throw new Error(surgeryError.message);
  }

  const surgeryIds = (surgeries ?? [])
    .map((s) => String((s as { id?: string }).id ?? "").trim())
    .filter(Boolean);

  if (surgeryIds.length === 0) {
    return {
      section: composeOverviewWorkforce({ members: [], procedureDate: input.procedureDate }),
      members: [],
    };
  }

  const { data: assignments, error: assignError } = await supabase
    .from("fi_surgery_team_assignments")
    .select("role, assignment_status, fi_user_id, metadata")
    .eq("tenant_id", tid)
    .in("surgery_id", surgeryIds)
    .limit(50);

  if (assignError) {
    if (isSupabaseMissingRelationError(assignError)) {
      return {
        section: composeOverviewWorkforce({ members: [], procedureDate: input.procedureDate }),
        members: [],
      };
    }
    throw new Error(assignError.message);
  }

  const userIds = Array.from(
    new Set(
      (assignments ?? [])
        .map((a) => String((a as { fi_user_id?: string }).fi_user_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const nameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: staffRows, error: staffError } = await supabase
      .from("fi_staff")
      .select("fi_user_id, full_name, email")
      .eq("tenant_id", tid)
      .in("fi_user_id", userIds);
    if (staffError && !isSupabaseMissingRelationError(staffError)) {
      throw new Error(staffError.message);
    }
    for (const s of staffRows ?? []) {
      const row = s as {
        fi_user_id?: string | null;
        full_name?: string | null;
        email?: string | null;
      };
      const id = String(row.fi_user_id ?? "").trim();
      if (!id) continue;
      const name = row.full_name?.trim() || row.email?.trim() || "Staff member";
      nameByUserId.set(id, name);
    }

    // Fall back to fi_users.email when staff row is missing.
    const missing = userIds.filter((id) => !nameByUserId.has(id));
    if (missing.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("fi_users")
        .select("id, email")
        .eq("tenant_id", tid)
        .in("id", missing);
      if (usersError && !isSupabaseMissingRelationError(usersError)) {
        throw new Error(usersError.message);
      }
      for (const u of users ?? []) {
        const row = u as { id?: string; email?: string | null };
        const id = String(row.id ?? "").trim();
        if (!id) continue;
        nameByUserId.set(id, row.email?.trim() || "Staff member");
      }
    }
  }

  const members: WorkforceAssignmentRow[] = (assignments ?? []).map((a) => {
    const row = a as {
      role?: string;
      assignment_status?: string | null;
      fi_user_id?: string | null;
      metadata?: Record<string, unknown> | null;
    };
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {};
    const uid = String(row.fi_user_id ?? "").trim();
    return {
      role: String(row.role ?? "role"),
      displayName: nameByUserId.get(uid) ?? null,
      assignmentStatus: row.assignment_status ?? null,
      competencyValidOnProcedureDate: metaBool(meta, "competency_valid_on_procedure_date"),
      competencyLabel:
        typeof meta.competency_label === "string" ? meta.competency_label : null,
    };
  });

  const section = composeOverviewWorkforce({
    members,
    procedureDate: input.procedureDate,
  });
  return { section, members };
}

export { composeOverviewWorkforce } from "./patientTwinWorkforceCore";
