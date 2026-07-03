import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFiPublicAppUrl,
  FI_PUBLIC_APP_URL_MISSING_MESSAGE,
  isVercelPreviewDeploymentHost,
  requireFiPublicAppUrlForExternalLinks,
  resolveFiPublicAppUrl,
} from "@/src/lib/fiOs/fiPublicAppUrlCore";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void
): void {
  const prev = new Map<string, string | undefined>();
  for (const key of Object.keys(patch)) {
    prev.set(key, process.env[key]);
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("isVercelPreviewDeploymentHost detects vercel.app preview hosts", () => {
  assert.equal(
    isVercelPreviewDeploymentHost("https://g-follicleintelligence-k84zti7pp-fi-ai-ef8ee84f.vercel.app"),
    true
  );
  assert.equal(isVercelPreviewDeploymentHost("https://app.follicleintelligence.com"), false);
});

test("resolveFiPublicAppUrl prefers FI_PUBLIC_APP_URL and strips trailing slashes", () => {
  withEnv(
    {
      FI_PUBLIC_APP_URL: "https://app.example.com/",
      NEXT_PUBLIC_SITE_URL: "https://other.example.com",
      VERCEL_URL: "preview.vercel.app",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveFiPublicAppUrl(), "https://app.example.com");
    }
  );
});

test("resolveFiPublicAppUrl rejects vercel.app preview env values", () => {
  withEnv(
    {
      FI_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_FI_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_SITE_URL: "https://g-follicleintelligence-k84zti7pp.vercel.app",
      FI_BASE_URL: undefined,
      VERCEL_URL: "g-follicleintelligence-k84zti7pp.vercel.app",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveFiPublicAppUrl(), null);
    }
  );
});

test("resolveFiPublicAppUrl does not use VERCEL_URL", () => {
  withEnv(
    {
      FI_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_FI_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_SITE_URL: undefined,
      FI_BASE_URL: undefined,
      VERCEL_URL: "production-domain.vercel.app",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveFiPublicAppUrl(), null);
    }
  );
});

test("resolveFiPublicAppUrl falls back to localhost in test runtime", () => {
  withEnv(
    {
      FI_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_SITE_URL: undefined,
      FI_BASE_URL: undefined,
      NODE_ENV: "test",
    },
    () => {
      assert.equal(resolveFiPublicAppUrl(), "http://localhost:3000");
    }
  );
});

test("requireFiPublicAppUrlForExternalLinks throws in production without config", () => {
  withEnv(
    {
      FI_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_SITE_URL: undefined,
      FI_BASE_URL: undefined,
      NODE_ENV: "production",
    },
    () => {
      assert.throws(() => requireFiPublicAppUrlForExternalLinks(), (err: unknown) => {
        return err instanceof Error && err.message === FI_PUBLIC_APP_URL_MISSING_MESSAGE;
      });
    }
  );
});

test("buildFiPublicAppUrl builds tenant onboarding invite paths", () => {
  withEnv(
    {
      FI_PUBLIC_APP_URL: "https://app.example.com",
      NODE_ENV: "production",
    },
    () => {
      const url = buildFiPublicAppUrl(
        "/fi-admin/t-1/onboarding/invite/abc-123"
      );
      assert.equal(url, "https://app.example.com/fi-admin/t-1/onboarding/invite/abc-123");
    }
  );
});
