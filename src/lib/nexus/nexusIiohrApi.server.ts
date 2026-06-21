import { readFiOsNexusEnabled, readFiOsNexusSecret } from "@/src/lib/nexus/fiOsNexusEnv.server";
import {
  evaluateIiohrNexusSignedRequest,
  IIOHR_NEXUS_HDR_SIGNATURE,
  IIOHR_NEXUS_HDR_TIMESTAMP,
} from "@/src/lib/nexus/iiohrNexusWebhookAuth.server";
import type {
  NexusProvisionPayload,
  NexusRollbackPayload,
} from "@/src/lib/nexus/nexusProvisioningTypes";
import { provisionExternalProfessionalFromNexus } from "@/src/lib/nexus/provisionExternalProfessional.server";
import { readExternalProfessionalState } from "@/src/lib/nexus/readExternalProfessionalState.server";
import { rollbackExternalProfessionalProvisioning } from "@/src/lib/nexus/rollbackExternalProfessionalProvisioning.server";

export type NexusHttpBody = { ok: boolean; error?: string; state?: unknown };

export type NexusHttpResponse = { httpStatus: number; body: NexusHttpBody };

export type NexusHttpEnv = {
  enabled: boolean;
  secret: string | null;
};

export function readNexusHttpEnv(): NexusHttpEnv {
  return {
    enabled: readFiOsNexusEnabled(),
    secret: readFiOsNexusSecret(),
  };
}

export function evaluateNexusGate(env: NexusHttpEnv = readNexusHttpEnv()): NexusHttpResponse | null {
  if (!env.enabled) {
    return { httpStatus: 403, body: { ok: false, error: "Nexus provisioning is disabled." } };
  }
  if (!env.secret) {
    return { httpStatus: 503, body: { ok: false, error: "Service unavailable." } };
  }
  return null;
}

export async function verifyNexusSignedJsonRequest(
  request: Pick<Request, "headers">,
  rawBody: string,
  env: NexusHttpEnv = readNexusHttpEnv()
): Promise<NexusHttpResponse | { ok: true }> {
  const gate = evaluateNexusGate(env);
  if (gate) return gate;

  const auth = evaluateIiohrNexusSignedRequest({
    timestampHeader: request.headers.get(IIOHR_NEXUS_HDR_TIMESTAMP),
    signatureHeader: request.headers.get(IIOHR_NEXUS_HDR_SIGNATURE),
    rawBody,
    secret: env.secret,
  });

  if (!auth.ok) {
    return { httpStatus: auth.httpStatus, body: { ok: false, error: auth.error } };
  }

  return { ok: true };
}

function parseJsonBody(rawBody: string): NexusHttpResponse | Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { httpStatus: 400, body: { ok: false, error: "Invalid JSON body." } };
    }
    return parsed as Record<string, unknown>;
  } catch {
    return { httpStatus: 400, body: { ok: false, error: "Invalid JSON body." } };
  }
}

export async function handleNexusProvisionHttp(
  request: Pick<Request, "headers">,
  rawBody: string,
  env: NexusHttpEnv = readNexusHttpEnv()
): Promise<NexusHttpResponse> {
  const verified = await verifyNexusSignedJsonRequest(request, rawBody, env);
  if ("httpStatus" in verified) return verified;

  const parsed = parseJsonBody(rawBody);
  if ("httpStatus" in parsed) return parsed;

  const payload = parsed as unknown as NexusProvisionPayload;
  const result = await provisionExternalProfessionalFromNexus(payload);
  if (!result.ok) {
    return { httpStatus: result.httpStatus, body: { ok: false, error: result.error } };
  }
  return { httpStatus: 200, body: { ok: true, state: result.state } };
}

export async function handleNexusRollbackHttp(
  request: Pick<Request, "headers">,
  rawBody: string,
  env: NexusHttpEnv = readNexusHttpEnv()
): Promise<NexusHttpResponse> {
  const verified = await verifyNexusSignedJsonRequest(request, rawBody, env);
  if ("httpStatus" in verified) return verified;

  const parsed = parseJsonBody(rawBody);
  if ("httpStatus" in parsed) return parsed;

  const payload = parsed as unknown as NexusRollbackPayload;
  const result = await rollbackExternalProfessionalProvisioning(payload);
  if (!result.ok) {
    return { httpStatus: result.httpStatus, body: { ok: false, error: result.error } };
  }
  return { httpStatus: 200, body: { ok: true, state: result.state } };
}

export type NexusIiohrApiDeps = {
  readState?: (globalProfessionalId: string) => ReturnType<typeof readExternalProfessionalState>;
};

export async function handleNexusStateHttp(
  request: Pick<Request, "headers">,
  globalProfessionalId: string | null,
  env: NexusHttpEnv = readNexusHttpEnv(),
  deps: NexusIiohrApiDeps = {}
): Promise<NexusHttpResponse> {
  const gate = evaluateNexusGate(env);
  if (gate) return gate;

  const timestamp = request.headers.get(IIOHR_NEXUS_HDR_TIMESTAMP)?.trim() ?? "";
  const signature = request.headers.get(IIOHR_NEXUS_HDR_SIGNATURE)?.trim() ?? "";
  const rawBody = globalProfessionalId?.trim() ?? "";

  const auth = evaluateIiohrNexusSignedRequest({
    timestampHeader: timestamp,
    signatureHeader: signature,
    rawBody,
    secret: env.secret,
  });

  if (!auth.ok) {
    return { httpStatus: auth.httpStatus, body: { ok: false, error: auth.error } };
  }

  if (!rawBody) {
    return { httpStatus: 400, body: { ok: false, error: "globalProfessionalId is required." } };
  }

  const readFn = deps.readState ?? readExternalProfessionalState;
  const result = await readFn(rawBody);
  if (!result.ok) {
    return { httpStatus: result.httpStatus, body: { ok: false, error: result.error } };
  }
  return { httpStatus: 200, body: { ok: true, state: result.state } };
}
