import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  hairImageClassificationNotConfiguredResult,
  isOpenAiApiKeyConfigured,
} from "./classifyClinicalHairImageFallback";

describe("classifyClinicalHairImageFallback", () => {
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });

  it("detects missing API key", () => {
    assert.equal(isOpenAiApiKeyConfigured(), false);
  });

  it("fallback result shape", () => {
    const r = hairImageClassificationNotConfiguredResult();
    assert.equal(r.category, "unknown");
    assert.equal(r.categoryConfidence, 0);
    assert.match(r.notes, /OPENAI_API_KEY/i);
  });
});
