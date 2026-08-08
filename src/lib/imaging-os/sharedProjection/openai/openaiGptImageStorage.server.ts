/**
 * Bind shared OpenAI provider to private projection storage.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SharedProjectionProvider } from "@follicle/projection-core/client";
import {
  resolveSharedProjectionProviderConfig,
  type SharedProjectionProviderConfig,
} from "../providerConfig";
import {
  createOpenAiGptImageSharedProvider,
  OPENAI_GPT_IMAGE_PROVIDER_ID,
} from "./openaiGptImageProvider";

export const SHARED_PROJECTION_STORAGE_BUCKET = "pre-surgery-projections";

export function createSharedProjectionStorageDeps(admin: SupabaseClient) {
  return {
    async loadBytes(path: string): Promise<Uint8Array> {
      const { data, error } = await admin.storage
        .from(SHARED_PROJECTION_STORAGE_BUCKET)
        .download(path);
      if (error || !data) {
        throw new Error(error?.message ?? "storage_download_failed");
      }
      const ab = await data.arrayBuffer();
      return new Uint8Array(ab);
    },
    async storeBytes(path: string, bytes: Buffer | Uint8Array, contentType: string): Promise<void> {
      const body = bytes instanceof Buffer ? bytes : Buffer.from(bytes);
      const { error } = await admin.storage.from(SHARED_PROJECTION_STORAGE_BUCKET).upload(path, body, {
        contentType,
        upsert: true,
      });
      if (error) throw new Error(error.message);
    },
  };
}

export function createBoundSharedOpenAiProvider(input?: {
  config?: SharedProjectionProviderConfig;
  /** Injected OpenAI client for tests. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
}): {
  providerId: string;
  modelVersion: string;
  config: SharedProjectionProviderConfig;
  provider: SharedProjectionProvider | null;
} {
  const config = input?.config ?? resolveSharedProjectionProviderConfig();
  if (!config.mayInvokeProvider || !config.apiKey) {
    return {
      providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
      modelVersion: config.model,
      config,
      provider: null,
    };
  }
  const provider = createOpenAiGptImageSharedProvider({
    apiKey: config.apiKey,
    model: config.model,
    quality: config.outputQuality,
    timeoutMs: config.timeoutMs,
    promptTemplateVersion: config.promptTemplateVersion,
    client: input?.client,
  });
  return {
    providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
    modelVersion: config.model,
    config,
    provider,
  };
}
