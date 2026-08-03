import "server-only";

import {
  assertHliTrichoscopyConfiguredForOutbound,
  loadHliTrichoscopyConfig,
  type HliTrichoscopyConfig,
} from "./config";
import {
  HliTrichoscopyAuthenticationError,
  HliTrichoscopyTimeoutError,
  HliTrichoscopyUnavailableError,
} from "./errors";
import { buildOutboundHliHeaders } from "./eventVerifier";
import { emitTrichoscopyTelemetry } from "./telemetry";

export type HliTrichoscopyHttpResult = {
  ok: boolean;
  status: number;
  body: unknown;
  stub: boolean;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function hliTrichoscopyFetchJson(opts: {
  path: string;
  method?: "GET" | "POST" | "PUT";
  tenantId: string;
  body?: unknown;
  config?: HliTrichoscopyConfig;
  idempotencyKey?: string;
}): Promise<HliTrichoscopyHttpResult> {
  const config = opts.config ?? loadHliTrichoscopyConfig();
  assertHliTrichoscopyConfiguredForOutbound(config);

  if (config.useStub) {
    emitTrichoscopyTelemetry("stub_request", {
      tenant_id: opts.tenantId,
      path: opts.path,
      method: opts.method ?? "POST",
    });
    return {
      ok: true,
      status: 200,
      stub: true,
      body: {
        stub: true,
        path: opts.path,
        echo: opts.body ?? null,
      },
    };
  }

  const method = opts.method ?? "POST";
  const url = `${config.apiBaseUrl!.replace(/\/$/, "")}${opts.path.startsWith("/") ? "" : "/"}${opts.path}`;
  const rawBody = method === "GET" ? "" : JSON.stringify(opts.body ?? {});
  const headers = buildOutboundHliHeaders({
    tenantId: opts.tenantId,
    secret: config.signingSecret!,
    body: rawBody || "{}",
  });
  headers.authorization = `Bearer ${config.serviceKey}`;
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: method === "GET" ? undefined : rawBody,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { raw: text };
      }
      if (res.status === 401 || res.status === 403) {
        throw new HliTrichoscopyAuthenticationError("HLI rejected FiOS service authentication.");
      }
      if (!res.ok && res.status >= 500 && attempt < config.maxRetries) {
        await sleep(100 * (attempt + 1));
        continue;
      }
      emitTrichoscopyTelemetry("http_response", {
        tenant_id: opts.tenantId,
        path: opts.path,
        status: res.status,
        attempt,
      });
      return { ok: res.ok, status: res.status, body: parsed, stub: false };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof HliTrichoscopyAuthenticationError) throw err;
      if ((err as { name?: string })?.name === "AbortError") {
        if (attempt < config.maxRetries) {
          await sleep(100 * (attempt + 1));
          continue;
        }
        throw new HliTrichoscopyTimeoutError("HLI trichoscopy request timed out.");
      }
      if (attempt < config.maxRetries) {
        await sleep(100 * (attempt + 1));
        continue;
      }
    }
  }

  throw new HliTrichoscopyUnavailableError(
    lastError instanceof Error ? lastError.message : "HLI trichoscopy unavailable."
  );
}
