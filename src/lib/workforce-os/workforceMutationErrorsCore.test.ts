import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapWorkforceFkMutationError,
  WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE,
} from "@/src/lib/workforce-os/workforceMutationErrorsCore";

describe("mapWorkforceFkMutationError", () => {
  it("maps availability block created_by FK violations to a friendly message", () => {
    const raw =
      'insert or update on table "fi_staff_availability_blocks" violates foreign key constraint "fi_staff_availability_blocks_created_by_fkey"';
    assert.equal(mapWorkforceFkMutationError(raw), WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
  });

  it("maps shift created_by FK violations to a friendly message", () => {
    const raw =
      'insert or update on table "fi_staff_shifts" violates foreign key constraint "fi_staff_shifts_created_by_fkey"';
    assert.equal(mapWorkforceFkMutationError(raw), WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
  });

  it("returns null for unrelated database errors", () => {
    assert.equal(
      mapWorkforceFkMutationError("duplicate key value violates unique constraint"),
      null
    );
  });
});
