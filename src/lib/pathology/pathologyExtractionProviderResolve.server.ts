import "server-only";

import type { PathologyExtractionProviderAdapter } from "./pathologyExtractionProvider";
import {
  resolvePathologyExtractionProviderIdFromEnv,
  type PathologyExtractionProviderEnvSlice,
} from "./pathologyExtractionProvider";
import {
  ensurePathologyExtractionProductionProviders,
  getLivePathologyExtractionAdapter,
} from "./pathologyExtractionProviderLive.server";
import { StubPathologyExtractionProvider } from "./pathologyExtractionProviderStub";
import { FI_PATHOLOGY_STUB_PROVIDER_ID } from "./pathologyExtractionProviderTypes";

ensurePathologyExtractionProductionProviders();

const stubProvider = new StubPathologyExtractionProvider();

let providerOverride: PathologyExtractionProviderAdapter | null = null;

/** Test hook — inject a deterministic provider adapter. */
export function setPathologyExtractionProviderAdapterForTests(
  adapter: PathologyExtractionProviderAdapter | null
): void {
  providerOverride = adapter;
}

export function resolvePathologyExtractionProvider(
  env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
): PathologyExtractionProviderAdapter {
  if (providerOverride) return providerOverride;

  const providerId = resolvePathologyExtractionProviderIdFromEnv(env);
  if (providerId === FI_PATHOLOGY_STUB_PROVIDER_ID) return stubProvider;

  const live = getLivePathologyExtractionAdapter(providerId);
  if (live) return live;

  return stubProvider;
}
