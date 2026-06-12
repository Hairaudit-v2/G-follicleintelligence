import assert from "node:assert/strict";
import test from "node:test";

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import { buildStaffFiOsExperiencePreview } from "@/src/lib/fi-os/fiOsWorkspaceExperiencePreview";

test("staff experience preview: includes workspace and quick actions", () => {
  const all = buildDefaultFeatureAccessAllEnabled();
  const effectiveFeatures = Object.fromEntries(all) as Record<FiFeatureKey, boolean>;
  const lines = buildStaffFiOsExperiencePreview({
    workspaceProfile: "nurse",
    effectiveFeatures,
  });
  assert.ok(lines.some((l) => l.startsWith("Workspace:")));
  assert.ok(lines.some((l) => l.startsWith("Quick actions:")));
});
