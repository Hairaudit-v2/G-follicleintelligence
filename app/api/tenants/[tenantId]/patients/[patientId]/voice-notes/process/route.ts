/**
 * POST multipart: field `audio` (File), optional `caseId` (string).
 * DoctorOS 1C: transcribe → structure → persist ai_draft clinical note + patient timeline row.
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { insertVoiceClinicalNoteDraft } from "@/src/lib/clinicalNotes/clinicalNotesMutations.server";
import {
  structureTranscriptWithOpenAI,
  transcribeAudioWithOpenAIWhisper,
} from "@/src/lib/clinicalNotes/voiceClinicalNoteAi.server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 24 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim()) {
      return crmJsonError(400, "Missing tenantId or patientId.");
    }

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return crmJsonError(400, 'Content-Type must be multipart/form-data with field "audio".');
    }

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return crmJsonError(400, 'Missing file field "audio".');
    }
    if (file.size <= 0) {
      return crmJsonError(400, "Audio file is empty.");
    }
    if (file.size > MAX_BYTES) {
      return crmJsonError(400, "Audio file is too large (max ~24 MB for transcription).");
    }

    const caseIdRaw = form.get("caseId");
    const caseId = typeof caseIdRaw === "string" && caseIdRaw.trim() ? caseIdRaw.trim() : null;

    const doctorUserId = await tryResolveFiUserIdForTenant(tenantId, req);

    const transcript = await transcribeAudioWithOpenAIWhisper({
      audio: file,
      filename: file.name?.trim() || "recording.webm",
    });
    const { sections, model } = await structureTranscriptWithOpenAI({ transcript });

    const { note } = await insertVoiceClinicalNoteDraft({
      tenantId,
      patientId,
      caseId,
      transcriptRaw: transcript,
      sections,
      structureModel: model,
      createdByFiUserId: doctorUserId,
    });

    return crmJsonOk({
      clinical_note: {
        id: note.id,
        record_status: note.record_status,
        sections: note.sections,
        transcript_raw: note.transcript_raw,
        created_at: note.created_at,
        case_id: note.case_id,
      },
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
