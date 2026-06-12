import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeFiDeploymentBaseUrl } from "@/src/lib/env/fiDeploymentBaseUrl";

test("strips trailing slashes", () => {
  assert.equal(normalizeFiDeploymentBaseUrl("https://app.example.com/"), "https://app.example.com");
});

test("strips mistaken /fi-admin suffix from deployment base URL", () => {
  assert.equal(
    normalizeFiDeploymentBaseUrl("https://app.example.com/fi-admin/"),
    "https://app.example.com"
  );
});
