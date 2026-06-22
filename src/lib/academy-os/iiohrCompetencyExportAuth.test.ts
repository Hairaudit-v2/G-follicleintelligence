import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateIiohrCompetencyExportAuth,
  isIiohrCompetencyExportEnabled,
} from "./iiohrCompetencyExportAuth";

test("competency export auth fails closed when disabled", () => {
  const prevEnabled = process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED;
  const prevSecret = process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET;
  process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED = "false";
  process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET = "0123456789abcdef";

  assert.equal(isIiohrCompetencyExportEnabled(), false);
  const result = evaluateIiohrCompetencyExportAuth(
    new Request("http://localhost", {
      headers: { "x-iiohr-competency-export-secret": "0123456789abcdef" },
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.httpStatus, 503);

  if (prevEnabled === undefined) delete process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED;
  else process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED = prevEnabled;
  if (prevSecret === undefined) delete process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET;
  else process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET = prevSecret;
});

test("competency export auth accepts valid secret when enabled", () => {
  const prevEnabled = process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED;
  const prevSecret = process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET;
  process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED = "true";
  process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET = "0123456789abcdef";

  const result = evaluateIiohrCompetencyExportAuth(
    new Request("http://localhost", {
      headers: { "x-iiohr-competency-export-secret": "0123456789abcdef" },
    })
  );
  assert.equal(result.ok, true);

  if (prevEnabled === undefined) delete process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED;
  else process.env.IIOHR_FI_COMPETENCY_EXPORT_ENABLED = prevEnabled;
  if (prevSecret === undefined) delete process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET;
  else process.env.IIOHR_FI_COMPETENCY_EXPORT_SECRET = prevSecret;
});
