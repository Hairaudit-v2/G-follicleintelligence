import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

describe("capture UI quality prompts", () => {
  it("VieCaptureWizard surfaces imaging quality retake guidance", () => {
    const wizardPath = path.join(process.cwd(), "src/components/fi/vie/VieCaptureWizard.tsx");
    const src = fs.readFileSync(wizardPath, "utf8");
    assert.match(src, /imaging_quality/);
    assert.match(src, /retake_prompt/);
    assert.match(src, /capture_hints/);
  });
});