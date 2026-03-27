/**
 * Focused verification for canonical FI event ingestion.
 * Run: npx tsx scripts/verify-fi-event-ingestion.ts
 * Requires: dev server (npm run dev), Supabase env vars, and a tenant
 * (set FI_TENANT_ID or let the script use the first available tenant).
 */
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { maybeTriggerPipelineFromEvent } from "../lib/fi/events/trigger";

export {};

const BASE = process.env.FI_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const BUCKET = process.env.FI_STORAGE_BUCKET_INTAKES || "fi-intakes";

const MINIMAL_CSV = new Blob(["name,value\nTest,1"], { type: "text/csv" });
const MINIMAL_PNG = new Blob(
  [
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    ),
  ],
  { type: "image/png" }
);

type JsonRecord = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAppUnreachableMessage(baseUrl: string): string {
  return `Could not reach FI app at ${baseUrl}. Start the dev server with npm run dev or set FI_BASE_URL/BASE_URL to the correct host.`;
}

async function fetchFromApp(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, init);
  } catch (error: unknown) {
    const details =
      error instanceof Error && error.message
        ? `\nOriginal error: ${error.message}`
        : "";
    throw new Error(buildAppUnreachableMessage(BASE) + details);
  }
}

async function preflightAppReachability(): Promise<void> {
  try {
    const response = await fetchFromApp("/api/tenants");
    if (response.status >= 500) {
      throw new Error(
        `FI app responded from ${BASE}, but /api/tenants returned HTTP ${response.status}.`
      );
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Could not reach FI app at")) {
      throw error;
    }
    throw new Error(
      `${buildAppUnreachableMessage(BASE)}\nPreflight request: GET ${BASE}/api/tenants\nOriginal error: ${
        error instanceof Error ? error.message : "Unknown error."
      }`
    );
  }
}

async function api(path: string, init?: RequestInit): Promise<{ status: number; body: JsonRecord }> {
  const response = await fetchFromApp(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  return {
    status: response.status,
    body: (await response.json()) as JsonRecord,
  };
}

async function postEvent(event: JsonRecord): Promise<{ status: number; body: JsonRecord }> {
  return api("/api/fi/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

async function getTenantId(): Promise<string> {
  const tenantId = process.env.FI_TENANT_ID;
  if (tenantId) return tenantId;

  const { status, body } = await api("/api/tenants");
  assert(status === 200 && body.ok, "Failed to load tenants. Set FI_TENANT_ID if needed.");
  const tenants = Array.isArray(body.tenants) ? body.tenants : [];
  assert(tenants.length > 0, "No tenants found. Set FI_TENANT_ID or create a tenant.");

  const first = tenants[0];
  assert(first && typeof first === "object" && typeof first.id === "string", "Invalid tenant response.");
  return first.id;
}

async function uploadViaApi(params: {
  tenantId: string;
  caseId: string;
  type: string;
  blob: Blob;
  filename: string;
}): Promise<{ storagePath: string; uploadId: string }> {
  const form = new FormData();
  form.set("tenant_id", params.tenantId);
  form.set("case_id", params.caseId);
  form.set("type", params.type);
  form.append("files", params.blob, params.filename);

  const response = await fetchFromApp("/api/fi/uploads", {
    method: "POST",
    body: form,
  });
  const body = (await response.json()) as JsonRecord;
  assert(response.status === 200 && body.ok, `Upload failed: ${String(body.error ?? body.message ?? "unknown")}`);

  const { data } = await supabaseAdmin()
    .from("fi_uploads")
    .select("id, storage_path")
    .eq("tenant_id", params.tenantId)
    .eq("case_id", params.caseId)
    .eq("filename", params.filename)
    .eq("type", params.type)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  assert(data?.id && data?.storage_path, `Uploaded row not found for ${params.filename}.`);
  return {
    uploadId: data.id,
    storagePath: data.storage_path,
  };
}

async function seedStorageObject(params: {
  path: string;
  blob: Blob;
  contentType: string;
}): Promise<void> {
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(params.path, params.blob, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error) throw new Error(`Failed to seed storage object ${params.path}: ${error.message}`);
}

async function getEventRow(tenantId: string, sourceSystem: string, sourceEventId: string) {
  const { data } = await supabaseAdmin()
    .from("fi_events")
    .select("id, status, tenant_id, event_type, source_system, source_event_id, error_text")
    .eq("tenant_id", tenantId)
    .eq("source_system", sourceSystem)
    .eq("source_event_id", sourceEventId)
    .maybeSingle();

  return data;
}

async function countEvents(tenantId: string, sourceSystem: string, sourceEventId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("fi_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("source_system", sourceSystem)
    .eq("source_event_id", sourceEventId);

  return count ?? 0;
}

async function getGlobalPatient(tenantId: string, sourceSystem: string, sourcePatientId: string) {
  const { data } = await supabaseAdmin()
    .from("fi_global_patients")
    .select("id, source_patient_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", sourceSystem)
    .eq("source_patient_id", sourcePatientId)
    .maybeSingle();

  return data;
}

async function getGlobalCase(tenantId: string, sourceSystem: string, sourceCaseId: string) {
  const { data } = await supabaseAdmin()
    .from("fi_global_cases")
    .select("id, global_patient_id, fi_case_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", sourceSystem)
    .eq("source_case_id", sourceCaseId)
    .maybeSingle();

  return data;
}

async function countGlobalCases(tenantId: string, sourceSystem: string, sourceCaseId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("fi_global_cases")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("source_system", sourceSystem)
    .eq("source_case_id", sourceCaseId);

  return count ?? 0;
}

async function getFiCase(tenantId: string, externalId: string) {
  const { data } = await supabaseAdmin()
    .from("fi_cases")
    .select("id, external_id, status")
    .eq("tenant_id", tenantId)
    .eq("external_id", externalId)
    .maybeSingle();

  return data;
}

async function countFiCases(tenantId: string, externalId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("fi_cases")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("external_id", externalId);

  return count ?? 0;
}

async function getFiIntake(tenantId: string, caseId: string) {
  const { data } = await supabaseAdmin()
    .from("fi_intakes")
    .select("full_name, email, dob, sex, country, primary_concern, selections, notes")
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId)
    .maybeSingle();

  return data;
}

async function getEventLink(eventId: string) {
  const { data } = await supabaseAdmin()
    .from("fi_event_links")
    .select("event_id, fi_case_id, global_case_id, global_patient_id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function countUploadsByStoragePath(tenantId: string, caseId: string, storagePath: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("fi_uploads")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId)
    .eq("storage_path", storagePath);

  return count ?? 0;
}

async function getUploadsByPaths(tenantId: string, caseId: string, storagePaths: string[]) {
  const { data } = await supabaseAdmin()
    .from("fi_uploads")
    .select("id, type, storage_path")
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId)
    .in("storage_path", storagePaths);

  return data ?? [];
}

async function countModelRuns(tenantId: string, caseId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("fi_model_runs")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId);

  return count ?? 0;
}

async function insertModelRun(tenantId: string, caseId: string, status: "queued" | "running" | "complete") {
  const { data, error } = await supabaseAdmin()
    .from("fi_model_runs")
    .insert({
      tenant_id: tenantId,
      case_id: caseId,
      status,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? `Failed to insert ${status} model run.`);
  return data.id as string;
}

async function updateCaseStatus(tenantId: string, caseId: string, status: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("fi_cases")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", caseId);

  if (error) throw new Error(`Failed to update case status: ${error.message}`);
}

async function verifyHliIntakeCreatesEntities(tenantId: string) {
  const sourceCaseId = uniqueId("verify-hli-case");
  const sourcePatientId = uniqueId("verify-hli-patient");
  const sourceEventId = uniqueId("verify-hli-intake-event");

  const event = {
    tenant_id: tenantId,
    event_type: "hli.intake.submitted",
    source_system: "hli",
    source_event_id: sourceEventId,
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
      source_patient_id: sourcePatientId,
    },
    payload: {
      intake: {
        full_name: "Verification HLI Patient",
        email: "verify-hli@test.local",
        dob: "1990-01-01",
        sex: "male",
        country: "UK",
        primary_concern: "thinning",
      },
    },
  };

  const { status, body } = await postEvent(event);
  assert(status === 200 && body.ok, `HLI intake event failed: ${String(body.message ?? body.error)}`);

  const eventRow = await getEventRow(tenantId, "hli", sourceEventId);
  assert(eventRow?.status === "processed", "HLI intake event row not marked processed.");

  const globalPatient = await getGlobalPatient(tenantId, "hli", sourcePatientId);
  assert(globalPatient?.id, "HLI intake did not create global patient.");

  const globalCase = await getGlobalCase(tenantId, "hli", sourceCaseId);
  assert(globalCase?.id, "HLI intake did not create global case.");

  const fiCase = await getFiCase(tenantId, `hli:${sourceCaseId}`);
  assert(fiCase?.id, "HLI intake did not create fi_case.");

  const intake = await getFiIntake(tenantId, fiCase.id);
  assert(intake?.full_name === "Verification HLI Patient", "HLI intake row missing expected full_name.");

  const link = await getEventLink(eventRow.id);
  assert(link?.fi_case_id === fiCase.id, "HLI intake event not linked to fi_case.");
  assert(link?.global_case_id === globalCase.id, "HLI intake event not linked to global case.");
  assert(link?.global_patient_id === globalPatient.id, "HLI intake event not linked to global patient.");

  assert((await countModelRuns(tenantId, fiCase.id)) === 0, "HLI intake should not trigger pipeline before readiness.");

  const replay = await postEvent(event);
  assert(replay.status === 200 && replay.body.ok, "HLI intake replay should return clean success.");
  assert((await countEvents(tenantId, "hli", sourceEventId)) === 1, "HLI intake replay created duplicate fi_events.");
  assert((await countFiCases(tenantId, `hli:${sourceCaseId}`)) === 1, "HLI intake replay created duplicate fi_cases.");
  assert((await countGlobalCases(tenantId, "hli", sourceCaseId)) === 1, "HLI intake replay created duplicate global cases.");

  return { sourceCaseId, sourcePatientId, fiCaseId: fiCase.id };
}

async function verifyHliDocumentIncomplete(tenantId: string) {
  const { sourceCaseId, sourcePatientId, fiCaseId } = await verifyHliIntakeCreatesEntities(tenantId);
  const sourceEventId = uniqueId("verify-hli-doc-event");
  const storagePath = `verify/hli/${sourceCaseId}/blood.csv`;

  const event = {
    tenant_id: tenantId,
    event_type: "hli.document.uploaded",
    source_system: "hli",
    source_event_id: sourceEventId,
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
      source_patient_id: sourcePatientId,
    },
    payload: {
      document: {
        kind: "blood_csv",
        filename: "blood.csv",
        storage_path: storagePath,
        mime_type: "text/csv",
        size_bytes: 32,
      },
    },
  };

  const beforeRuns = await countModelRuns(tenantId, fiCaseId);
  const { status, body } = await postEvent(event);
  assert(status === 200 && body.ok, `HLI document event failed: ${String(body.message ?? body.error)}`);

  const fiCase = await getFiCase(tenantId, `hli:${sourceCaseId}`);
  assert(fiCase?.id === fiCaseId, "HLI document event should reuse existing fi_case.");
  assert((await countUploadsByStoragePath(tenantId, fiCaseId, storagePath)) === 1, "HLI document did not create upload row.");
  assert((await countModelRuns(tenantId, fiCaseId)) === beforeRuns, "HLI document should not trigger before readiness.");

  const replay = await postEvent(event);
  assert(replay.status === 200 && replay.body.ok, "HLI document replay should succeed.");
  assert((await countEvents(tenantId, "hli", sourceEventId)) === 1, "HLI document replay created duplicate fi_events.");
  assert((await countUploadsByStoragePath(tenantId, fiCaseId, storagePath)) === 1, "HLI document replay duplicated upload.");

  const duplicateUploadEvent = {
    ...event,
    source_event_id: uniqueId("verify-hli-doc-dup"),
  };
  const duplicate = await postEvent(duplicateUploadEvent);
  assert(duplicate.status === 200 && duplicate.body.ok, "HLI duplicate-storage upload event should succeed.");
  assert(
    (await countUploadsByStoragePath(tenantId, fiCaseId, storagePath)) === 1,
    "Same storage_path should not create duplicate uploads for the same fi_case."
  );
}

async function verifyHliDocumentCanTriggerWhenReady(tenantId: string) {
  const sourceCaseId = uniqueId("verify-hli-ready-case");
  const sourcePatientId = uniqueId("verify-hli-ready-patient");

  const intakeEvent = {
    tenant_id: tenantId,
    event_type: "hli.intake.submitted",
    source_system: "hli",
    source_event_id: uniqueId("verify-hli-ready-intake"),
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
      source_patient_id: sourcePatientId,
    },
    payload: {
      intake: {
        full_name: "Verification Ready HLI Patient",
        email: "verify-hli-ready@test.local",
        dob: "1991-01-01",
        sex: "female",
      },
    },
  };

  const intakeRes = await postEvent(intakeEvent);
  assert(intakeRes.status === 200 && intakeRes.body.ok, "Ready-case HLI intake failed.");

  const fiCase = await getFiCase(tenantId, `hli:${sourceCaseId}`);
  assert(fiCase?.id, "Ready-case HLI intake did not create fi_case.");

  await uploadViaApi({
    tenantId,
    caseId: fiCase.id,
    type: "scalp_preop_front",
    blob: MINIMAL_PNG,
    filename: `${sourceCaseId}-front.png`,
  });

  const bloodStoragePath = `verify/hli/${sourceCaseId}/event-blood.csv`;
  await seedStorageObject({
    path: bloodStoragePath,
    blob: MINIMAL_CSV,
    contentType: "text/csv",
  });

  const beforeRuns = await countModelRuns(tenantId, fiCase.id);
  const documentEvent = {
    tenant_id: tenantId,
    event_type: "hli.document.uploaded",
    source_system: "hli",
    source_event_id: uniqueId("verify-hli-ready-doc"),
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
      source_patient_id: sourcePatientId,
    },
    payload: {
      document: {
        kind: "blood_csv",
        filename: "event-blood.csv",
        storage_path: bloodStoragePath,
        mime_type: "text/csv",
        size_bytes: 32,
      },
    },
  };

  const result = await postEvent(documentEvent);
  assert(result.status === 200 && result.body.ok, "Ready-case HLI document event failed.");
  assert(
    (await countUploadsByStoragePath(tenantId, fiCase.id, bloodStoragePath)) === 1,
    "Ready-case HLI document did not create expected upload."
  );
  assert((await countModelRuns(tenantId, fiCase.id)) > beforeRuns, "Ready HLI document should trigger a model run.");
}

async function verifyHairAuditOutOfOrderAndSparseIntake(tenantId: string) {
  const sourceCaseId = uniqueId("verify-ha-case");
  const imageStoragePath = `verify/hairaudit/${sourceCaseId}/front.png`;
  const imagesEventId = uniqueId("verify-ha-images");

  const imagesEvent = {
    tenant_id: tenantId,
    event_type: "hairaudit.images.uploaded",
    source_system: "hairaudit",
    source_event_id: imagesEventId,
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
    },
    payload: {
      images: [
        {
          type: "front",
          filename: "front.png",
          storage_path: imageStoragePath,
          mime_type: "image/png",
          size_bytes: 68,
        },
      ],
    },
  };

  const imagesRes = await postEvent(imagesEvent);
  assert(imagesRes.status === 200 && imagesRes.body.ok, "HairAudit images event failed.");

  const fiCase = await getFiCase(tenantId, `hairaudit:${sourceCaseId}`);
  assert(fiCase?.id, "HairAudit images did not create or reuse fi_case.");

  const globalCase = await getGlobalCase(tenantId, "hairaudit", sourceCaseId);
  assert(globalCase?.id, "HairAudit images did not create global case.");
  assert((await countUploadsByStoragePath(tenantId, fiCase.id, imageStoragePath)) === 1, "HairAudit images did not create upload row.");
  assert((await countModelRuns(tenantId, fiCase.id)) === 0, "HairAudit images should not trigger before readiness.");

  const placeholderIntake = await getFiIntake(tenantId, fiCase.id);
  assert(placeholderIntake?.email?.endsWith("@local.invalid"), "HairAudit images should create placeholder intake when absent.");

  const caseEventId = uniqueId("verify-ha-case-event");
  const caseEvent = {
    tenant_id: tenantId,
    event_type: "hairaudit.case.submitted",
    source_system: "hairaudit",
    source_event_id: caseEventId,
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
    },
    payload: {
      case: {
        patient_name: "HairAudit Verification Patient",
        email: "verify-hairaudit@test.local",
        dob: "1989-02-02",
        sex: "male",
        concern: "density",
      },
    },
  };

  const caseRes = await postEvent(caseEvent);
  assert(caseRes.status === 200 && caseRes.body.ok, "HairAudit case event failed.");

  const caseEventRow = await getEventRow(tenantId, "hairaudit", caseEventId);
  assert(caseEventRow?.status === "processed", "HairAudit case event row not marked processed.");

  const reusedCase = await getFiCase(tenantId, `hairaudit:${sourceCaseId}`);
  assert(reusedCase?.id === fiCase.id, "HairAudit case event should reuse fi_case created out-of-order.");

  const enrichedIntake = await getFiIntake(tenantId, fiCase.id);
  assert(
    enrichedIntake?.full_name === "HairAudit Verification Patient" &&
      enrichedIntake.email === "verify-hairaudit@test.local",
    "HairAudit case event did not enrich sparse intake."
  );

  const caseReplay = await postEvent(caseEvent);
  const imageReplay = await postEvent(imagesEvent);
  assert(caseReplay.status === 200 && caseReplay.body.ok, "HairAudit case replay should succeed.");
  assert(imageReplay.status === 200 && imageReplay.body.ok, "HairAudit images replay should succeed.");
  assert((await countEvents(tenantId, "hairaudit", caseEventId)) === 1, "HairAudit case replay created duplicate fi_events.");
  assert((await countEvents(tenantId, "hairaudit", imagesEventId)) === 1, "HairAudit images replay created duplicate fi_events.");
  assert((await countFiCases(tenantId, `hairaudit:${sourceCaseId}`)) === 1, "HairAudit replays created duplicate fi_cases.");
  assert((await countGlobalCases(tenantId, "hairaudit", sourceCaseId)) === 1, "HairAudit replays created duplicate global cases.");
  assert((await countUploadsByStoragePath(tenantId, fiCase.id, imageStoragePath)) === 1, "HairAudit images replay duplicated upload.");
}

async function verifyHairAuditImagesCanTriggerWhenReady(tenantId: string) {
  const sourceCaseId = uniqueId("verify-ha-ready-case");
  const sourcePatientId = uniqueId("verify-ha-ready-patient");
  const caseEvent = {
    tenant_id: tenantId,
    event_type: "hairaudit.case.submitted",
    source_system: "hairaudit",
    source_event_id: uniqueId("verify-ha-ready-case-event"),
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
      source_patient_id: sourcePatientId,
    },
    payload: {
      case: {
        patient_name: "HairAudit Ready Patient",
        email: "verify-ha-ready@test.local",
        dob: "1992-03-03",
        sex: "female",
        primary_concern: "hairline",
      },
    },
  };

  const caseRes = await postEvent(caseEvent);
  assert(caseRes.status === 200 && caseRes.body.ok, "Ready HairAudit case event failed.");

  const caseEventRow = await getEventRow(tenantId, "hairaudit", String(caseEvent.source_event_id));
  assert(caseEventRow?.status === "processed", "Ready HairAudit case event row not marked processed.");

  const fiCase = await getFiCase(tenantId, `hairaudit:${sourceCaseId}`);
  assert(fiCase?.id, "Ready HairAudit case did not create fi_case.");
  const globalCase = await getGlobalCase(tenantId, "hairaudit", sourceCaseId);
  assert(globalCase?.id, "Ready HairAudit case did not create global case.");
  const intake = await getFiIntake(tenantId, fiCase.id);
  assert(intake?.full_name === "HairAudit Ready Patient", "Ready HairAudit case did not create sparse intake.");

  await uploadViaApi({
    tenantId,
    caseId: fiCase.id,
    type: "blood_csv",
    blob: MINIMAL_CSV,
    filename: `${sourceCaseId}-blood.csv`,
  });

  const imageStoragePath = `verify/hairaudit/${sourceCaseId}/event-front.png`;
  await seedStorageObject({
    path: imageStoragePath,
    blob: MINIMAL_PNG,
    contentType: "image/png",
  });

  const beforeRuns = await countModelRuns(tenantId, fiCase.id);
  const imagesEvent = {
    tenant_id: tenantId,
    event_type: "hairaudit.images.uploaded",
    source_system: "hairaudit",
    source_event_id: uniqueId("verify-ha-ready-images"),
    occurred_at: new Date().toISOString(),
    identifiers: {
      source_case_id: sourceCaseId,
      source_patient_id: sourcePatientId,
    },
    payload: {
      images: [
        {
          type: "frontal",
          filename: "event-front.png",
          storage_path: imageStoragePath,
          mime_type: "image/png",
          size_bytes: 68,
        },
      ],
    },
  };

  const imagesRes = await postEvent(imagesEvent);
  assert(imagesRes.status === 200 && imagesRes.body.ok, "Ready HairAudit images event failed.");

  const uploads = await getUploadsByPaths(tenantId, fiCase.id, [imageStoragePath]);
  assert(uploads.length === 1, "Ready HairAudit images event did not create expected upload.");
  assert(uploads[0].type === "scalp_preop_front", "HairAudit legacy image type was not normalized as expected.");
  assert((await countModelRuns(tenantId, fiCase.id)) > beforeRuns, "Ready HairAudit images should trigger a model run.");
}

async function verifyTriggerSkipStatuses(tenantId: string) {
  const statuses: Array<"queued" | "running" | "complete"> = ["queued", "running", "complete"];

  for (const status of statuses) {
    const sourceCaseId = uniqueId(`verify-trigger-${status}`);
    const caseEvent = {
      tenant_id: tenantId,
      event_type: "hairaudit.case.submitted",
      source_system: "hairaudit",
      source_event_id: uniqueId(`verify-trigger-case-${status}`),
      occurred_at: new Date().toISOString(),
      identifiers: {
        source_case_id: sourceCaseId,
      },
      payload: {
        case: {
          patient_name: `Trigger ${status} Patient`,
          email: `trigger-${status}@test.local`,
          dob: "1993-04-04",
          sex: "female",
          primary_concern: "density",
        },
      },
    };

    const caseRes = await postEvent(caseEvent);
    assert(caseRes.status === 200 && caseRes.body.ok, `Setup case event failed for ${status}.`);

    const fiCase = await getFiCase(tenantId, `hairaudit:${sourceCaseId}`);
    assert(fiCase?.id, `Setup case missing fi_case for ${status}.`);

    await uploadViaApi({
      tenantId,
      caseId: fiCase.id,
      type: "blood_csv",
      blob: MINIMAL_CSV,
      filename: `${sourceCaseId}-${status}-blood.csv`,
    });
    await uploadViaApi({
      tenantId,
      caseId: fiCase.id,
      type: "scalp_preop_front",
      blob: MINIMAL_PNG,
      filename: `${sourceCaseId}-${status}-front.png`,
    });

    await updateCaseStatus(tenantId, fiCase.id, "submitted");
    await insertModelRun(tenantId, fiCase.id, status);

    const beforeRuns = await countModelRuns(tenantId, fiCase.id);
    const triggerDecision = await maybeTriggerPipelineFromEvent({
      tenantId,
      fiCaseId: fiCase.id,
      sourceSystem: "hairaudit",
      eventType: "hairaudit.images.uploaded",
      reason: `verify_skip_${status}`,
    });

    assert(
      triggerDecision.triggered === false && triggerDecision.reason === `already_${status}`,
      `Expected already_${status} trigger skip, got ${triggerDecision.reason}.`
    );
    assert((await countModelRuns(tenantId, fiCase.id)) === beforeRuns, `Trigger skip for ${status} should not create new model runs.`);
  }
}

async function main() {
  console.log("FI event ingestion verification");
  console.log("Base URL:", BASE);
  console.log("Base URL source:", process.env.FI_BASE_URL ? "FI_BASE_URL" : process.env.BASE_URL ? "BASE_URL" : "default");

  await preflightAppReachability();

  const tenantId = await getTenantId();
  console.log("Tenant:", tenantId);

  await verifyHliDocumentIncomplete(tenantId);
  console.log("OK: HLI intake + incomplete document flow");

  await verifyHliDocumentCanTriggerWhenReady(tenantId);
  console.log("OK: HLI ready document flow");

  await verifyHairAuditOutOfOrderAndSparseIntake(tenantId);
  console.log("OK: HairAudit out-of-order + sparse intake flow");

  await verifyHairAuditImagesCanTriggerWhenReady(tenantId);
  console.log("OK: HairAudit ready images flow");

  await verifyTriggerSkipStatuses(tenantId);
  console.log("OK: Trigger skip safety (queued/running/complete)");

  console.log("\nAll FI event ingestion verification checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
