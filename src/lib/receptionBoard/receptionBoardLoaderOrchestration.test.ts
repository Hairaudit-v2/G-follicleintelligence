import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("receptionBoard loader orchestration", () => {
  it("command center passes preloaded slices to avoid duplicate loaders", () => {
    const orchestrator = fs.readFileSync(
      path.join(process.cwd(), "src/lib/receptionBoard/receptionBoard.server.ts"),
      "utf8"
    );
    assert.match(orchestrator, /const \[operational, surgeryPayload\] = await Promise\.all\(/);
    assert.match(orchestrator, /caseByBookingPromise/);
    assert.match(orchestrator, /loadReceptionOsBoardPayload\(tid, now,/);
    assert.match(orchestrator, /operational,/);
    assert.match(orchestrator, /surgeryPayload,/);
    assert.match(orchestrator, /caseByBooking:/);
    assert.doesNotMatch(
      orchestrator,
      /Promise\.all\(\[\s*\n?\s*loadTenantOperationalDashboard[\s\S]*loadReceptionOsBoardPayload\(tid, now\),[\s\S]*loadSurgeryReadinessBoardPayload/
    );
  });

  it("reception OS board loader accepts preloaded orchestration input", () => {
    const loader = fs.readFileSync(
      path.join(process.cwd(), "src/lib/receptionOs/receptionOsBoardLoader.server.ts"),
      "utf8"
    );
    assert.match(loader, /LoadReceptionOsBoardPreloaded/);
    assert.match(loader, /preloaded\.operational/);
    assert.match(loader, /preloaded\.surgeryPayload/);
    assert.match(loader, /preloaded\.caseByBooking/);
  });
});