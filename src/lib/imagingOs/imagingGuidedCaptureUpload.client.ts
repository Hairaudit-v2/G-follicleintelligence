export const GUIDED_CAPTURE_UPLOAD_TIMEOUT_MS = 30_000;

export const GUIDED_CAPTURE_UPLOAD_MESSAGES = {
  timeout: "Upload timed out. Please retry.",
  network: "Network error — check connection and retry.",
  server: "Upload failed. Please try again.",
} as const;

export type GuidedCaptureUploadJson = {
  ok?: boolean;
  error?: string;
  guided_session?: {
    completionPercent: number;
    sessionCompleted: boolean;
    missingRequired: string[];
    nextSlotSlug: string | null;
  };
  attribution?: { quality?: { alert_message?: string | null } };
};

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

export function resolveGuidedCaptureUploadException(error: unknown): string {
  if (isAbortError(error)) return GUIDED_CAPTURE_UPLOAD_MESSAGES.timeout;
  return GUIDED_CAPTURE_UPLOAD_MESSAGES.network;
}

export function resolveGuidedCaptureUploadFailure(
  response: Response,
  json: Pick<GuidedCaptureUploadJson, "ok" | "error">
): string | null {
  if (response.ok && json.ok) return null;
  if (!response.ok && response.status >= 500) {
    return GUIDED_CAPTURE_UPLOAD_MESSAGES.server;
  }
  const serverError = json.error?.trim();
  if (serverError) return serverError;
  return GUIDED_CAPTURE_UPLOAD_MESSAGES.server;
}

export async function postGuidedCaptureImage(
  url: string,
  formData: FormData,
  options?: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  }
): Promise<{ response: Response; json: GuidedCaptureUploadJson }> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? GUIDED_CAPTURE_UPLOAD_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      body: formData,
      credentials: "include",
      signal: controller.signal,
    });
    const json = (await response.json().catch(() => ({}))) as GuidedCaptureUploadJson;
    return { response, json };
  } finally {
    clearTimeout(timer);
  }
}
