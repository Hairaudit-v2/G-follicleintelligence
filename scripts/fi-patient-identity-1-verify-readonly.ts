/**
 * READ-ONLY FI-PATIENT-IDENTITY-1 production verification.
 * Emits hashed/redacted evidence only — no PHI.
 *
 * Usage:
 *   node scripts/run-with-system-ca.mjs tsx scripts/fi-patient-identity-1-verify-readonly.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { searchCanonicalPatients } from "../src/lib/patients/canonicalPatientSearch.server";
import { isSmokeOrTestPatientIdentity } from "../src/lib/patients/patientSmokeIdentity";
import { resolvePatientProfile } from "../src/lib/patients/resolvePatientProfile.server";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const EVOLVED_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
/** Known foundation patient (may itself be a smoke fixture — checked below). */
const DOCUMENTED_GOLDEN_PATIENT_ID = "287348d5-18bd-4434-9bab-7caafacbfe86";
/** SMOKETEST-TMRW-DEPOSIT-DUE from prior audits (may no longer exist). */
const SMOKE_DEPOSIT_PATIENT_ID = "c938b486-a217-485f-bb50-f79e585be730";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function redactId(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 12);
}

async function findNonSmokePatientId(tenantId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(40);
  if (error) throw new Error(error.message);
  const personIds = Array.from(
    new Set((data ?? []).map((r) => String((r as { person_id: string }).person_id)))
  );
  const { data: persons, error: pe } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", personIds);
  if (pe) throw new Error(pe.message);
  const personMeta = new Map<string, unknown>();
  for (const row of persons ?? []) {
    personMeta.set(String((row as { id: string }).id), (row as { metadata: unknown }).metadata);
  }
  for (const row of data ?? []) {
    const r = row as { id: string; person_id: string; metadata: unknown };
    if (
      isSmokeOrTestPatientIdentity({
        patientMetadata: r.metadata,
        personMetadata: personMeta.get(r.person_id),
      })
    ) {
      continue;
    }
    return r.id;
  }
  return null;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const supabase = supabaseAdmin();
  const tid = EVOLVED_TENANT_ID;

  const nonSmokePatientId = await findNonSmokePatientId(tid);
  if (!nonSmokePatientId) {
    console.error("No non-smoke patient found for verification.");
    process.exitCode = 1;
    return;
  }

  const [documentedGoldenCount, smokeCount] = await Promise.all([
    supabase
      .from("fi_patients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("id", DOCUMENTED_GOLDEN_PATIENT_ID),
    supabase
      .from("fi_patients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("id", SMOKE_DEPOSIT_PATIENT_ID),
  ]);

  const targetResolve = await resolvePatientProfile({
    tenantId: tid,
    patientId: nonSmokePatientId,
  });
  const invalidResolve = await resolvePatientProfile({
    tenantId: tid,
    patientId: "00000000-0000-4000-8000-000000000000",
  });
  const personAsPatient = await resolvePatientProfile({
    tenantId: tid,
    patientId:
      targetResolve.ok && targetResolve.data.personId
        ? targetResolve.data.personId
        : "99999999-9999-4999-8999-999999999999",
  });

  const smokeSearch = await searchCanonicalPatients({
    tenantId: tid,
    query: "SMOKETEST-TMRW",
    limit: 10,
    excludeSmokeOrTest: true,
  });
  const byIdSearch = await searchCanonicalPatients({
    tenantId: tid,
    query: nonSmokePatientId,
    limit: 5,
    excludeSmokeOrTest: true,
  });

  const evidence = {
    milestone: "FI-PATIENT-IDENTITY-1",
    mode: "read_only",
    tenantHash: redactId(tid),
    counts: {
      documentedGoldenExists: (documentedGoldenCount.count ?? 0) === 1,
      smokeDepositPatientExists: (smokeCount.count ?? 0) === 1,
      nonSmokePatientSelected: true,
    },
    resolve: {
      targetOk: targetResolve.ok,
      targetPatientHash: targetResolve.ok ? redactId(targetResolve.data.patientId) : null,
      targetPersonHash: targetResolve.ok ? redactId(targetResolve.data.personId) : null,
      invalidError: invalidResolve.ok ? null : invalidResolve.error,
      personIdAsPatientError: personAsPatient.ok ? null : personAsPatient.error,
    },
    search: {
      smokeQueryHitCount: smokeSearch.length,
      smokeDepositExcluded: !smokeSearch.some((h) => h.patientId === SMOKE_DEPOSIT_PATIENT_ID),
      targetByIdHitCount: byIdSearch.length,
      targetByIdExact: byIdSearch.length === 1 && byIdSearch[0]?.patientId === nonSmokePatientId,
      targetHrefMatchesCanonical:
        byIdSearch[0]?.profileHref === `/fi-admin/${tid}/patients/${nonSmokePatientId}`,
    },
  };

  console.log(JSON.stringify(evidence, null, 2));

  const pass =
    evidence.resolve.targetOk &&
    evidence.resolve.invalidError === "patient_not_found" &&
    evidence.resolve.personIdAsPatientError === "patient_not_found" &&
    evidence.search.smokeQueryHitCount === 0 &&
    evidence.search.targetByIdExact &&
    evidence.search.targetHrefMatchesCanonical;

  if (!pass) {
    console.error("FI-PATIENT-IDENTITY-1 read-only verification FAILED");
    process.exitCode = 1;
    return;
  }
  console.log("FI-PATIENT-IDENTITY-1 read-only verification PASS");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
