import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadOnboardingPageModel,
  mapOnboardingClinicOption,
  ONBOARDING_FI_CLINICS_SELECT,
} from "@/src/lib/workforce/onboarding/onboardingPage.server";

const TENANT = "00000000-0000-4000-8000-000000000001";
const CLINIC_ID = "11111111-1111-4111-8111-111111111111";

test("ONBOARDING_FI_CLINICS_SELECT: production schema uses id and display_name only", () => {
  assert.deepEqual(
    ONBOARDING_FI_CLINICS_SELECT.split(",").map((c) => c.trim()),
    ["id", "display_name"]
  );
});

test("mapOnboardingClinicOption: uses display_name for clinic label", () => {
  assert.deepEqual(
    mapOnboardingClinicOption({ id: CLINIC_ID, display_name: "Perth Clinic" }),
    { id: CLINIC_ID, name: "Perth Clinic" }
  );
});

test("mapOnboardingClinicOption: falls back to Clinic when display_name is empty", () => {
  assert.deepEqual(mapOnboardingClinicOption({ id: CLINIC_ID, display_name: "  " }), {
    id: CLINIC_ID,
    name: "Clinic",
  });
  assert.deepEqual(mapOnboardingClinicOption({ id: CLINIC_ID, display_name: null }), {
    id: CLINIC_ID,
    name: "Clinic",
  });
});

test("mapOnboardingClinicOption: accepts production fi_clinics row shape (id + display_name only)", () => {
  const productionRow: { id: string; display_name: string } = {
    id: CLINIC_ID,
    display_name: "Evolved Hair Clinic",
  };
  assert.deepEqual(mapOnboardingClinicOption(productionRow), {
    id: CLINIC_ID,
    name: "Evolved Hair Clinic",
  });
});

test("onboardingPage.server.ts: fi_clinics loader does not reference fi_clinics.name", () => {
  const source = readFileSync(
    join(process.cwd(), "src/lib/workforce/onboarding/onboardingPage.server.ts"),
    "utf8"
  );
  assert.ok(
    source.includes('select(ONBOARDING_FI_CLINICS_SELECT)'),
    "loadClinics must select via ONBOARDING_FI_CLINICS_SELECT"
  );
  assert.ok(!source.includes('"id, display_name, name"'), "must not select fi_clinics.name");
  assert.ok(!source.includes("row.name"), "must not read fi_clinics.name fallback");
});

function makeOnboardingPageModelMockClient(): {
  client: SupabaseClient;
  fiClinicsSelectColumns: string | null;
} {
  let fiClinicsSelectColumns: string | null = null;

  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let selectCols = "*";

    const resolveQuery = () => {
      if (table === "fi_clinics") {
        return Promise.resolve({
          data: [{ id: CLINIC_ID, display_name: "Perth Clinic" }],
          error: null,
        });
      }
      if (table === "fi_staff_members") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    };

    const api = {
      select(cols: string) {
        selectCols = cols;
        if (table === "fi_clinics") fiClinicsSelectColumns = cols;
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      is(col: string, val: unknown) {
        if (val === null) filters.push((row) => row[col] == null);
        else filters.push((row) => row[col] === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        filters.push((row) => vals.includes(row[col]));
        return api;
      },
      order() {
        return resolveQuery();
      },
    };

    void selectCols;
    void filters;
    return api;
  };

  return {
    client: { from } as unknown as SupabaseClient,
    get fiClinicsSelectColumns() {
      return fiClinicsSelectColumns;
    },
  };
}

test("loadOnboardingPageModel: queries fi_clinics with id and display_name only", async () => {
  const mock = makeOnboardingPageModelMockClient();
  const model = await loadOnboardingPageModel(TENANT, mock.client);

  assert.deepEqual(
    mock.fiClinicsSelectColumns?.split(",").map((c) => c.trim()),
    ["id", "display_name"]
  );
  assert.deepEqual(model.clinics, [{ id: CLINIC_ID, name: "Perth Clinic" }]);
  assert.equal(model.staff.length, 0);
  assert.ok(model.roleOptions.length > 0);
});
