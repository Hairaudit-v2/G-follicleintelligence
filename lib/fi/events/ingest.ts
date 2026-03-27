import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiEventEnvelope, FiEventType } from "@/src/types/fi-events";
import { handleHairAuditCaseSubmitted } from "./handlers/hairauditCaseSubmitted";
import { handleHairAuditImagesUploaded } from "./handlers/hairauditImagesUploaded";
import { handleHliDocumentUploaded } from "./handlers/hliDocumentUploaded";
import { handleHliIntakeSubmitted } from "./handlers/hliIntakeSubmitted";
import { parseFiEventEnvelope } from "./schema";

export type FiEventIngestResult = {
  ok: boolean;
  eventType: string;
  sourceSystem: string;
  fiCaseId?: string;
  actionTaken?: string;
  message: string;
};

function readStringField(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function getRawEnvelopeMetadata(input: unknown): Pick<FiEventIngestResult, "eventType" | "sourceSystem"> {
  return {
    eventType: readStringField(input, "event_type") ?? "unknown",
    sourceSystem: readStringField(input, "source_system") ?? "unknown",
  };
}

function buildUnsupportedResult(envelope: FiEventEnvelope): FiEventIngestResult {
  return {
    ok: false,
    eventType: envelope.event_type,
    sourceSystem: envelope.source_system,
    message: `Unsupported event_type: ${envelope.event_type}`,
  };
}

function assertNeverEventType(value: never): never {
  throw new Error(`Unhandled FI event type: ${String(value)}`);
}

async function dispatchValidatedFiEvent(envelope: FiEventEnvelope): Promise<FiEventIngestResult> {
  switch (envelope.event_type) {
    case "hli.intake.submitted": {
      const result = await handleHliIntakeSubmitted({ envelope });
      return {
        ok: result.ok,
        eventType: envelope.event_type,
        sourceSystem: envelope.source_system,
        fiCaseId: result.fiCaseId,
        actionTaken: result.actionTaken,
        message: result.message,
      };
    }
    case "hli.document.uploaded": {
      const result = await handleHliDocumentUploaded(supabaseAdmin(), envelope);
      return {
        ok: true,
        eventType: envelope.event_type,
        sourceSystem: envelope.source_system,
        fiCaseId: result.fiCaseId,
        actionTaken: "handled_hli_document_uploaded",
        message: "HLI document uploaded event ingested.",
      };
    }
    case "hairaudit.case.submitted": {
      const result = await handleHairAuditCaseSubmitted({ envelope });
      return {
        ok: result.ok,
        eventType: envelope.event_type,
        sourceSystem: envelope.source_system,
        fiCaseId: result.fiCaseId,
        actionTaken: result.actionTaken,
        message: result.message,
      };
    }
    case "hairaudit.images.uploaded": {
      const result = await handleHairAuditImagesUploaded({ envelope });
      return {
        ok: result.ok,
        eventType: envelope.event_type,
        sourceSystem: envelope.source_system,
        fiCaseId: result.fiCaseId,
        actionTaken: result.actionTaken,
        message: result.message,
      };
    }
    case "clinic.ai.usage":
      return buildUnsupportedResult(envelope);
    default:
      return assertNeverEventType(envelope.event_type satisfies FiEventType);
  }
}

export async function ingestFiEvent(input: unknown): Promise<FiEventIngestResult> {
  const envelopeResult = parseFiEventEnvelope(input);
  if (!envelopeResult.ok) {
    const { eventType, sourceSystem } = getRawEnvelopeMetadata(input);
    return {
      ok: false,
      eventType,
      sourceSystem,
      message: envelopeResult.error,
    };
  }

  try {
    return await dispatchValidatedFiEvent(envelopeResult.data);
  } catch (error: unknown) {
    return {
      ok: false,
      eventType: envelopeResult.data.event_type,
      sourceSystem: envelopeResult.data.source_system,
      fiCaseId: undefined,
      message: error instanceof Error ? error.message : "Unexpected ingest error.",
    };
  }
}
