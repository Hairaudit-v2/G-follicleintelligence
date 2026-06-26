import { authenticatedTest as test } from "../fixtures/auth";
import { allowsMutations } from "../helpers/credentials";
import {
  smokeTestDateOfBirth,
  smokeTestEmail,
  smokeTestFirstName,
  smokeTestLastName,
  smokeTestMobile,
} from "../helpers/test-data";
import { PatientCreatePage } from "../pages/patient-create.page";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Core clinic workflow — patient creation (runbook §2.1).
 *
 * @authenticated @mutation — requires demo credentials AND FI_E2E_ALLOW_MUTATIONS=1.
 * Only run against a throwaway demo tenant. Records use SMOKETEST- prefix.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("clinic workflow — patient create @authenticated @mutation", () => {
  test.beforeEach(() => {
    test.skip(
      !allowsMutations(),
      "Set FI_E2E_ALLOW_MUTATIONS=1 with demo credentials on a throwaway tenant",
    );
  });

  test("tenant admin can create a patient and land on the record", async ({ page }) => {
    const firstName = smokeTestFirstName();
    const patient = new PatientCreatePage(page);

    await patient.goto();
    await patient.expectLoaded();
    await patient.fillForm({
      firstName,
      lastName: smokeTestLastName(),
      mobile: smokeTestMobile(),
      email: smokeTestEmail(),
      dateOfBirth: smokeTestDateOfBirth(),
    });
    await patient.submit();
    await patient.expectCreated(firstName);
  });
});
